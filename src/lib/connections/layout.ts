/**
 * Deterministic incremental layout: no live force simulation. Every node
 * sits in a grid cell: row = the road term it belongs to (or is projected
 * to reach), column = its position among that row's department-sorted
 * occupants.
 *
 * Rows are compacted: only buckets a *currently present* node actually
 * uses get a row, in ascending bucket order, so an empty semester never
 * reserves a gap. That means a node's row can shift when the set of
 * populated buckets changes, since a semester gaining its first node, or
 * losing its last one, slides every row after it. What's protected
 * instead is narrower but still the thing that matters for a stable feel:
 * a node's COLUMN within its row never changes once assigned, and a node
 * whose row hasn't changed keeps its exact position across a pass. A
 * newly discovered (or newly re-termed) node only ever searches for an
 * open column within its own row.
 *
 * Pinned/dragged positions are authoritative and survive every pass,
 * including the optional one-shot "tidy" (row re-pack); row compaction
 * and column packing never touch them.
 */

import { NUM_SEMESTERS } from "../offering";
import type { GraphState, Viewport } from "./types";
import { departmentOf } from "./types";

export interface Point {
  x: number;
  y: number;
}

export interface LayoutState {
  positions: Map<string, Point>;
  /** Nodes whose position the user fixed (dragged/pinned); never auto-moved. */
  fixed: Set<string>;
}

/** A subject's bucket: its road term, or absent for "no determinable
 *  term" (not on the road and not reachable from the current plan). */
export type TermMap = Map<string, number>;

/** Horizontal grid pitch; clears the ~200-wide node cards. */
export const COL_WIDTH = 224;
/** Vertical grid pitch; clears a ~78-tall card plus its row label. */
export const ROW_HEIGHT = 160;
/** The catch-all bucket for a node with no entry in the term map: one past
 *  the last real bucket (0..NUM_SEMESTERS-1), so it always sorts last. */
export const UNSCHEDULED_ROW = NUM_SEMESTERS;
/** Generous bound on an outward column search; more than enough for any
 *  row this graph could ever produce (HARD_NODE_CEILING in graph.ts). */
const MAX_COLUMN_SEARCH = 200;

export function emptyLayout(): LayoutState {
  return { positions: new Map(), fixed: new Set() };
}

function bucketFor(id: string, termOf: TermMap): number {
  return termOf.get(id) ?? UNSCHEDULED_ROW;
}

/** Department first (so same-department nodes stay contiguous), then id. */
function compareIds(a: string, b: string): number {
  const da = departmentOf(a);
  const db = departmentOf(b);
  if (da !== db) {
    return da < db ? -1 : 1;
  }
  return a < b ? -1 : 1;
}

/**
 * The distinct buckets among `state`'s current nodes, ascending, each
 * paired with its compacted row index (0, 1, 2, ...; no gaps for a bucket
 * nothing currently occupies). Exported so the canvas can build row labels
 * that agree exactly with where `reconcileLayout` actually put things.
 */
export function gridRows(
  state: GraphState,
  termOf: TermMap,
): { bucket: number; row: number }[] {
  const buckets = new Set<number>();
  for (const id of state.nodes.keys()) {
    buckets.add(bucketFor(id, termOf));
  }
  return [...buckets]
    .sort((a, b) => a - b)
    .map((bucket, row) => ({ bucket, row }));
}

/** Columns occupied at row `row` among `positions`, rounding each point to
 *  its nearest row so a dragged node (never exactly on a grid multiple)
 *  still blocks the column it visually sits in. */
function occupiedColumnsAt(
  positions: Map<string, Point>,
  row: number,
): Set<number> {
  const cols = new Set<number>();
  for (const p of positions.values()) {
    if (Math.round(p.y / ROW_HEIGHT) === row) {
      cols.add(Math.round(p.x / COL_WIDTH));
    }
  }
  return cols;
}

/**
 * Place `id` in `row`, at the column nearest to where it sorts among that
 * row's current occupants (department, then id). If that column is taken,
 * search outward (+1, -1, +2, -2, ...) for the nearest free one, so a
 * single node discovered after its row is already dense can land out of
 * strict sort order rather than displace an existing card.
 */
function placeInRow(next: LayoutState, id: string, row: number): void {
  const y = row * ROW_HEIGHT;
  const occupants = [id];
  for (const [otherId, p] of next.positions) {
    if (Math.round(p.y / ROW_HEIGHT) === row) {
      occupants.push(otherId);
    }
  }
  occupants.sort(compareIds);
  const ideal = occupants.indexOf(id);
  const taken = occupiedColumnsAt(next.positions, row);
  let col = ideal;
  if (taken.has(col)) {
    for (let step = 1; step <= MAX_COLUMN_SEARCH; step++) {
      if (!taken.has(ideal + step)) {
        col = ideal + step;
        break;
      }
      if (!taken.has(ideal - step)) {
        col = ideal - step;
        break;
      }
    }
  }
  next.positions.set(id, { x: col * COL_WIDTH, y });
}

/**
 * Reconcile positions against the current graph and term map. Every
 * pinned/dragged node keeps its exact position, full stop. Every other
 * node still in the graph gets its row re-derived from the *current*
 * compacted mapping: unchanged if that's still where it already sits
 * (column preserved too), otherwise (a new node, or one whose term just
 * changed: placed onto the road, a semester ahead of it emptying out,
 * ...) it's placed fresh into its new row. Pure; returns a new
 * LayoutState; the input is untouched.
 */
export function reconcileLayout(
  prev: LayoutState,
  state: GraphState,
  termOf: TermMap,
): LayoutState {
  const next: LayoutState = {
    positions: new Map(),
    fixed: new Set(),
  };
  for (const id of prev.fixed) {
    if (state.nodes.has(id)) {
      next.fixed.add(id);
    }
  }
  for (const id of next.fixed) {
    const point = prev.positions.get(id);
    if (point !== undefined) {
      next.positions.set(id, point);
    }
  }

  const rowOf = new Map(gridRows(state, termOf).map((r) => [r.bucket, r.row]));

  // Nodes still at the row they already occupied keep their exact spot
  // (column included); everyone else is (re)placed. Sorted once, globally,
  // so within any one row, ids are visited in ascending (department, id)
  // order, so a row built fresh packs as 0, 1, 2, ... with no gaps, whether
  // its nodes are anchors or discovered, all at once or across passes.
  const pending: string[] = [];
  for (const id of state.nodes.keys()) {
    if (next.fixed.has(id)) {
      continue;
    }
    const row = rowOf.get(bucketFor(id, termOf)) as number;
    const prevPoint = prev.positions.get(id);
    if (
      prevPoint !== undefined &&
      Math.round(prevPoint.y / ROW_HEIGHT) === row
    ) {
      next.positions.set(id, prevPoint);
    } else {
      pending.push(id);
    }
  }
  pending.sort(compareIds);
  for (const id of pending) {
    const row = rowOf.get(bucketFor(id, termOf)) as number;
    placeInRow(next, id, row);
  }

  return next;
}

/** Pin a node to an explicit position (drag). Authoritative thereafter. */
export function setNodePosition(
  layout: LayoutState,
  id: string,
  point: Point,
): LayoutState {
  const next: LayoutState = {
    positions: new Map(layout.positions),
    fixed: new Set(layout.fixed),
  };
  next.positions.set(id, point);
  next.fixed.add(id);
  return next;
}

/**
 * Optional one-shot "tidy": re-pack every row. Non-fixed nodes in a row
 * re-sort by department and close up left-to-right, columns pinned/dragged
 * (fixed) nodes hold onto skipped in place. Restores clean order after
 * removals leave gaps; never the source of correctness, purely cosmetic.
 * Fixed nodes never move.
 */
export function tidyLayout(
  layout: LayoutState,
  state: GraphState,
): LayoutState {
  const positions = new Map(layout.positions);
  const byRow = new Map<number, string[]>();
  for (const [id, p] of positions) {
    if (!state.nodes.has(id)) {
      continue;
    }
    const row = Math.round(p.y / ROW_HEIGHT);
    const list = byRow.get(row);
    if (list === undefined) {
      byRow.set(row, [id]);
    } else {
      list.push(id);
    }
  }
  for (const [row, ids] of byRow) {
    const y = row * ROW_HEIGHT;
    const fixedCols = new Set<number>();
    const movable: string[] = [];
    for (const id of ids) {
      if (layout.fixed.has(id)) {
        const p = positions.get(id) as Point;
        fixedCols.add(Math.round(p.x / COL_WIDTH));
      } else {
        movable.push(id);
      }
    }
    movable.sort(compareIds);
    let col = 0;
    for (const id of movable) {
      while (fixedCols.has(col)) {
        col++;
      }
      positions.set(id, { x: col * COL_WIDTH, y });
      col++;
    }
  }
  return { positions, fixed: new Set(layout.fixed) };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Bounding box over all node positions (a unit box around origin if empty). */
export function computeBounds(layout: LayoutState): Bounds {
  if (layout.positions.size === 0) {
    return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of layout.positions.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Viewport that fits `bounds` into a w×h canvas with padding, clamped
 * zoom. maxZoom caps at 1 so a small graph frames at natural card size
 * instead of blowing a lone seed up to fill the screen. `extraLeftMargin`
 * reserves additional screen-independent room on the left before the
 * symmetric `padding` applies on top of it, for content (like the
 * canvas's row labels) that extends further left than any node's own
 * position, and so isn't part of `bounds` at all.
 */
export function fitViewport(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 80,
  minZoom = 0.35,
  maxZoom = 1,
  extraLeftMargin = 0,
): Viewport {
  const effectiveMinX = bounds.minX - extraLeftMargin;
  const contentW = Math.max(1, bounds.maxX - effectiveMinX);
  const contentH = Math.max(1, bounds.maxY - bounds.minY);
  const zoom = Math.max(
    minZoom,
    Math.min(
      maxZoom,
      Math.min(
        (width - 2 * padding) / contentW,
        (height - 2 * padding) / contentH,
      ),
    ),
  );
  const centerX = (effectiveMinX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    x: width / 2 - centerX * zoom,
    y: height / 2 - centerY * zoom,
  };
}
