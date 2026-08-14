/**
 * The Connections graph state machine: pure, deterministic, unit-tested.
 * Every operation takes a `GraphState` and returns a new one (never
 * mutated). Grows only on demand: starts as the student's road (anchors),
 * each expansion reveals a capped, ranked set of neighbors.
 *
 * Trickiest invariant: collapse without orphaning. Reference-counting
 * introductions isn't enough, it strands introducer cycles (expand A→N,
 * N→M, M re-introduces N; collapsing A leaves N/M pointing only at each
 * other). So collapse recomputes reachability by mark-and-sweep from the
 * roots (anchors ∪ pinned); anything not reached is swept. Bounded node
 * counts keep this cheap.
 */

import type { EdgeEngine } from "./edges";
import type { GraphState } from "./types";
import { cloneGraphState, emptyGraphState } from "./types";

/** Max neighbors revealed by a single expansion; the rest go behind "show more". */
export const NEIGHBORS_PER_EXPANSION = 8;
/** Soft node budget; past it the UI warns; expansion still works. */
export const SOFT_NODE_BUDGET = 80;
/** Hard ceiling; expansion stops adding *new* nodes past this. */
export const HARD_NODE_CEILING = 140;

/**
 * Add a node (if absent) and every edge between it and the nodes already
 * present. Existing nodes and edges are untouched. Mutates `state` in place;
 * callers pass a clone.
 */
function placeNode(
  state: GraphState,
  engine: EdgeEngine,
  id: string,
  anchor: boolean,
): void {
  if (!state.nodes.has(id)) {
    state.nodes.set(id, { id, anchor });
    for (const otherId of state.nodes.keys()) {
      if (otherId === id) {
        continue;
      }
      const edge = engine.edgeBetween(id, otherId);
      if (edge !== undefined) {
        state.edges.set(edge.id, edge);
      }
    }
  }
  if (anchor) {
    state.anchors.add(id);
    state.nodes.set(id, { id, anchor: true });
  }
}

/** Drop a node and every edge touching it, plus all its bookkeeping. */
function deleteNode(state: GraphState, id: string): void {
  state.nodes.delete(id);
  state.anchors.delete(id);
  state.pinned.delete(id);
  state.expanded.delete(id);
  state.shownCount.delete(id);
  state.introducedBy.delete(id);
  for (const introducers of state.introducedBy.values()) {
    introducers.delete(id);
  }
  for (const [key, edge] of state.edges) {
    if (edge.a === id || edge.b === id) {
      state.edges.delete(key);
    }
  }
}

/**
 * The set of nodes reachable from the roots (anchors ∪ pinned) through
 * currently-expanded nodes. Discovered nodes outside this set are orphans.
 */
function reachableFromRoots(state: GraphState): Set<string> {
  // reverse the introducedBy map: expander → nodes it introduced
  const introductions = new Map<string, string[]>();
  for (const [node, introducers] of state.introducedBy) {
    for (const introducer of introducers) {
      const list = introductions.get(introducer);
      if (list === undefined) {
        introductions.set(introducer, [node]);
      } else {
        list.push(node);
      }
    }
  }
  const live = new Set<string>([...state.anchors, ...state.pinned]);
  // only expanded live nodes can justify the nodes they introduced
  const queue = [...live].filter((id) => state.expanded.has(id));
  while (queue.length > 0) {
    const current = queue.pop() as string;
    for (const introduced of introductions.get(current) ?? []) {
      if (!live.has(introduced)) {
        live.add(introduced);
        if (state.expanded.has(introduced)) {
          queue.push(introduced);
        }
      }
    }
  }
  return live;
}

/**
 * Remove every discovered node no longer reachable from the roots. Anchors
 * and pinned nodes are roots and are never swept. Returns whether anything
 * was removed.
 */
function sweepOrphans(state: GraphState): boolean {
  const live = reachableFromRoots(state);
  let removedAny = false;
  for (const id of [...state.nodes.keys()]) {
    if (!live.has(id)) {
      deleteNode(state, id);
      removedAny = true;
    }
  }
  return removedAny;
}

/**
 * Resolve, filter, and dedupe seed ids to real explorable subjects.
 * Renumbered ids follow `old_id`; generics, customs, and unresolvable ids
 * are dropped so the seed never produces a ghost or non-explorable anchor.
 */
function resolveSeedIds(engine: EdgeEngine, ids: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const resolved = engine.resolveId(raw);
    if (
      resolved !== undefined &&
      engine.isExplorable(resolved) &&
      !seen.has(resolved)
    ) {
      seen.add(resolved);
      out.push(resolved);
    }
  }
  return out;
}

/**
 * Build the initial graph from a seed (the student's road, or a single
 * course). Anchors are interconnected immediately so a related road isn't a
 * field of disconnected dots.
 */
export function seedGraph(engine: EdgeEngine, seedIds: string[]): GraphState {
  const state = emptyGraphState();
  for (const id of resolveSeedIds(engine, seedIds)) {
    placeNode(state, engine, id, true);
  }
  return state;
}

/** Whether `nodeId` has more neighbors to reveal beyond what's shown. */
export function hasMoreNeighbors(
  state: GraphState,
  engine: EdgeEngine,
  nodeId: string,
): boolean {
  if (!state.nodes.has(nodeId)) {
    return false;
  }
  const candidates = engine.neighbors(nodeId);
  const shown = state.shownCount.get(nodeId) ?? 0;
  for (let i = shown; i < candidates.length; i++) {
    if (!state.removed.has(candidates[i].id)) {
      return true;
    }
  }
  return false;
}

/**
 * Reveal up to `count` of a node's strongest not-yet-shown neighbors.
 * Already-present neighbors get the new edge + an introduction record (so
 * collapse can reason about them); they are not duplicated. A no-op if the
 * node is absent or fully expanded.
 */
export function expandNode(
  state: GraphState,
  engine: EdgeEngine,
  nodeId: string,
  count: number = NEIGHBORS_PER_EXPANSION,
): GraphState {
  if (!state.nodes.has(nodeId)) {
    return state;
  }
  const next = cloneGraphState(state);
  const candidates = engine.neighbors(nodeId);
  let cursor = next.shownCount.get(nodeId) ?? 0;
  let revealed = 0;
  while (cursor < candidates.length && revealed < count) {
    const candidate = candidates[cursor];
    if (next.removed.has(candidate.id)) {
      cursor++;
      continue;
    }
    const isNew = !next.nodes.has(candidate.id);
    if (isNew && next.nodes.size >= HARD_NODE_CEILING) {
      break; // hold this candidate behind "show more" until room is freed
    }
    if (isNew) {
      placeNode(next, engine, candidate.id, false);
    }
    // record that this node justifies the candidate (anchors need no record)
    if (!next.anchors.has(candidate.id)) {
      const introducers =
        next.introducedBy.get(candidate.id) ?? new Set<string>();
      introducers.add(nodeId);
      next.introducedBy.set(candidate.id, introducers);
    }
    cursor++;
    revealed++;
  }
  next.shownCount.set(nodeId, cursor);
  next.expanded.add(nodeId);
  return next;
}

/**
 * Reveal one specific neighbor of a node (the side panel's "show on graph"
 * action, the keyboard-driven equivalent of clicking a single connection).
 * Marks the parent expanded so the new node participates in collapse logic.
 * A no-op if the two aren't actually connected.
 */
export function revealNeighbor(
  state: GraphState,
  engine: EdgeEngine,
  parentId: string,
  neighborId: string,
): GraphState {
  if (
    !state.nodes.has(parentId) ||
    !engine.neighborMap(parentId).has(neighborId)
  ) {
    return state;
  }
  const next = cloneGraphState(state);
  next.removed.delete(neighborId); // an explicit reveal un-suppresses it
  if (!next.nodes.has(neighborId) && next.nodes.size < HARD_NODE_CEILING) {
    placeNode(next, engine, neighborId, false);
  }
  if (next.nodes.has(neighborId) && !next.anchors.has(neighborId)) {
    const introducers = next.introducedBy.get(neighborId) ?? new Set<string>();
    introducers.add(parentId);
    next.introducedBy.set(neighborId, introducers);
  }
  next.expanded.add(parentId);
  return next;
}

/**
 * Hide the neighbors an expansion introduced, keeping any still reachable
 * from the roots or another expanded node. Never orphans anchors, pinned
 * nodes, or otherwise-reachable nodes (collects introducer cycles too). A
 * no-op on a node that isn't expanded.
 */
export function collapseNode(state: GraphState, nodeId: string): GraphState {
  if (!state.expanded.has(nodeId)) {
    return state;
  }
  const next = cloneGraphState(state);
  next.expanded.delete(nodeId);
  next.shownCount.delete(nodeId); // re-expand starts fresh
  sweepOrphans(next);
  return next;
}

/** Pin a node so it survives collapse and reset. */
export function pinNode(state: GraphState, nodeId: string): GraphState {
  if (!state.nodes.has(nodeId) || state.pinned.has(nodeId)) {
    return state;
  }
  const next = cloneGraphState(state);
  next.pinned.add(nodeId);
  return next;
}

/** Unpin a node (it stays until the next collapse/reset can't justify it). */
export function unpinNode(state: GraphState, nodeId: string): GraphState {
  if (!state.pinned.has(nodeId)) {
    return state;
  }
  const next = cloneGraphState(state);
  next.pinned.delete(nodeId);
  return next;
}

/**
 * Remove a single node and suppress it from future expansions, then sweep
 * any nodes that only this one justified (so removing an expander doesn't
 * strand its children).
 */
export function removeNode(state: GraphState, nodeId: string): GraphState {
  if (!state.nodes.has(nodeId)) {
    return state;
  }
  const next = cloneGraphState(state);
  deleteNode(next, nodeId);
  next.removed.add(nodeId);
  sweepOrphans(next);
  return next;
}

/**
 * Back to the seed: drop every discovered node except pinned ones, clear
 * expansion state, and forget removals. Anchors and pins are preserved with
 * their positions handled by the layout layer.
 */
export function resetGraph(state: GraphState, engine: EdgeEngine): GraphState {
  const keep = new Set<string>([...state.anchors, ...state.pinned]);
  const next = emptyGraphState();
  next.anchors = new Set(state.anchors);
  next.pinned = new Set(state.pinned);
  for (const id of state.nodes.keys()) {
    if (keep.has(id)) {
      placeNode(next, engine, id, state.anchors.has(id));
    }
  }
  return next;
}
