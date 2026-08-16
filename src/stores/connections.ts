/**
 * Connections store: reactive bridge between the pure graph engine in
 * `src/lib/connections/` and the canvas. Owns no graph logic itself: calls
 * the pure transitions, holds state in a `shallowRef` (reassignment is the
 * only reactive trigger; engine caches never get proxied), projects view
 * models for rendering.
 *
 * Exploration lives per tab via `ConnectionsPersistence` (sessionStorage
 * with consent, memory otherwise): reload keeps it, closing the tab ends
 * it. Account-backed saving is a later drop-in behind the same seam.
 */

import { computed, ref, shallowRef, watch } from "vue";
import { defineStore } from "pinia";
import type { RequirementNode, Subject } from "../lib/types";
import { getSubject } from "../lib/types";
import { courseColor } from "../lib/colors";
import { courseColorClassFromId } from "../lib/colors";
import { EdgeEngine } from "../lib/connections/edges";
import {
  HARD_NODE_CEILING,
  SOFT_NODE_BUDGET,
  collapseNode,
  expandNode,
  hasMoreNeighbors,
  pinNode,
  removeNode,
  resetGraph,
  revealNeighbor,
  seedGraph,
  unpinNode,
} from "../lib/connections/graph";
import {
  emptyLayout,
  reconcileLayout,
  setNodePosition,
  tidyLayout,
  type LayoutState,
  type Point,
} from "../lib/connections/layout";
import { rankNeighbors, type RankedNeighbor } from "../lib/connections/rank";
import {
  createReadinessEvaluator,
  type Readiness,
} from "../lib/connections/readiness";
import {
  SessionConnectionsPersistence,
  reconcileSnapshot,
  serializeGraph,
  type ConnectionsPersistence,
} from "../lib/connections/persist";
import {
  emptyGraphState,
  type EdgeReason,
  type EdgeType,
  type GraphEdge,
  type GraphState,
  type Seed,
  type Viewport,
} from "../lib/connections/types";
import {
  NUM_SEMESTERS,
  baseYear,
  semesterCalendarYearShort,
  semesterType,
} from "../lib/offering";
import { announce } from "../design/announce";
import { toast } from "../design/toast";
import { history } from "./history";
import { useCourseDataStore } from "./courseData";
import { useAuditStore } from "./audit";

export type ConnectionsStatus =
  "idle" | "loading" | "ready" | "empty" | "error";

/** Node geometry, shared by the renderer and edge trimming. Cards are
 *  stadiums: full-round end caps, so the cap radius is half the height and
 *  the width carries ~16px of cap curvature the content cannot use. */
export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 78;
export const NODE_HEIGHT_COMPACT = 40;
/** Below this zoom the cards drop titles and badges. */
export const COMPACT_ZOOM = 0.55;
/** Clearance between a card's border and where its edges start. */
const EDGE_GAP = 7;

/** A one-shot ask for the canvas to bring nodes into view (fit when no ids). */
export interface FrameRequest {
  token: number;
  ids?: string[];
  /**
   * Lowest zoom the fit may choose. The opening fit floors at COMPACT_ZOOM:
   * a big road then opens on a readable center to pan from, instead of
   * framing every subject as an unreadable sliver.
   */
  floor?: number;
}

/** Where a freshly revealed node animates in from (decorative only). */
export interface RevealMeta {
  dx: number;
  dy: number;
  delay: number;
}

export interface NodeView {
  id: string;
  subject: Subject;
  x: number;
  y: number;
  deptClass: string;
  color: string;
  anchor: boolean;
  /**
   * Tinted on the canvas as the exploration's landmark. Only a deliberate
   * starting subject earns this; on a road seed every node is an anchor, and
   * a tint that marks the normal case would say nothing.
   */
  landmark: boolean;
  pinned: boolean;
  focused: boolean;
  /** The pointer is on this node (or its side-panel row). */
  hovered: boolean;
  /** Outside the focused node's neighborhood while one is emphasized. */
  dimmed: boolean;
  status?: "planned" | "taken";
  requirementBadge?: string;
  readiness?: Readiness;
  readinessLabel?: string;
  offered: boolean;
  hasMore: boolean;
  expanded: boolean;
  justAdded: boolean;
  reveal?: RevealMeta;
}

export interface EdgeView {
  id: string;
  primaryType: EdgeType;
  crossing: boolean;
  weight: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Screen-space endpoints of the prereq arrow (prerequisite → dependent). */
  arrow?: { fromX: number; fromY: number; toX: number; toY: number };
  reasons: EdgeReason[];
  title: string;
  /** Incident to the emphasized (selected/hovered) node. */
  active: boolean;
  /** Outside the emphasized node's neighborhood. */
  dimmed: boolean;
  /** Freshly revealed; fades in after its endpoints land. */
  entering: boolean;
}

export const useConnectionsStore = defineStore("connections", () => {
  const courseData = useCourseDataStore();
  const audit = useAuditStore();

  // Non-reactive engine: rebuilt only when the catalog array identity changes.
  let engine: EdgeEngine | undefined;
  let engineForSubjects: Subject[] | undefined;
  // Per-tab snapshot so a reload keeps the exploration. Consent must be
  // granted, not merely unrefused: an unanswered banner stores nothing, and
  // opting out keeps the exploration in memory only.
  const persistence: ConnectionsPersistence = new SessionConnectionsPersistence(
    () => courseData.cookiesAllowed === true,
  );

  const graph = shallowRef<GraphState>(emptyGraphState());
  const layout = shallowRef<LayoutState>(emptyLayout());
  const viewport = ref<Viewport>({ x: 0, y: 0, zoom: 1 });
  const seed = ref<Seed>({ subjectIds: [], origin: "road" });
  const selectedId = ref<string | undefined>(undefined);
  const hiddenTypes = ref<Set<EdgeType>>(new Set());
  const status = ref<ConnectionsStatus>("idle");
  const justAdded = ref<Set<string>>(new Set());
  const revealMeta = ref<Map<string, RevealMeta>>(new Map());
  const enteringEdges = ref<Set<string>>(new Set());
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;

  /** Pointer-hover subject (canvas node or its panel row). */
  const hoverId = ref<string | undefined>(undefined);
  /** Debounced canvas hover driving neighborhood emphasis. */
  const emphasisId = ref<string | undefined>(undefined);
  let emphasisTimer: ReturnType<typeof setTimeout> | undefined;

  /** A pending "add to road" awaiting a term choice (the inline picker). */
  const placementRequest = ref<Subject | undefined>(undefined);

  /**
   * Pending viewport ask, consumed by the canvas: fit everything when `ids`
   * is absent, otherwise make sure those nodes are inside the view. State
   * mutations only ever *request* framing; the canvas owns the camera.
   */
  const frameRequest = ref<FrameRequest | undefined>(undefined);
  let frameToken = 0;
  function requestFrame(ids?: string[], floor?: number): void {
    frameRequest.value = { token: ++frameToken, ids, floor };
  }

  function ensureEngine(): EdgeEngine | undefined {
    const catalog = courseData.catalog;
    if (catalog.subjectsInfo.length === 0) {
      return undefined;
    }
    if (engine === undefined || engineForSubjects !== catalog.subjectsInfo) {
      engine = new EdgeEngine(catalog);
      engineForSubjects = catalog.subjectsInfo as Subject[];
    }
    return engine;
  }

  /* ---------------------------------------------------- derived context */

  /** Subjects on the active road → planned/taken by their earliest bucket. */
  const roadStatus = computed(() => {
    const map = new Map<string, "planned" | "taken">();
    const road = courseData.activeRoadObject;
    if (road === undefined) {
      return map;
    }
    const buckets = road.contents.selectedSubjects;
    for (let bucket = 0; bucket < buckets.length; bucket++) {
      const taken = bucket < courseData.currentSemester;
      for (const placed of buckets[bucket]) {
        const prev = map.get(placed.subject_id);
        if (prev === undefined || (taken && prev === "planned")) {
          map.set(placed.subject_id, taken ? "taken" : "planned");
        }
      }
    }
    return map;
  });

  /** Open attribute requirements across every program on the active road. */
  const openRequirements = computed(() => {
    const open = new Set<string>();
    const walk = (node: RequirementNode) => {
      if (node.reqs !== undefined) {
        node.reqs.forEach(walk);
        return;
      }
      if (!node.fulfilled && node.req !== undefined) {
        open.add(node.req);
      }
    };
    for (const tree of Object.values(audit.reqTrees)) {
      walk(tree as RequirementNode);
    }
    return open;
  });

  /**
   * Memoized "can I take this, and when?" evaluator, rebuilt whenever the
   * road or catalog changes (the computed reads both deeply).
   */
  const readinessEvaluator = computed(() => {
    const road = courseData.activeRoadObject;
    return createReadinessEvaluator(
      courseData.catalog,
      road?.contents.selectedSubjects ?? [],
      courseData.currentSemester,
    );
  });

  /** Readiness for a subject not already on the road (else undefined). */
  function readinessFor(subject: Subject): Readiness | undefined {
    if (roadStatus.value.has(subject.subject_id)) {
      return undefined;
    }
    return readinessEvaluator.value(subject);
  }

  const baseYearValue = computed(() => baseYear(courseData.userYear));

  /** "Fall ’27"-style name for a road bucket. */
  function termName(index: number): string {
    if (index === 0) {
      return "Prior credit";
    }
    return `${semesterType(index)} ’${semesterCalendarYearShort(index, baseYearValue.value)}`;
  }

  /** Chip copy for a readiness value; undefined when we shouldn't claim one. */
  function readinessLabel(readiness: Readiness): string | undefined {
    switch (readiness.kind) {
      case "ready":
        return "Ready now";
      case "ready-after":
        return readiness.term >= NUM_SEMESTERS
          ? "Ready after your plan"
          : `Ready ${termName(readiness.term)}`;
      case "missing": {
        const n = readiness.missing.length;
        const plus = readiness.approximate ? "+" : "";
        return `${n}${plus} prereq${n === 1 && !readiness.approximate ? "" : "s"} away`;
      }
      case "unknown":
        return undefined;
    }
  }

  /** A short badge if `subject` fills an open attribute requirement. */
  function requirementBadge(subject: Subject): string | undefined {
    const open = openRequirements.value;
    for (const attr of (subject.hass_attribute ?? "").split(",")) {
      if (attr !== "" && open.has(attr)) {
        return `Fills ${attr}`;
      }
    }
    const ci = subject.communication_requirement;
    if (ci !== undefined && open.has(ci)) {
      return `Fills ${ci}`;
    }
    const gir = subject.gir_attribute;
    if (gir !== undefined) {
      if (open.has("GIR:LAB") && gir.includes("LAB")) {
        return "Fills Lab GIR";
      }
      if (open.has("GIR:REST") && gir.includes("REST")) {
        return "Fills REST GIR";
      }
    }
    return undefined;
  }

  /* --------------------------------------------------------- view models */

  /**
   * The emphasized node (debounced hover, else selection) and everything
   * one edge away from it. Drives the calm dim/brighten conversation;
   * opacity only, never positions.
   */
  const neighborhood = computed<
    { focus: string; nodeIds: Set<string>; edgeIds: Set<string> } | undefined
  >(() => {
    const focus = emphasisId.value ?? selectedId.value;
    if (focus === undefined || !graph.value.nodes.has(focus)) {
      return undefined;
    }
    const nodeIds = new Set<string>([focus]);
    const edgeIds = new Set<string>();
    for (const edge of graph.value.edges.values()) {
      if (edge.a === focus || edge.b === focus) {
        edgeIds.add(edge.id);
        nodeIds.add(edge.a === focus ? edge.b : edge.a);
      }
    }
    return { focus, nodeIds, edgeIds };
  });

  const nodes = computed<NodeView[]>(() => {
    const e = engine;
    const catalog = courseData.catalog;
    const hood = neighborhood.value;
    const out: NodeView[] = [];
    for (const node of graph.value.nodes.values()) {
      const subject = getSubject(catalog, node.id);
      if (subject === undefined) {
        continue;
      }
      const point = layout.value.positions.get(node.id) ?? { x: 0, y: 0 };
      const readiness = readinessFor(subject);
      out.push({
        id: node.id,
        subject,
        x: point.x,
        y: point.y,
        deptClass: courseColorClassFromId(node.id),
        color: courseColor(subject),
        anchor: node.anchor,
        landmark: node.anchor && seed.value.origin !== "road",
        pinned: graph.value.pinned.has(node.id),
        focused: selectedId.value === node.id,
        hovered: hoverId.value === node.id,
        dimmed: hood !== undefined && !hood.nodeIds.has(node.id),
        status: roadStatus.value.get(node.id),
        requirementBadge: requirementBadge(subject),
        readiness,
        readinessLabel:
          readiness === undefined ? undefined : readinessLabel(readiness),
        offered: !(subject.is_historical || subject.not_offered_year),
        hasMore: e !== undefined && hasMoreNeighbors(graph.value, e, node.id),
        expanded: graph.value.expanded.has(node.id),
        justAdded: justAdded.value.has(node.id),
        reveal: revealMeta.value.get(node.id),
      });
    }
    return out;
  });

  function edgeVisible(edge: GraphEdge): boolean {
    return !hiddenTypes.value.has(edge.primaryType);
  }

  /** Cards drop titles and badges when zoomed far out. */
  const compact = computed(() => viewport.value.zoom < COMPACT_ZOOM);

  /**
   * Fraction of the segment a→b consumed before a line leaving a card's
   * center clears the card's outline (plus EDGE_GAP). The cards are
   * stadiums: a core rectangle with half-circle end caps of radius halfH,
   * so a flat exit uses the slab and an end exit intersects the cap circle.
   * Lets edges meet the drawn border instead of a bounding-box corner.
   */
  function exitFraction(dx: number, dy: number, halfH: number): number {
    const halfW = NODE_WIDTH / 2 + EDGE_GAP;
    const coreHalfW = Math.max(0, halfW - halfH);
    if (dy !== 0) {
      const tFlat = halfH / Math.abs(dy);
      if (Math.abs(dx) * tFlat <= coreHalfW) {
        return tFlat;
      }
    } else if (dx === 0) {
      return 0;
    }
    // cap exit: intersect the ray with the end circle on the leaving side
    const cx = Math.sign(dx) * coreHalfW;
    const a = dx * dx + dy * dy;
    const b = dx * cx;
    const c = cx * cx - halfH * halfH;
    const disc = b * b - a * c;
    if (a === 0 || disc <= 0) {
      return 0;
    }
    return (b + Math.sqrt(disc)) / a;
  }

  const edges = computed<EdgeView[]>(() => {
    const positions = layout.value.positions;
    const hood = neighborhood.value;
    const halfH =
      (compact.value ? NODE_HEIGHT_COMPACT : NODE_HEIGHT) / 2 + EDGE_GAP;
    const out: EdgeView[] = [];
    for (const edge of graph.value.edges.values()) {
      if (!edgeVisible(edge)) {
        continue;
      }
      const a = positions.get(edge.a);
      const b = positions.get(edge.b);
      if (a === undefined || b === undefined) {
        continue;
      }
      // trim both ends to the card boundaries (cards share one size, so one
      // fraction serves both); collapse when the cards overlap so nothing
      // pokes out from underneath
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = exitFraction(dx, dy, halfH);
      const overlapping = t * 2 >= 1;
      const x1 = overlapping ? (a.x + b.x) / 2 : a.x + dx * t;
      const y1 = overlapping ? (a.y + b.y) / 2 : a.y + dy * t;
      const x2 = overlapping ? (a.x + b.x) / 2 : b.x - dx * t;
      const y2 = overlapping ? (a.y + b.y) / 2 : b.y - dy * t;
      let arrow: EdgeView["arrow"];
      if (edge.arrow !== undefined && !overlapping) {
        // tip at the dependent card's boundary, tail at the other end
        const towardB = edge.arrow.to === edge.b;
        arrow = towardB
          ? { fromX: x1, fromY: y1, toX: x2, toY: y2 }
          : { fromX: x2, fromY: y2, toX: x1, toY: y1 };
      }
      out.push({
        id: edge.id,
        primaryType: edge.primaryType,
        crossing: edge.crossing,
        weight: edge.weight,
        x1,
        y1,
        x2,
        y2,
        arrow,
        reasons: edge.reasons,
        title: edge.reasons.map((r) => r.label).join(" · "),
        active: hood !== undefined && hood.edgeIds.has(edge.id),
        dimmed: hood !== undefined && !hood.edgeIds.has(edge.id),
        entering: enteringEdges.value.has(edge.id),
      });
    }
    return out;
  });

  const rankedNeighbors = computed<RankedNeighbor[]>(() => {
    const e = engine;
    if (e === undefined || selectedId.value === undefined) {
      return [];
    }
    const onCanvas = (id: string) => graph.value.nodes.has(id);
    return rankNeighbors(e, selectedId.value, {
      catalog: courseData.catalog,
      roadStatus: roadStatus.value,
      requirementBadge,
      onCanvas,
      readiness: (subject) => readinessEvaluator.value(subject),
    });
  });

  const selectedSubject = computed<Subject | undefined>(() =>
    selectedId.value === undefined
      ? undefined
      : getSubject(courseData.catalog, selectedId.value),
  );

  const nodeCount = computed(() => graph.value.nodes.size);
  const overBudget = computed(() => nodeCount.value > SOFT_NODE_BUDGET);
  const atCeiling = computed(() => nodeCount.value >= HARD_NODE_CEILING);

  /* ---------------------------------------------------------- mutations */

  function relayout(): void {
    layout.value = reconcileLayout(layout.value, graph.value);
  }

  function persist(): void {
    persistence.save(serializeGraph(graph.value, seed.value, viewport.value));
  }

  /** How far back toward the seed's center a fresh node starts its glide. */
  const SEED_GLIDE = 0.4;

  /**
   * Mark freshly revealed nodes/edges for their decorative entrance: nodes
   * glide in from the node that revealed them, strongest connection first.
   * A seed has no revealer, so its nodes bloom outward from the center
   * instead, inner ring first. Edges fade in after. Visual only: final
   * positions come from the layout.
   */
  function pulse(
    nodeIds: string[],
    edgeIds: string[] = [],
    origin?: string,
  ): void {
    if (nodeIds.length === 0 && edgeIds.length === 0) {
      return;
    }
    const positions = layout.value.positions;
    const from = origin === undefined ? undefined : positions.get(origin);
    let center = { x: 0, y: 0 };
    let ordered = nodeIds; // expansion: rank order (Map insertion order)
    if (origin === undefined) {
      let sx = 0;
      let sy = 0;
      for (const id of nodeIds) {
        const p = positions.get(id) ?? { x: 0, y: 0 };
        sx += p.x;
        sy += p.y;
      }
      center = { x: sx / nodeIds.length, y: sy / nodeIds.length };
      // inside-out; the 8px bucket makes one ring one beat despite float
      // noise, and the stable sort keeps each ring in angular order
      const radial = (id: string) => {
        const p = positions.get(id) ?? { x: 0, y: 0 };
        return Math.round(Math.hypot(p.x - center.x, p.y - center.y) / 8);
      };
      ordered = [...nodeIds].sort((p, q) => radial(p) - radial(q));
    }
    const nextAdded = new Set(justAdded.value);
    const nextMeta = new Map(revealMeta.value);
    ordered.forEach((id, index) => {
      const point = positions.get(id);
      nextAdded.add(id);
      let dx = 0;
      let dy = 0;
      if (point !== undefined) {
        if (from !== undefined) {
          dx = from.x - point.x;
          dy = from.y - point.y;
        } else {
          dx = (center.x - point.x) * SEED_GLIDE;
          dy = (center.y - point.y) * SEED_GLIDE;
        }
      }
      nextMeta.set(id, {
        dx,
        dy,
        delay: Math.min(index * (origin !== undefined ? 45 : 25), 450),
      });
    });
    justAdded.value = nextAdded;
    revealMeta.value = nextMeta;
    if (edgeIds.length > 0) {
      const nextEdges = new Set(enteringEdges.value);
      for (const id of edgeIds) {
        nextEdges.add(id);
      }
      enteringEdges.value = nextEdges;
    }
    if (pulseTimer !== undefined) {
      clearTimeout(pulseTimer);
    }
    pulseTimer = setTimeout(() => {
      justAdded.value = new Set();
      revealMeta.value = new Map();
      enteringEdges.value = new Set();
    }, 1200);
  }

  function commit(
    next: GraphState,
    options: { relayout?: boolean; origin?: string } = {},
  ): string[] {
    const beforeNodes = new Set(graph.value.nodes.keys());
    const beforeEdges = new Set(graph.value.edges.keys());
    graph.value = next;
    if (options.relayout !== false) {
      relayout();
    }
    const addedNodes = [...next.nodes.keys()].filter(
      (id) => !beforeNodes.has(id),
    );
    const addedEdges = [...next.edges.keys()].filter(
      (id) => !beforeEdges.has(id),
    );
    pulse(addedNodes, addedEdges, options.origin);
    persist();
    return addedNodes;
  }

  function sameSeed(a: Seed, b: Seed): boolean {
    return (
      a.origin === b.origin &&
      a.subjectIds.length === b.subjectIds.length &&
      [...a.subjectIds].sort().join() === [...b.subjectIds].sort().join()
    );
  }

  /**
   * Everything a destructive action (reset, re-seed) replaces. Held by
   * reference safely: graph/layout mutators are all copy-on-write, so
   * nothing written after this snapshot can corrupt the way back.
   */
  interface RestorePoint {
    graph: GraphState;
    layout: LayoutState;
    seed: Seed;
    viewport: Viewport;
    selectedId: string | undefined;
    status: ConnectionsStatus;
  }

  function captureRestorePoint(): RestorePoint {
    return {
      graph: graph.value,
      layout: layout.value,
      seed: seed.value,
      viewport: viewport.value,
      selectedId: selectedId.value,
      status: status.value,
    };
  }

  function restore(point: RestorePoint): void {
    graph.value = point.graph;
    layout.value = point.layout;
    seed.value = point.seed;
    viewport.value = point.viewport;
    selectedId.value = point.selectedId;
    status.value = point.status;
    persist();
  }

  /** Did the action actually take away something worth offering back? */
  function tookSomethingAway(before: RestorePoint): boolean {
    return !(
      sameSeed(before.seed, seed.value) &&
      graph.value.nodes.size === before.graph.nodes.size &&
      graph.value.edges.size === before.graph.edges.size &&
      before.graph.removed.size === 0 &&
      before.graph.expanded.size === 0
    );
  }

  /** Collect the real, explorable subjects on the active road, deduped. */
  function roadSeedIds(): string[] {
    const road = courseData.activeRoadObject;
    if (road === undefined) {
      return [];
    }
    const e = ensureEngine();
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const bucket of road.contents.selectedSubjects) {
      for (const placed of bucket) {
        const id = placed.subject_id;
        if (!seen.has(id) && e !== undefined && e.isExplorable(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
    }
    return ids;
  }

  function startFromSeed(newSeed: Seed): void {
    const e = ensureEngine();
    if (e === undefined) {
      status.value = "error";
      return;
    }
    if (newSeed.subjectIds.length === 0) {
      seed.value = newSeed;
      graph.value = emptyGraphState();
      layout.value = emptyLayout();
      status.value = "empty";
      return;
    }
    const saved = persistence.load();
    const restored = saved !== undefined && sameSeed(saved.seed, newSeed);
    if (restored) {
      const { state, viewport: vp } = reconcileSnapshot(saved, e);
      seed.value = newSeed;
      graph.value = state;
      viewport.value = vp;
      relayout();
    } else {
      seed.value = newSeed;
      graph.value = seedGraph(e, newSeed.subjectIds);
      layout.value = reconcileLayout(emptyLayout(), graph.value);
      persist();
    }
    // the opening moment: the map assembles in a quiet wave, never a pop,
    // and stays bright. Only a deliberate seed (deep-link/manual) opens with
    // its subject selected; a road seed waits for the student to point.
    pulse([...graph.value.nodes.keys()]);
    selectedId.value =
      newSeed.origin === "road"
        ? undefined
        : graph.value.anchors.values().next().value;
    status.value = "ready";
    // a fresh seed frames itself, no smaller than full readable cards; a
    // restored one keeps its saved camera
    if (!restored) {
      requestFrame(undefined, COMPACT_ZOOM);
    }
  }

  /**
   * Open an exploration. With a valid `fromId`, seed from that subject;
   * otherwise seed from the active road. Cold/empty/invalid cases resolve to
   * the seed prompt rather than a blank canvas.
   */
  async function open(fromId?: string): Promise<void> {
    status.value = "loading";
    try {
      await courseData.waitLoadSubjects();
    } catch {
      status.value = "error";
      return;
    }
    if (courseData.catalogError) {
      status.value = "error";
      return;
    }
    const e = ensureEngine();
    if (e === undefined) {
      status.value = "error";
      return;
    }
    if (fromId !== undefined && fromId !== "") {
      const resolved = e.resolveId(fromId);
      if (resolved !== undefined && e.isExplorable(resolved)) {
        startFromSeed({ subjectIds: [resolved], origin: "subject" });
        return;
      }
      // invalid deep-link → fall through to a road seed / prompt
    }
    startFromSeed({ subjectIds: roadSeedIds(), origin: "road" });
  }

  /** Seed manually from a chosen subject (cold-start prompt, re-seed). */
  function seedFrom(id: string): void {
    const e = ensureEngine();
    if (e === undefined) {
      return;
    }
    const resolved = e.resolveId(id);
    if (resolved === undefined || !e.isExplorable(resolved)) {
      return;
    }
    persistence.clear();
    startFromSeed({ subjectIds: [resolved], origin: "manual" });
  }

  /** Drop the graph and reseed from the active road, no undo toast. */
  function quietReseedFromRoad(): void {
    persistence.clear();
    startFromSeed({ subjectIds: roadSeedIds(), origin: "road" });
  }

  /**
   * Back to a fresh exploration of the current road. Drops the whole graph,
   * so, like reset, it lands immediately and the toast carries the way back.
   */
  function reseedFromRoad(): void {
    const before = captureRestorePoint();
    quietReseedFromRoad();

    // Nothing to hand back if the canvas was empty, or if re-seeding landed
    // on the same graph it started from (a second click in a row).
    if (before.graph.nodes.size === 0 || !tookSomethingAway(before)) {
      return;
    }
    toast.undoable("Re-seeded from your road", () => {
      restore(before);
      announce("Re-seed undone.");
    });
  }

  // Reseed quietly whenever the active road changes, but only if the canvas is already open and ready.
  watch(
    () => courseData.activeRoad,
    (next, prev) => {
      if (status.value === "ready" && next !== prev && next !== "") {
        quietReseedFromRoad();
      }
    },
  );

  function expand(id: string): void {
    const e = ensureEngine();
    if (e === undefined || atCeiling.value) {
      if (atCeiling.value) {
        announce("Node limit reached. Collapse or remove some to add more.");
      }
      return;
    }
    const added = commit(expandNode(graph.value, e, id), { origin: id });
    if (added.length > 0) {
      requestFrame([id, ...added]);
    }
    announce(
      added.length === 0
        ? "No more connections to show for this subject."
        : `Revealed ${added.length} connected ${added.length === 1 ? "subject" : "subjects"}.`,
    );
  }

  function collapse(id: string): void {
    commit(collapseNode(graph.value, id), { relayout: false });
    announce("Collapsed.");
  }

  function reveal(parentId: string, neighborId: string): void {
    const e = ensureEngine();
    if (e === undefined) {
      return;
    }
    const added = commit(revealNeighbor(graph.value, e, parentId, neighborId), {
      origin: parentId,
    });
    if (added.length > 0) {
      requestFrame(added);
    }
  }

  /**
   * The panel's row click: put the neighbor on the canvas (if it isn't
   * already), select it, and bring it into view. The exploration continues
   * from it without ever leaving the graph.
   */
  function focusNeighbor(parentId: string, neighborId: string): void {
    const e = ensureEngine();
    if (e === undefined) {
      return;
    }
    if (!graph.value.nodes.has(neighborId)) {
      commit(revealNeighbor(graph.value, e, parentId, neighborId), {
        origin: parentId,
      });
      if (!graph.value.nodes.has(neighborId)) {
        return;
      }
      announce(`Revealed ${neighborId} on the graph.`);
    }
    selectedId.value = neighborId;
    requestFrame([neighborId]);
  }

  /** Select a node already on the canvas and bring it into view. */
  function focusNode(id: string): void {
    if (!graph.value.nodes.has(id)) {
      return;
    }
    selectedId.value = id;
    requestFrame([id]);
  }

  /**
   * Put a missing prerequisite on the canvas: ensure the subject that needs
   * it is a node first (revealing it from the selection if necessary), then
   * reveal the prerequisite from it; the unmet requirement becomes the next
   * hop of the exploration.
   */
  function revealMissingPrereq(parentId: string, prereqId: string): void {
    const e = ensureEngine();
    if (e === undefined) {
      return;
    }
    let next = graph.value;
    if (!next.nodes.has(parentId) && selectedId.value !== undefined) {
      next = revealNeighbor(next, e, selectedId.value, parentId);
    }
    if (!next.nodes.has(parentId)) {
      return;
    }
    next = revealNeighbor(next, e, parentId, prereqId);
    commit(next, { origin: parentId });
    if (graph.value.nodes.has(prereqId)) {
      requestFrame([parentId, prereqId]);
      announce(`Revealed ${prereqId}, a missing prerequisite, on the graph.`);
    }
  }

  function pin(id: string): void {
    commit(pinNode(graph.value, id), { relayout: false });
  }

  function unpin(id: string): void {
    commit(unpinNode(graph.value, id), { relayout: false });
  }

  function togglePin(id: string): void {
    if (graph.value.pinned.has(id)) {
      unpin(id);
    } else {
      pin(id);
    }
  }

  function remove(id: string): void {
    if (selectedId.value === id) {
      selectedId.value = undefined;
    }
    commit(removeNode(graph.value, id), { relayout: false });
  }

  /**
   * Back to the seed. Destructive, so it follows the app's undo doctrine:
   * the reset lands immediately and the toast carries the way
   * back to the graph it replaced.
   */
  function reset(): void {
    const e = ensureEngine();
    if (e === undefined) {
      return;
    }
    const before = captureRestorePoint();

    commit(resetGraph(graph.value, e), { relayout: false });
    layout.value = reconcileLayout(layout.value, graph.value);
    requestFrame(undefined, COMPACT_ZOOM);
    announce("Reset to your starting subjects.");

    // Already at the seed: don't offer to take back a no-op.
    if (!tookSomethingAway(before)) {
      return;
    }

    // Deliberately unconditional: whatever happened while the toast was up
    // goes back too. A no-op Undo would be stranger than a clean restore.
    toast.undoable("Reset to your starting subjects", () => {
      restore(before);
      announce("Reset undone.");
    });
  }

  function select(id: string | undefined): void {
    selectedId.value = id;
  }

  /**
   * Pointer hover, from the canvas or the panel. Canvas hover also drives
   * (debounced) neighborhood emphasis; panel-row hover only glows the node,
   * leaving the selection's neighborhood in place.
   */
  function hover(
    id: string | undefined,
    source: "canvas" | "panel" = "canvas",
  ): void {
    hoverId.value = id;
    if (source !== "canvas") {
      return;
    }
    if (emphasisTimer !== undefined) {
      clearTimeout(emphasisTimer);
      emphasisTimer = undefined;
    }
    if (id === undefined) {
      emphasisId.value = undefined;
    } else if (emphasisId.value !== undefined) {
      // already emphasizing: track immediately, no flicker between nodes
      emphasisId.value = id;
    } else {
      emphasisTimer = setTimeout(() => {
        emphasisId.value = id;
      }, 120);
    }
  }

  /* ------------------------------------------------- inline placement */

  /** Begin an inline "add to road"; the term picker opens on this. */
  function requestPlacement(id: string): void {
    const subject = getSubject(courseData.catalog, id);
    if (subject === undefined) {
      return;
    }
    placementRequest.value = subject;
  }

  function cancelPlacement(): void {
    placementRequest.value = undefined;
  }

  /**
   * Place the pending subject into a term, through the road's own add flow
   * (history and undo included), without ever leaving the exploration.
   */
  function confirmPlacement(index: number): void {
    const subject = placementRequest.value;
    if (subject === undefined) {
      return;
    }
    placementRequest.value = undefined;
    courseData.addFromCard(subject);
    // Identify the new entry by reference, not a stack-length delta (unsound
    // at the MAX_ENTRIES cap, where record() pushes and shifts in the same
    // step). Stays undefined if nothing was recorded, making the toast a
    // no-op instead of undoing the wrong thing.
    const stack = history.state.undoStack;
    const topBefore = stack[stack.length - 1];
    courseData.addAtPlaceholder(index);
    const topAfter = stack[stack.length - 1];
    const placementEntry = topAfter !== topBefore ? topAfter : undefined;
    const label = termName(index);
    announce(`Added ${subject.subject_id} to ${label}.`);
    toast.undoable(`Added ${subject.subject_id} to ${label}`, () => {
      if (
        placementEntry !== undefined &&
        history.state.undoStack[history.state.undoStack.length - 1] ===
          placementEntry
      ) {
        history.undo();
      }
    });
  }

  function dragNode(id: string, point: Point): void {
    layout.value = setNodePosition(layout.value, id, point);
  }

  function tidy(): void {
    layout.value = tidyLayout(layout.value, graph.value);
    requestFrame();
  }

  /**
   * Every pan/zoom lands here. The snapshot is refreshed after a quiet
   * moment so a reload reopens on the camera the student last held, without
   * serializing on every pointermove.
   */
  let viewportPersistTimer: ReturnType<typeof setTimeout> | undefined;
  function setViewport(vp: Viewport): void {
    viewport.value = vp;
    if (viewportPersistTimer !== undefined) {
      clearTimeout(viewportPersistTimer);
    }
    viewportPersistTimer = setTimeout(() => {
      viewportPersistTimer = undefined;
      if (status.value === "ready") {
        persist();
      }
    }, 400);
  }

  function toggleType(type: EdgeType): void {
    const next = new Set(hiddenTypes.value);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    hiddenTypes.value = next;
  }

  function retry(): void {
    // retryCatalog can reject (it rethrows a network failure so the
    // caller can react), but it also sets catalogError first, and the
    // template already renders off that reactive flag.
    courseData
      .retryCatalog()
      .then(() => open())
      .catch(() => {});
  }

  return {
    // state
    graph,
    layout,
    viewport,
    seed,
    selectedId,
    hoverId,
    hiddenTypes,
    status,
    placementRequest,
    // derived
    nodes,
    edges,
    compact,
    frameRequest,
    rankedNeighbors,
    selectedSubject,
    nodeCount,
    overBudget,
    atCeiling,
    roadStatus,
    requirementBadge,
    readinessFor,
    readinessLabel,
    termName,
    // actions
    open,
    seedFrom,
    reseedFromRoad,
    requestFrame,
    expand,
    collapse,
    reveal,
    focusNeighbor,
    focusNode,
    revealMissingPrereq,
    pin,
    unpin,
    togglePin,
    remove,
    reset,
    select,
    hover,
    requestPlacement,
    cancelPlacement,
    confirmPlacement,
    dragNode,
    tidy,
    setViewport,
    toggleType,
    retry,
  };
});
