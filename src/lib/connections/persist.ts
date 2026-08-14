/**
 * Persistence: ephemeral *behavior* now, account-ready *architecture*.
 *
 * An exploration serializes to a compact, catalog-independent snapshot:
 * the seed, the ids that were expanded / pinned / removed, and the viewport.
 * Derived edges and computed positions are NEVER serialized; they are
 * rebuilt from the live catalog on load, so a snapshot survives a catalog
 * that has changed underneath it (vanished subjects dropped, renumbered ones
 * followed via old_id).
 *
 * All persistence flows through the `ConnectionsPersistence` seam. The live
 * implementation is per-tab sessionStorage (consent-gated, with an in-memory
 * fallback), so an exploration survives a reload but still ends with the
 * visit; swapping in account-backed storage for a logged-in (MIT-kerberos)
 * student later touches only an implementation of this interface, with no
 * redesign.
 */

import type { EdgeEngine } from "./edges";
import { expandNode, pinNode, seedGraph } from "./graph";
import type { GraphState, Seed, Viewport } from "./types";

export interface ConnectionsSnapshot {
  version: 1;
  seed: Seed;
  expandedNodeIds: string[];
  pinnedNodeIds: string[];
  removedNodeIds: string[];
  viewport: Viewport;
}

/** The storage seam. The store talks only to this, never to a backend. */
export interface ConnectionsPersistence {
  load(): ConnectionsSnapshot | undefined;
  save(snapshot: ConnectionsSnapshot): void;
  clear(): void;
}

/** Default ephemeral implementation: holds one snapshot for the session. */
export class InMemoryConnectionsPersistence implements ConnectionsPersistence {
  private snapshot: ConnectionsSnapshot | undefined;

  load(): ConnectionsSnapshot | undefined {
    return this.snapshot;
  }

  save(snapshot: ConnectionsSnapshot): void {
    this.snapshot = snapshot;
  }

  clear(): void {
    this.snapshot = undefined;
  }
}

/** sessionStorage key for the per-tab exploration snapshot. */
const SESSION_KEY = "connectionsExploration";

/**
 * Drop the stored exploration. Called when the user opts out of storage, so
 * the snapshot goes with the rest of their data rather than lingering for
 * the life of the tab.
 */
export function clearExplorationSnapshot(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable; nothing stored there to remove.
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Structural check for a stored snapshot; anything else is treated as absent. */
function isSnapshot(value: unknown): value is ConnectionsSnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const s = value as Record<string, unknown>;
  const seed = s.seed as Record<string, unknown> | null | undefined;
  const viewport = s.viewport as Record<string, unknown> | null | undefined;
  return (
    s.version === 1 &&
    typeof seed === "object" &&
    seed !== null &&
    isStringArray(seed.subjectIds) &&
    (seed.origin === "road" ||
      seed.origin === "subject" ||
      seed.origin === "manual") &&
    isStringArray(s.expandedNodeIds) &&
    isStringArray(s.pinnedNodeIds) &&
    isStringArray(s.removedNodeIds) &&
    typeof viewport === "object" &&
    viewport !== null &&
    isFiniteNumber(viewport.x) &&
    isFiniteNumber(viewport.y) &&
    isFiniteNumber(viewport.zoom) &&
    viewport.zoom > 0
  );
}

/**
 * Per-tab persistence: the exploration survives a reload but still ends with
 * the visit, keeping the ephemeral contract. `allowed` follows the app's
 * storage-consent answer; when it returns false the snapshot stays in memory
 * only. Storage access is best-effort (a private window can deny it), so
 * every path is guarded and falls back to the in-memory behavior.
 */
export class SessionConnectionsPersistence implements ConnectionsPersistence {
  private memory = new InMemoryConnectionsPersistence();

  constructor(private allowed: () => boolean = () => true) {}

  load(): ConnectionsSnapshot | undefined {
    if (!this.allowed()) {
      return this.memory.load();
    }
    let raw: string | null;
    try {
      raw = sessionStorage.getItem(SESSION_KEY);
    } catch {
      return this.memory.load();
    }
    if (raw === null) {
      return this.memory.load();
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return isSnapshot(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  save(snapshot: ConnectionsSnapshot): void {
    this.memory.save(snapshot);
    if (!this.allowed()) {
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota or storage unavailable; the in-memory copy still covers the visit.
    }
  }

  clear(): void {
    this.memory.clear();
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Storage unavailable; nothing stored there to remove.
    }
  }
}

/**
 * Serialize a live graph to a catalog-independent snapshot. Only ids and the
 * viewport are stored, never edges or positions.
 */
export function serializeGraph(
  state: GraphState,
  seed: Seed,
  viewport: Viewport,
): ConnectionsSnapshot {
  return {
    version: 1,
    seed: { subjectIds: [...seed.subjectIds], origin: seed.origin },
    expandedNodeIds: [...state.expanded],
    pinnedNodeIds: [...state.pinned],
    removedNodeIds: [...state.removed],
    viewport: { ...viewport },
  };
}

export interface ReconcileResult {
  state: GraphState;
  viewport: Viewport;
  /** Snapshot ids that could not be resolved against the live catalog. */
  dropped: string[];
}

/**
 * Rebuild a graph from a snapshot against the *current* catalog. Ids are
 * resolved through old_id; anything that vanished is dropped (and reported).
 * Expansions are replayed to a fixpoint so the membership is reconstructed
 * deterministically, then pins are reapplied. The snapshot is never rendered
 * verbatim.
 */
export function reconcileSnapshot(
  snapshot: ConnectionsSnapshot,
  engine: EdgeEngine,
): ReconcileResult {
  const dropped: string[] = [];
  const resolve = (id: string): string | undefined => {
    const r = engine.resolveId(id);
    if (r === undefined || !engine.isExplorable(r)) {
      dropped.push(id);
      return undefined;
    }
    return r;
  };

  const seedIds = snapshot.seed.subjectIds
    .map(resolve)
    .filter((id): id is string => id !== undefined);

  let state = seedGraph(engine, seedIds);

  // suppress removed ids up front so replayed expansions skip them
  for (const id of snapshot.removedNodeIds) {
    const r = engine.resolveId(id);
    if (r !== undefined) {
      state.removed.add(r);
    }
  }

  const wantExpanded = new Set<string>();
  for (const id of snapshot.expandedNodeIds) {
    const r = resolve(id);
    if (r !== undefined) {
      wantExpanded.add(r);
    }
  }
  // replay to a fixpoint: expanding one node may surface another that was
  // also expanded in the saved exploration
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const id of wantExpanded) {
      if (state.nodes.has(id) && !state.expanded.has(id)) {
        state = expandNode(state, engine, id);
        progressed = true;
      }
    }
  }

  for (const id of snapshot.pinnedNodeIds) {
    const r = resolve(id);
    if (r !== undefined && state.nodes.has(r)) {
      state = pinNode(state, r);
    }
  }

  return { state, viewport: { ...snapshot.viewport }, dropped };
}
