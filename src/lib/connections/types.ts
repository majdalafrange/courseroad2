/**
 * Core types for Connections, CourseRoad's course-discovery graph. Built
 * entirely from the cached FireRoad catalog: nodes are real subjects,
 * edges are prerequisite relationships. Framework-free, derived from a
 * `CatalogView`: no Vue, no Pinia, no DOM.
 *
 * An edge is keyed by the *unordered* pair of its endpoints, so two
 * subjects share at most one edge no matter how many reasons relate
 * them; direction is a property of the edge, not a second parallel edge.
 */

/**
 * Relationship category. Prerequisites are the only relationship the graph
 * draws; the type survives as a single member so an edge still declares
 * what it is at every render and ranking site.
 */
export type EdgeType = "prereq";

/** One reason two subjects are connected, with its plain-language copy. */
export interface EdgeReason {
  type: EdgeType;
  /** Why connected, in a sentence: "6.006 requires this", "Listed as related". */
  label: string;
  /** This reason's contribution to the blended edge weight (0–1-ish). */
  weight: number;
}

/**
 * An undirected connection between two subjects, carrying every reason the
 * two are related. `a` and `b` are the endpoint ids sorted lexicographically
 * so the identity is order-independent.
 */
export interface GraphEdge {
  id: string;
  a: string;
  b: string;
  reasons: EdgeReason[];
  /** Blended weight across all reasons; drives ranking and edge prominence. */
  weight: number;
  /** Highest-weight reason's type, used for the edge's color/legend group. */
  primaryType: EdgeType;
  /** True when the endpoints live in different departments (a "crossing"). */
  crossing: boolean;
  /** For prerequisite edges: prerequisite → dependent. Absent if undirected. */
  arrow?: { from: string; to: string };
}

/**
 * A node in the live graph. Deliberately minimal: title, rating, status,
 * and color are resolved from the catalog/road/audit at render time so the
 * graph model stays catalog-independent and serializable.
 */
export interface GraphNode {
  id: string;
  /** Part of the seed (the student's road), as opposed to discovered. */
  anchor: boolean;
}

/**
 * The full mutable state of an exploration. All graph operations in
 * `graph.ts` take and return one of these (shallow-cloned), so every
 * transition is a pure function that's trivial to unit-test.
 */
export interface GraphState {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  /** Seed nodes: permanent roots, never swept by collapse/reset. */
  anchors: Set<string>;
  /** User-pinned nodes: also permanent roots until unpinned. */
  pinned: Set<string>;
  /** Subjects the user explicitly removed; never re-revealed by expansion. */
  removed: Set<string>;
  /** Nodes that have been expanded at least once. */
  expanded: Set<string>;
  /**
   * For each discovered node, the set of expander nodes that revealed it.
   * Used to recompute reachability on collapse (mark-and-sweep from roots).
   */
  introducedBy: Map<string, Set<string>>;
  /** Per node, how many of its ranked neighbors have been revealed so far. */
  shownCount: Map<string, number>;
}

/** Pan/zoom state of the canvas. Serialized with the exploration. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** What an exploration was seeded from; catalog-independent (just ids). */
export interface Seed {
  /** Catalog subject ids the exploration started from. */
  subjectIds: string[];
  /** Where the seed came from, for UI copy and re-seeding. */
  origin: "road" | "subject" | "manual";
}

/** Canonical, order-independent key for the edge between two subject ids. */
export function edgeKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/**
 * Department token of a subject id: the part before the first ".". Handles
 * letter-suffixed and non-numeric departments (21W.021 → "21W", CMS.100 →
 * "CMS", 6.1010 → "6", WGS.101 → "WGS"); never assumes the id is numeric.
 * Ids with no "." (e.g. generic placeholders) return the whole id.
 */
export function departmentOf(id: string): string {
  const dot = id.indexOf(".");
  return dot === -1 ? id : id.slice(0, dot);
}

/** Whether two subject ids belong to different departments (a "crossing"). */
export function isCrossing(a: string, b: string): boolean {
  return departmentOf(a) !== departmentOf(b);
}

/** A fresh, empty graph state. */
export function emptyGraphState(): GraphState {
  return {
    nodes: new Map(),
    edges: new Map(),
    anchors: new Set(),
    pinned: new Set(),
    removed: new Set(),
    expanded: new Set(),
    introducedBy: new Map(),
    shownCount: new Map(),
  };
}

/**
 * Shallow-clone a graph state so a transition can mutate the copy without
 * touching the caller's value. Inner Sets/Maps are copied; the GraphNode /
 * GraphEdge objects they hold are immutable by convention and shared.
 */
export function cloneGraphState(state: GraphState): GraphState {
  return {
    nodes: new Map(state.nodes),
    edges: new Map(state.edges),
    anchors: new Set(state.anchors),
    pinned: new Set(state.pinned),
    removed: new Set(state.removed),
    expanded: new Set(state.expanded),
    introducedBy: new Map(
      [...state.introducedBy].map(([k, v]) => [k, new Set(v)]),
    ),
    shownCount: new Map(state.shownCount),
  };
}
