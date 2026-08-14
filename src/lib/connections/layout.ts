/**
 * Deterministic incremental layout: no live force simulation. New
 * children are placed radially around the node that introduced them, in
 * free space; **existing nodes never move**. Collision avoidance is
 * local: only the incoming node searches outward for an open spot.
 * Fixed candidate angles, ids in sorted order, no randomness: same
 * graph and expansion order always yields the same layout.
 *
 * Pinned/dragged positions are authoritative and survive every pass,
 * including the optional one-shot "tidy."
 */

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

/** Minimum center-to-center distance before two nodes count as colliding.
 *  Sized to clear the ~200×78 node cards so revealed nodes don't overlap. */
const MIN_DISTANCE = 224;
/** Ring radius for a freshly revealed child around its parent. */
const CHILD_RADIUS = 240;
const RING_STEP = 72;
const MAX_RINGS = 10;
/** Candidate angles per ring, evaluated nearest-to-ideal first. */
const ANGLE_SAMPLES = 24;
/** Seed rings. One circle while the chord spacing allows; past that the
 *  seed fills concentric rings from the inside out, so a large road still
 *  opens as a disc rather than a sparse donut. */
const MAX_SINGLE_RING = 18;
const RING_GAP = MIN_DISTANCE;

export function emptyLayout(): LayoutState {
  return { positions: new Map(), fixed: new Set() };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function collides(p: Point, occupied: Point[]): boolean {
  for (const o of occupied) {
    if (distance(p, o) < MIN_DISTANCE) {
      return true;
    }
  }
  return false;
}

/** Centroid of the given points (origin if empty). */
function centroidOf(points: Point[]): Point {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

/** Smallest ring radius that seats `count` nodes MIN_DISTANCE apart. */
function ringRadiusFor(count: number): number {
  return MIN_DISTANCE / 2 / Math.sin(Math.PI / count);
}

/** How many nodes a ring of `radius` seats MIN_DISTANCE apart. */
function ringCapacity(radius: number): number {
  return Math.floor(Math.PI / Math.asin(MIN_DISTANCE / 2 / radius));
}

/**
 * Place anchors on a circle centered at the origin, deterministically
 * sorted by (department, id) so each department is a contiguous arc; a
 * many-course seed reads as a color-grouped wheel. A seed too large for
 * one chord-safe ring fills concentric rings from the inside out, each
 * ring's occupants spread evenly so the rim never gaps.
 *
 * Concentric rings ARE the intended shape, not an unfinished disc: no
 * node sits at the centroid (placeChildren fans children outward from
 * it, so it must stay unoccupied), the innermost ring starts at
 * RING_GAP, and the outermost ring holds whatever remainder is left, so
 * it can carry fewer nodes than the ring inside it. No relaxation pass
 * runs at seed time; Auto-arrange is the one opt-in exception.
 */
function placeAnchors(next: LayoutState, anchorIds: string[]): void {
  const ids = anchorIds
    .filter((id) => !next.positions.has(id))
    .sort((a, b) => {
      const da = departmentOf(a);
      const db = departmentOf(b);
      if (da !== db) {
        return da < db ? -1 : 1;
      }
      return a < b ? -1 : 1;
    });
  if (ids.length === 0) {
    return;
  }
  if (ids.length === 1) {
    next.positions.set(ids[0], { x: 0, y: 0 });
    return;
  }
  if (ids.length <= MAX_SINGLE_RING) {
    placeRing(next, ids, ringRadiusFor(ids.length), 0);
    return;
  }
  let placed = 0;
  for (let ring = 0; placed < ids.length; ring++) {
    const radius = RING_GAP * (ring + 1);
    const remaining = ids.length - placed;
    const count = Math.min(remaining, ringCapacity(radius));
    placeRing(next, ids.slice(placed, placed + count), radius, ring);
    placed += count;
  }
}

/** Spread `ids` evenly around one ring. Rings start at the top, each
 *  rotated half a step from the last so no radial seam lines up. */
function placeRing(
  next: LayoutState,
  ids: string[],
  radius: number,
  ring: number,
): void {
  const step = (2 * Math.PI) / ids.length;
  const start = -Math.PI / 2 + (ring * step) / 2;
  for (let i = 0; i < ids.length; i++) {
    const angle = start + i * step;
    next.positions.set(ids[i], {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  }
}

/**
 * Find a free position for a child near its parent, fanning outward from the
 * graph's center so the graph grows outward rather than inward. Only the
 * incoming node moves; `occupied` (existing nodes) is never disturbed.
 */
function placeChild(
  parent: Point,
  centroid: Point,
  slot: number,
  slotCount: number,
  occupied: Point[],
): Point {
  // ideal direction: fan outward from the graph's center. When the parent
  // sits at the centroid (e.g. a lone seed), "outward" is undefined, so
  // distribute children evenly around a full ring instead of one-sided.
  const dxc = parent.x - centroid.x;
  const dyc = parent.y - centroid.y;
  const atCenter = Math.hypot(dxc, dyc) < 1;
  let ideal: number;
  if (atCenter) {
    ideal = (slot / Math.max(1, slotCount)) * 2 * Math.PI;
  } else {
    const outward = Math.atan2(dyc, dxc);
    const spread = Math.PI * 0.9;
    const fan = slotCount > 1 ? (slot / (slotCount - 1) - 0.5) * spread : 0;
    ideal = outward + fan;
  }

  let best: Point | undefined;
  for (let ring = 0; ring < MAX_RINGS; ring++) {
    const radius = CHILD_RADIUS + ring * RING_STEP;
    // evaluate candidate angles ordered by closeness to the ideal direction
    const candidates: number[] = [];
    for (let k = 0; k < ANGLE_SAMPLES; k++) {
      candidates.push(k);
    }
    candidates.sort((p, q) => {
      const ap = Math.abs(angleDelta(ideal, (p / ANGLE_SAMPLES) * 2 * Math.PI));
      const aq = Math.abs(angleDelta(ideal, (q / ANGLE_SAMPLES) * 2 * Math.PI));
      return ap - aq || p - q;
    });
    for (const k of candidates) {
      const angle = (k / ANGLE_SAMPLES) * 2 * Math.PI;
      const point = {
        x: parent.x + radius * Math.cos(angle),
        y: parent.y + radius * Math.sin(angle),
      };
      if (best === undefined) {
        best = point; // deterministic fallback if everything collides
      }
      if (!collides(point, occupied)) {
        return point;
      }
    }
  }
  return best as Point;
}

/** Smallest signed angular difference between two angles. */
function angleDelta(a: number, b: number): number {
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) {
    d -= 2 * Math.PI;
  }
  if (d < -Math.PI) {
    d += 2 * Math.PI;
  }
  return d;
}

/**
 * Reconcile positions against the current graph: keep every existing
 * position exactly, place anchors that lack one, and place each newly
 * revealed node around the node that introduced it. Pure; returns a new
 * LayoutState; the input is untouched.
 */
export function reconcileLayout(
  prev: LayoutState,
  state: GraphState,
): LayoutState {
  const next: LayoutState = {
    positions: new Map(),
    fixed: new Set(),
  };
  // carry over positions for nodes still present (drop the rest)
  for (const [id, point] of prev.positions) {
    if (state.nodes.has(id)) {
      next.positions.set(id, point);
    }
  }
  for (const id of prev.fixed) {
    if (state.nodes.has(id)) {
      next.fixed.add(id);
    }
  }

  placeAnchors(next, [...state.anchors]);

  // group not-yet-placed discovered nodes by their original introducer
  const pending = [...state.nodes.keys()]
    .filter((id) => !next.positions.has(id))
    .sort();
  const byParent = new Map<string, string[]>();
  const orphanRoots: string[] = [];
  for (const id of pending) {
    const introducers = state.introducedBy.get(id);
    let parent: string | undefined;
    if (introducers !== undefined) {
      for (const candidate of introducers) {
        if (next.positions.has(candidate)) {
          parent = candidate;
          break;
        }
      }
    }
    if (parent === undefined) {
      orphanRoots.push(id);
    } else {
      const list = byParent.get(parent);
      if (list === undefined) {
        byParent.set(parent, [id]);
      } else {
        list.push(id);
      }
    }
  }

  // a node with no positioned introducer (rare) gets placed near the centroid
  for (const id of orphanRoots) {
    const occupied = [...next.positions.values()];
    const centroid = centroidOf(occupied);
    next.positions.set(id, placeChild(centroid, centroid, 0, 1, occupied));
  }

  for (const parent of [...byParent.keys()].sort()) {
    const children = (byParent.get(parent) as string[]).sort();
    const parentPos = next.positions.get(parent) as Point;
    for (let i = 0; i < children.length; i++) {
      const occupied = [...next.positions.values()];
      const centroid = centroidOf(occupied);
      const point = placeChild(
        parentPos,
        centroid,
        i,
        children.length,
        occupied,
      );
      next.positions.set(children[i], point);
    }
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
 * Optional one-shot "tidy": a few deterministic relaxation iterations
 * (edge springs + node repulsion) that even out spacing, then freeze. Fixed
 * nodes never move. Never the source of correctness; purely cosmetic.
 */
export function tidyLayout(
  layout: LayoutState,
  state: GraphState,
  iterations = 60,
): LayoutState {
  const pos = new Map<string, Point>();
  for (const [id, p] of layout.positions) {
    pos.set(id, { x: p.x, y: p.y });
  }
  const ids = [...state.nodes.keys()];
  const edges = [...state.edges.values()];
  const REPULSION = MIN_DISTANCE * MIN_DISTANCE * 1.1;
  const SPRING = 0.02;
  const REST = CHILD_RADIUS;
  for (let iter = 0; iter < iterations; iter++) {
    const force = new Map<string, Point>();
    for (const id of ids) {
      force.set(id, { x: 0, y: 0 });
    }
    // repulsion between every pair (bounded node counts make this fine)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos.get(ids[i]) as Point;
        const b = pos.get(ids[j]) as Point;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          // deterministic separation for coincident points
          dx = i - j || 1;
          dy = 1;
          d2 = dx * dx + dy * dy;
        }
        const f = REPULSION / d2;
        const inv = 1 / Math.sqrt(d2);
        const fx = dx * inv * f;
        const fy = dy * inv * f;
        const fa = force.get(ids[i]) as Point;
        const fb = force.get(ids[j]) as Point;
        fa.x += fx;
        fa.y += fy;
        fb.x -= fx;
        fb.y -= fy;
      }
    }
    // springs along edges
    for (const edge of edges) {
      const a = pos.get(edge.a);
      const b = pos.get(edge.b);
      if (a === undefined || b === undefined) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = SPRING * (d - REST);
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      const fa = force.get(edge.a) as Point;
      const fb = force.get(edge.b) as Point;
      fa.x += fx;
      fa.y += fy;
      fb.x -= fx;
      fb.y -= fy;
    }
    for (const id of ids) {
      if (layout.fixed.has(id)) {
        continue;
      }
      const f = force.get(id) as Point;
      const p = pos.get(id) as Point;
      // damped step, clamped so a single iteration can't fling a node
      p.x += Math.max(-12, Math.min(12, f.x * 0.05));
      p.y += Math.max(-12, Math.min(12, f.y * 0.05));
    }
  }
  return { positions: pos, fixed: new Set(layout.fixed) };
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

/** Viewport that fits `bounds` into a w×h canvas with padding, clamped zoom.
 *  maxZoom caps at 1 so a small graph frames at natural card size instead of
 *  blowing a lone seed up to fill the screen. */
export function fitViewport(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 80,
  minZoom = 0.35,
  maxZoom = 1,
): Viewport {
  const contentW = Math.max(1, bounds.maxX - bounds.minX);
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
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    x: width / 2 - centerX * zoom,
    y: height / 2 - centerY * zoom,
  };
}
