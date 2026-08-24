<template>
  <div ref="hostEl" class="canvas-host" :style="latticeStyle">
    <svg
      ref="svgEl"
      class="canvas-svg"
      :class="{ panning }"
      role="application"
      aria-label="Connections subject graph. Use the side panel for a ranked, keyboard-navigable list of related subjects."
      @pointerdown="onBackgroundPointerDown"
      @pointermove="onBackgroundPointerMove"
      @pointerup="onBackgroundPointerUp"
      @pointercancel="onBackgroundPointerUp"
      @wheel.prevent="onWheel"
    >
      <g
        class="scene"
        :class="{ 'vp-animate': vpAnimating }"
        :style="{ transform: sceneTransform }"
      >
        <template v-if="store.showRowLabels">
          <line
            v-for="r in store.rows"
            :key="'rail-' + r.row"
            class="row-rail"
            :class="{
              'is-unscheduled': r.unscheduled,
              'is-current': r.current,
            }"
            x1="-100"
            :x2="RAIL_LENGTH"
            :y1="r.y"
            :y2="r.y"
          />
          <text
            v-for="r in store.rows"
            :key="'row-' + r.row"
            class="row-label"
            :class="{ 'is-special': r.special, 'is-current': r.current }"
            :x="-LABEL_MARGIN"
            :y="r.y"
            text-anchor="end"
            dominant-baseline="central"
          >
            {{ r.label }}
          </text>
        </template>
        <graph-edge
          v-for="edge in store.edges"
          :key="edge.id"
          :edge="edge"
          :dim="edgesDim"
          @enter="onEdgeEnter"
          @move="onEdgeMove"
          @leave="onEdgeLeave"
        />
        <graph-node
          v-for="node in store.nodes"
          :key="node.id"
          :node="node"
          :compact="store.compact"
          @pointerdown="(e: PointerEvent) => onNodePointerDown(e, node)"
          @toggle="toggle(node)"
          @collapse="store.collapse(node.id)"
          @open="emit('open', node.id)"
          @add="emit('add', node.id)"
          @pin="store.togglePin(node.id)"
          @remove="store.remove(node.id)"
          @hover="(h: boolean) => store.hover(h ? node.id : undefined)"
        />
      </g>
    </svg>

    <!-- "why are these connected?": every reason, right where you're looking -->
    <div
      v-if="edgeCard"
      class="edge-card"
      :style="{ left: `${edgeCard.x}px`, top: `${edgeCard.y}px` }"
      role="tooltip"
    >
      <div class="edge-card-head">
        <span class="edge-card-ids"
          >{{ edgeCardIds[0] }}
          <g-icon name="swap" :size="12" />
          {{ edgeCardIds[1] }}</span
        >
        <span v-if="edgeCard.edge.crossing" class="edge-card-crossing"
          >crossing</span
        >
      </div>
      <ul class="edge-card-reasons">
        <li
          v-for="reason in edgeCard.edge.reasons"
          :key="reason.type + reason.label"
        >
          <span
            class="reason-swatch"
            :class="`t-${reason.type}`"
            aria-hidden="true"
          />
          {{ reason.label }}
        </li>
      </ul>
    </div>

    <div v-if="store.overBudget" class="budget-note" role="status">
      {{ store.nodeCount }} subjects shown.
      <button class="link-btn" @click="store.reset()">Reset</button>
    </div>

    <div class="zoom-controls" role="group" aria-label="Zoom">
      <button aria-label="Zoom in" @click="zoomBy(1.2)">
        <g-icon name="plus" :size="15" />
      </button>
      <button aria-label="Zoom out" @click="zoomBy(1 / 1.2)">
        <span class="minus" aria-hidden="true">–</span>
      </button>
      <button aria-label="Fit graph to view" @click="fit">
        <g-icon name="map" :size="15" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import GraphEdge from "./GraphEdge.vue";
import GraphNode from "./GraphNode.vue";
import GIcon from "../../design/components/GIcon.vue";
import { computeBounds, fitViewport } from "../../lib/connections/layout";
import type { Viewport } from "../../lib/connections/types";
import {
  NODE_HEIGHT,
  NODE_HEIGHT_COMPACT,
  NODE_WIDTH,
  useConnectionsStore,
  type EdgeView,
  type NodeView,
} from "../../stores/connections";
import { useCourseDataStore } from "../../stores/courseData";

const emit = defineEmits<{
  (e: "open", id: string): void;
  (e: "add", id: string): void;
}>();

const store = useConnectionsStore();
const courseData = useCourseDataStore();
const hostEl = ref<HTMLElement>();
const svgEl = ref<SVGSVGElement>();
const panning = ref(false);

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

/* Row labels sit left of column 0, further left than any node position
   computeBounds sees. FIT_LEFT_MARGIN clears the longest label
   ("Unscheduled") so "fit everything" doesn't clip its own labels. */
const LABEL_MARGIN = 140;
const FIT_LEFT_MARGIN = 240;
/* A fixed length, like a printed rule that doesn't shrink to fit what's
   written on it; comfortably past the typical row's card count. */
const RAIL_LENGTH = 2600;

/* CSS transform (not the SVG attribute) so programmatic camera moves can
   transition; pointer input drops the transition class first, so panning
   and zooming stay immediate. */
const sceneTransform = computed(() => {
  const v = store.viewport;
  return `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
});

/** Level of detail: edges fade when far out (cards go compact via the store). */
const edgesDim = computed(() => store.viewport.zoom < 0.42);

/** Lattice spacing in graph units, and the screen band it is kept inside. */
const LATTICE_STEP = 36;
const LATTICE_MIN = 20;
const LATTICE_MAX = 56;

/**
 * The dot lattice, placed in screen space: offset by the pan so it travels
 * with the graph, and doubled or halved to hold a comfortable on-screen
 * spacing, so zooming out never packs it into a haze.
 */
const latticeStyle = computed(() => {
  const v = store.viewport;
  let step = LATTICE_STEP * v.zoom;
  while (step < LATTICE_MIN) {
    step *= 2;
  }
  while (step > LATTICE_MAX) {
    step /= 2;
  }
  return {
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${v.x}px ${v.y}px`,
  };
});

/* ------------------------------------------------------- expand toggle */

function toggle(node: NodeView) {
  if (!node.expanded || node.hasMore) {
    store.expand(node.id);
  } else {
    store.collapse(node.id);
  }
}

/* ------------------------------------------------------- edge hover card */

const edgeCard = ref<{ edge: EdgeView; x: number; y: number } | undefined>();

const edgeCardIds = computed((): [string, string] => {
  const edge = edgeCard.value?.edge;
  if (edge === undefined) {
    return ["", ""];
  }
  const [a, b] = edge.id.split("|");
  return [a, b];
});

function cardPosition(event: PointerEvent): { x: number; y: number } {
  const rect = hostEl.value?.getBoundingClientRect();
  if (rect === undefined) {
    return { x: 0, y: 0 };
  }
  const width = 260;
  const height = 120;
  return {
    x: Math.min(
      Math.max(event.clientX - rect.left + 14, 4),
      rect.width - width,
    ),
    y: Math.min(
      Math.max(event.clientY - rect.top + 14, 4),
      rect.height - height,
    ),
  };
}

function onEdgeEnter(edge: EdgeView, event: PointerEvent) {
  edgeCard.value = { edge, ...cardPosition(event) };
}

function onEdgeMove(event: PointerEvent) {
  if (edgeCard.value !== undefined) {
    edgeCard.value = { edge: edgeCard.value.edge, ...cardPosition(event) };
  }
}

function onEdgeLeave() {
  edgeCard.value = undefined;
}

/* ------------------------------------------------------- pan + zoom */

/* Programmatic camera moves (fit, framing new nodes) animate; any direct
   input cancels the animation so the camera answers the hand instantly. */
const vpAnimating = ref(false);
let vpAnimTimer: ReturnType<typeof setTimeout> | undefined;

function stopViewportAnimation(): void {
  vpAnimating.value = false;
  if (vpAnimTimer !== undefined) {
    clearTimeout(vpAnimTimer);
    vpAnimTimer = undefined;
  }
}

function animateViewportTo(viewport: Viewport): void {
  vpAnimating.value = true;
  store.setViewport(viewport);
  if (vpAnimTimer !== undefined) {
    clearTimeout(vpAnimTimer);
  }
  vpAnimTimer = setTimeout(() => {
    vpAnimating.value = false;
    vpAnimTimer = undefined;
  }, 380);
}

/*
 * Background pointers, one map for both gestures: one finger (or mouse
 * button) pans, two fingers pinch-zoom about their midpoint. The anchor is
 * re-taken whenever the finger count changes, so a gesture never jumps between finger counts.
 */
const bgPointers = new Map<number, { x: number; y: number }>();
let gestureAnchor:
  { x: number; y: number; dist: number; viewport: Viewport } | undefined;

function gesturePoint(): { x: number; y: number; dist: number } {
  const pts = [...bgPointers.values()];
  if (pts.length >= 2) {
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
      dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
    };
  }
  return { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0, dist: 0 };
}

function anchorGesture(): void {
  if (bgPointers.size === 0) {
    gestureAnchor = undefined;
    return;
  }
  gestureAnchor = { ...gesturePoint(), viewport: { ...store.viewport } };
}

function onBackgroundPointerDown(event: PointerEvent) {
  // clicking empty canvas pans and deselects
  store.select(undefined);
  edgeCard.value = undefined;
  stopViewportAnimation();
  bgPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  svgEl.value?.setPointerCapture(event.pointerId);
  anchorGesture();
  panning.value = true;
}

function onBackgroundPointerMove(event: PointerEvent) {
  if (!bgPointers.has(event.pointerId) || gestureAnchor === undefined) {
    return;
  }
  bgPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const anchor = gestureAnchor;
  const live = gesturePoint();
  if (bgPointers.size >= 2 && anchor.dist > 0) {
    const rect = svgEl.value?.getBoundingClientRect();
    if (rect === undefined) {
      return;
    }
    const zoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, anchor.viewport.zoom * (live.dist / anchor.dist)),
    );
    // the graph point under the anchor midpoint follows the live midpoint
    const gx =
      (anchor.x - rect.left - anchor.viewport.x) / anchor.viewport.zoom;
    const gy = (anchor.y - rect.top - anchor.viewport.y) / anchor.viewport.zoom;
    store.setViewport({
      zoom,
      x: live.x - rect.left - gx * zoom,
      y: live.y - rect.top - gy * zoom,
    });
  } else {
    store.setViewport({
      zoom: anchor.viewport.zoom,
      x: anchor.viewport.x + (live.x - anchor.x),
      y: anchor.viewport.y + (live.y - anchor.y),
    });
  }
}

function onBackgroundPointerUp(event: PointerEvent) {
  if (!bgPointers.has(event.pointerId)) {
    return;
  }
  bgPointers.delete(event.pointerId);
  anchorGesture();
  if (bgPointers.size === 0) {
    panning.value = false;
  }
}

/**
 * Trackpad-native wheel: plain scrolling pans the canvas; pinch (which
 * browsers report as ctrl+wheel) and ⌘+wheel zoom about the cursor. The
 * zoom buttons remain for mice.
 */
function onWheel(event: WheelEvent) {
  edgeCard.value = undefined;
  stopViewportAnimation();
  const unit = event.deltaMode === 1 ? 16 : 1;
  if (event.ctrlKey || event.metaKey) {
    const factor = Math.exp(-event.deltaY * unit * 0.0022);
    zoomAt(event.clientX, event.clientY, factor);
  } else {
    const v = store.viewport;
    store.setViewport({
      zoom: v.zoom,
      x: v.x - event.deltaX * unit,
      y: v.y - event.deltaY * unit,
    });
  }
}

function clientToGraph(clientX: number, clientY: number) {
  const rect = svgEl.value?.getBoundingClientRect();
  if (rect === undefined) {
    return { x: 0, y: 0 };
  }
  const v = store.viewport;
  return {
    x: (clientX - rect.left - v.x) / v.zoom,
    y: (clientY - rect.top - v.y) / v.zoom,
  };
}

function zoomAt(clientX: number, clientY: number, factor: number) {
  const rect = svgEl.value?.getBoundingClientRect();
  if (rect === undefined) {
    return;
  }
  const v = store.viewport;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom * factor));
  // keep the point under the cursor stationary
  const px = clientX - rect.left;
  const py = clientY - rect.top;
  const gx = (px - v.x) / v.zoom;
  const gy = (py - v.y) / v.zoom;
  store.setViewport({
    zoom: newZoom,
    x: px - gx * newZoom,
    y: py - gy * newZoom,
  });
}

function zoomBy(factor: number) {
  const rect = svgEl.value?.getBoundingClientRect();
  if (rect === undefined) {
    return;
  }
  stopViewportAnimation();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}

/**
 * The canvas area a frame should aim at. On small screens the node panel
 * rides over the canvas as a bottom sheet, so the strip above it is what
 * the student can actually see.
 */
function visibleCanvasSize(): { width: number; height: number } | undefined {
  const rect = svgEl.value?.getBoundingClientRect();
  if (rect === undefined || rect.width === 0) {
    return undefined;
  }
  let height = rect.height;
  const panel = hostEl.value?.parentElement?.querySelector(".node-panel");
  if (panel !== null && panel !== undefined) {
    const p = panel.getBoundingClientRect();
    // overlaying sheet, so the canvas area above it is what can be seen
    const overlapsX = p.left < rect.right && p.right > rect.left;
    if (p.top < rect.bottom && overlapsX) {
      height = Math.max(160, p.top - rect.top);
    }
  }
  return { width: rect.width, height };
}

function fit() {
  frameNodes();
}

/* ------------------------------------------------------- framing */

/**
 * Serve a frame request: fit everything when no ids are named, otherwise
 * pan (zoom out only, never in) just enough to bring those cards into
 * view. False only when the canvas has no size to aim at.
 */
function frameNodes(ids?: string[], floor?: number): boolean {
  const size = visibleCanvasSize();
  if (size === undefined) {
    return false;
  }
  if (ids === undefined || ids.length === 0) {
    animateViewportTo(
      fitViewport(
        computeBounds(store.layout),
        size.width,
        size.height,
        80,
        floor ?? 0.35,
        1,
        store.showRowLabels ? FIT_LEFT_MARGIN : 0,
      ),
    );
    return true;
  }
  const positions = store.layout.positions;
  const halfW = NODE_WIDTH / 2;
  const halfH = (store.compact ? NODE_HEIGHT_COMPACT : NODE_HEIGHT) / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const id of ids) {
    const p = positions.get(id);
    if (p === undefined) {
      continue;
    }
    found = true;
    minX = Math.min(minX, p.x - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    minY = Math.min(minY, p.y - halfH);
    maxY = Math.max(maxY, p.y + halfH);
  }
  if (!found) {
    return true;
  }
  const pad = 28;
  const v = store.viewport;
  // zoom out only if the named cards cannot fit at the current zoom
  const zoom = Math.max(
    MIN_ZOOM,
    Math.min(
      v.zoom,
      1,
      (size.width - 2 * pad) / Math.max(1, maxX - minX),
      (size.height - 2 * pad) / Math.max(1, maxY - minY),
    ),
  );
  // keep the view center fixed across the zoom change...
  let x = size.width / 2 - ((size.width / 2 - v.x) / v.zoom) * zoom;
  let y = size.height / 2 - ((size.height / 2 - v.y) / v.zoom) * zoom;
  // ...then pan the minimum that brings the bounds inside the padding.
  // This bounds box is built from card positions alone, so it doesn't
  // know a row's label sits further left; reserving FIT_LEFT_MARGIN here
  // (pan only, zoom is already fixed above) keeps a freshly-expanded
  // row's label from landing behind the side panel.
  const labelRoom = store.showRowLabels ? FIT_LEFT_MARGIN : 0;
  const sMinX = (minX - labelRoom) * zoom + x;
  const sMaxX = maxX * zoom + x;
  if (sMinX < pad) {
    x += pad - sMinX;
  } else if (sMaxX > size.width - pad) {
    x -= sMaxX - (size.width - pad);
  }
  const sMinY = minY * zoom + y;
  const sMaxY = maxY * zoom + y;
  if (sMinY < pad) {
    y += pad - sMinY;
  } else if (sMaxY > size.height - pad) {
    y -= sMaxY - (size.height - pad);
  }
  if (x === v.x && y === v.y && zoom === v.zoom) {
    return true;
  }
  animateViewportTo({ x, y, zoom });
  return true;
}

/**
 * Serve the pending frame request. A zero-size canvas (hidden tab,
 * mid-layout) keeps the request pending and retries shortly; dropping it
 * would strand the camera wherever it happened to be.
 */
let frameRetryTimer: ReturnType<typeof setTimeout> | undefined;
function consumeFrameRequest(): void {
  const request = store.frameRequest;
  if (request === undefined) {
    return;
  }
  if (frameNodes(request.ids, request.floor)) {
    store.frameRequest = undefined;
    return;
  }
  if (frameRetryTimer !== undefined) {
    clearTimeout(frameRetryTimer);
  }
  frameRetryTimer = setTimeout(() => {
    frameRetryTimer = undefined;
    consumeFrameRequest();
  }, 120);
}

watch(
  () => store.frameRequest,
  (request) => {
    if (request !== undefined) {
      consumeFrameRequest();
    }
  },
  // after the DOM settles, so a just-opened panel sheet is measurable
  { flush: "post" },
);

// Settings' panel-side choice resizes the canvas; the existing pan/zoom
// was framed for the old area and reads as off-center until reframed.
watch(
  () => courseData.panelSide,
  () => store.requestFrame(),
);

/* ------------------------------------------------------- node drag/select */

function onNodePointerDown(event: PointerEvent, node: NodeView) {
  store.select(node.id);
  stopViewportAnimation();
  const start = clientToGraph(event.clientX, event.clientY);
  const offset = { x: start.x - node.x, y: start.y - node.y };
  let moved = false;
  const move = (e: PointerEvent) => {
    const g = clientToGraph(e.clientX, e.clientY);
    if (
      Math.abs(g.x - start.x) + Math.abs(g.y - start.y) >
      4 / store.viewport.zoom
    ) {
      moved = true;
    }
    if (moved) {
      store.dragNode(node.id, { x: g.x - offset.x, y: g.y - offset.y });
    }
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

/* ------------------------------------------------------- lifecycle */

/**
 * Escape backs out one layer: an open term picker first, then the
 * selection. Inputs and dialogs keep their own Escape.
 */
function onDocKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) {
    return;
  }
  const target = event.target;
  if (target instanceof HTMLElement) {
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable ||
      target.closest('[role="dialog"]') !== null
    ) {
      return;
    }
  }
  if (store.placementRequest !== undefined) {
    store.cancelPlacement();
  } else if (store.selectedId !== undefined) {
    store.select(undefined);
  }
}

defineExpose({ fit });

/** Whether any node's center falls inside the current view. */
function anyNodeVisible(): boolean {
  const rect = svgEl.value?.getBoundingClientRect();
  if (rect === undefined || rect.width === 0) {
    return false;
  }
  const v = store.viewport;
  for (const p of store.layout.positions.values()) {
    const sx = p.x * v.zoom + v.x;
    const sy = p.y * v.zoom + v.y;
    if (sx >= 0 && sx <= rect.width && sy >= 0 && sy <= rect.height) {
      return true;
    }
  }
  return false;
}

onMounted(async () => {
  document.addEventListener("keydown", onDocKeydown);
  // After the mount flush the svg measures synchronously, so no
  // requestAnimationFrame: rAF never fires in a hidden tab, which would
  // leave a pre-mount frame request stranded until the next interaction.
  await nextTick();
  // consume a frame request fired before mount (a fresh seed); a preserved
  // camera stays put unless it opens on nothing, which falls back to a fit
  if (store.frameRequest !== undefined) {
    consumeFrameRequest();
  } else if (store.nodeCount > 0 && !anyNodeVisible()) {
    fit();
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onDocKeydown);
  stopViewportAnimation();
  if (frameRetryTimer !== undefined) {
    clearTimeout(frameRetryTimer);
    frameRetryTimer = undefined;
  }
});
</script>

<style scoped>
.canvas-host {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  /* The lattice surface; the tile's size and offset come from the viewport
     so it moves with the graph. See --canvas-lattice. */
  background-color: var(--g-bg);
  background-image: var(--canvas-lattice);
}
.canvas-svg {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
  touch-action: none;
}
.canvas-svg.panning {
  cursor: grabbing;
}

/* the camera: instant under the hand, eased when the app moves it */
.scene.vp-animate {
  transition: transform var(--motion-deliberate) var(--ease-in-out);
}

/* A ledger line behind each row's cards: solid for a real term, dashed
   for Unscheduled (no real term to point to), the same distinction
   TermCell draws with a dashed border for Prior Credit. Drawn first, so
   it sits under the edges and cards. */
.row-rail {
  stroke: var(--g-line);
  stroke-width: 1.5;
  pointer-events: none;
}
.row-rail.is-unscheduled {
  stroke-dasharray: 8 6;
}
/* The current term: same cardinal cue TermCell's own current-term box
   uses on the plan grid, so the two views share one "you are here".
   Mixed toward the line color, not full-strength --g-brand, since that
   equals the active-prereq-edge color in light mode and would read as
   just another edge. */
.row-rail.is-current {
  stroke: color-mix(in srgb, var(--g-brand) 55%, var(--g-line-strong));
  stroke-width: 2;
}

/* A term label reads as a coordinate, the same register TermCell's own
   season labels use, so it's mono rather than caps. "Prior credit" and
   "Unscheduled" are row names, not column headers, so they stay sans. */
.row-label {
  font: var(--text-id-small);
  fill: var(--g-ink-3);
  pointer-events: none;
  user-select: none;
}
.row-label.is-special {
  font: var(--text-small);
}
.row-label.is-current {
  fill: var(--g-accent);
}
@media (prefers-reduced-motion: reduce) {
  .scene.vp-animate {
    transition: none;
  }
}

.zoom-controls {
  position: absolute;
  right: var(--space-4);
  bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  background: var(--g-surface);
  border: 1px solid var(--g-line);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-2);
  overflow: hidden;
}
.zoom-controls button {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--g-ink-2);
  cursor: pointer;
}
.zoom-controls button:hover {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.zoom-controls button + button {
  border-top: 1px solid var(--g-line);
}
.minus {
  font-size: 18px;
  line-height: 1;
}

.edge-card {
  position: absolute;
  z-index: 5;
  max-width: 280px;
  background: var(--g-surface);
  border: 1px solid var(--g-line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  padding: var(--space-2) var(--space-3);
  pointer-events: none;
}
.edge-card-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}
.edge-card-ids {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-id-small);
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--g-ink);
}
/* a crossing is information, not a caution; warn stays reserved for
   not-offered staleness */
.edge-card-crossing {
  font: var(--text-micro);
  color: var(--g-info);
  background: var(--g-info-tint);
  border-radius: var(--radius-full);
  padding: 0 5px;
}
.edge-card-reasons {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-05);
}
.edge-card-reasons li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink-2);
}
.reason-swatch {
  flex-shrink: 0;
  width: 14px;
  border-top: 2.5px solid var(--swatch-color, var(--g-ink-3));
}
.reason-swatch.t-prereq {
  --swatch-color: var(--g-accent);
}

.budget-note {
  position: absolute;
  top: var(--space-3);
  left: 50%;
  transform: translateX(-50%);
  font: var(--text-small);
  color: var(--g-ink-2);
  background: var(--g-warn-tint);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-3);
  white-space: nowrap;
  max-width: calc(100% - var(--space-6));
}
.link-btn {
  font: var(--text-small);
  font-weight: 600;
  color: var(--g-accent);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 2px;
}

/* clear the fixed bottom navigation on small screens */
@media (max-width: 859px) {
  .zoom-controls {
    bottom: calc(var(--space-4) + 56px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
