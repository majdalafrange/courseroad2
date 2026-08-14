/**
 * Pointer-based drag-and-drop controller for the planner canvas.
 *
 * Native HTML5 DnD can't deliver a designed ghost, live eligibility, or
 * auto-scroll, so the canvas drives drags from pointer events: a drag
 * starts after a small movement threshold, a ghost element follows the
 * pointer via direct style writes (no per-frame Vue render), term cells
 * register their rects for hit-testing, and the scroll container creeps
 * when the pointer nears its edges.
 */

import { reactive } from "vue";
import { courseColor } from "../lib/colors";
import type { Subject } from "../lib/types";
import { NUM_SEMESTERS, type PlacementStatus } from "../lib/offering";

export interface DragSource {
  subject: Subject;
  /** True when dragged from search/audit (a copy), not from the canvas. */
  isNew: boolean;
  fromSemester?: number;
  fromIndex?: number;
}

interface DragState {
  active: boolean;
  /** Pending = pointer down, threshold not yet crossed. */
  pending: DragSource | null;
  source: DragSource | null;
  hoverTerm: number | null;
  /** Eligibility per bucket index, computed once at drag start. */
  eligibility: (PlacementStatus["kind"] | null)[];
}

export const dragState = reactive<DragState>({
  active: false,
  pending: null,
  source: null,
  hoverTerm: null,
  eligibility: Array(NUM_SEMESTERS).fill(null),
});

type DropHandler = (termIndex: number, source: DragSource) => void;

let startPoint = { x: 0, y: 0 };
/** The element the drag was pressed on; see armClickSwallow. */
let pressedElement: HTMLElement | null = null;
let ghostEl: HTMLElement | null = null;
let scrollContainer: HTMLElement | null = null;
let scrollRaf: number | null = null;
let scrollVelocity = 0;
let dropHandler: DropHandler | null = null;
let eligibilityProvider:
  ((subject: Subject) => PlacementStatus["kind"][]) | null = null;

const termRects = new Map<number, DOMRect>();
const termElements = new Map<number, HTMLElement>();
const dragBeginCallbacks: (() => void)[] = [];

/** Subscribe to drag starts (e.g. so overlays can yield to the canvas). */
export function onDragBegin(callback: () => void): void {
  dragBeginCallbacks.push(callback);
}

export function registerTermElement(
  index: number,
  el: HTMLElement | null,
): void {
  if (el === null) {
    termElements.delete(index);
  } else {
    termElements.set(index, el);
  }
}

export function configureDrag(options: {
  onDrop: DropHandler;
  eligibility: (subject: Subject) => PlacementStatus["kind"][];
  scrollEl: HTMLElement | null;
}): void {
  dropHandler = options.onDrop;
  eligibilityProvider = options.eligibility;
  scrollContainer = options.scrollEl;
}

/** Begin tracking a possible drag (pointer down on a draggable). */
export function pointerDown(event: PointerEvent, source: DragSource): void {
  if (event.button !== 0) {
    return;
  }
  startPoint = { x: event.clientX, y: event.clientY };
  pressedElement =
    event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  dragState.pending = source;
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
}

function beginDrag(event: PointerEvent): void {
  const source = dragState.pending;
  if (source === null) {
    return;
  }
  dragState.pending = null;
  dragState.active = true;
  dragState.source = source;
  dragState.eligibility = eligibilityProvider
    ? eligibilityProvider(source.subject)
    : Array(NUM_SEMESTERS).fill("ok");
  for (const callback of dragBeginCallbacks) {
    callback();
  }
  // Capture rects a frame later so overlays (e.g. the command palette)
  // can close and reveal the canvas first.
  requestAnimationFrame(() => captureTermRects());
  createGhost(source.subject);
  moveGhost(event.clientX, event.clientY);
  document.body.style.cursor = "grabbing";
  document.body.style.userSelect = "none";
}

function captureTermRects(): void {
  termRects.clear();
  for (const [index, el] of termElements) {
    termRects.set(index, el.getBoundingClientRect());
  }
}

function createGhost(subject: Subject): void {
  ghostEl = document.createElement("div");
  ghostEl.className = "drag-ghost";
  const id = document.createElement("span");
  id.className = "drag-ghost-id";
  id.textContent = subject.subject_id;
  const title = document.createElement("span");
  title.className = "drag-ghost-title";
  title.textContent = subject.title ?? "";
  ghostEl.appendChild(id);
  ghostEl.appendChild(title);
  ghostEl.style.setProperty("--ghost-color", courseColor(subject));
  document.body.appendChild(ghostEl);
}

function moveGhost(x: number, y: number): void {
  if (ghostEl !== null) {
    ghostEl.style.transform = `translate3d(${x + 10}px, ${y + 8}px, 0)`;
  }
}

function hitTest(x: number, y: number): number | null {
  for (const [index, rect] of termRects) {
    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      return index;
    }
  }
  return null;
}

function onPointerMove(event: PointerEvent): void {
  if (dragState.pending !== null) {
    const dx = event.clientX - startPoint.x;
    const dy = event.clientY - startPoint.y;
    if (dx * dx + dy * dy > 25) {
      beginDrag(event);
    }
    return;
  }
  if (!dragState.active) {
    return;
  }
  moveGhost(event.clientX, event.clientY);
  dragState.hoverTerm = hitTest(event.clientX, event.clientY);
  updateAutoScroll(event.clientY);
}

function updateAutoScroll(pointerY: number): void {
  if (scrollContainer === null) {
    return;
  }
  const rect = scrollContainer.getBoundingClientRect();
  const zone = 64;
  if (pointerY < rect.top + zone) {
    scrollVelocity = -Math.ceil((rect.top + zone - pointerY) / 6);
  } else if (pointerY > rect.bottom - zone) {
    scrollVelocity = Math.ceil((pointerY - (rect.bottom - zone)) / 6);
  } else {
    scrollVelocity = 0;
  }
  if (scrollVelocity !== 0 && scrollRaf === null) {
    const step = () => {
      if (scrollVelocity === 0 || scrollContainer === null) {
        scrollRaf = null;
        return;
      }
      scrollContainer.scrollTop += scrollVelocity;
      captureTermRects(); // rects shift as we scroll
      scrollRaf = requestAnimationFrame(step);
    };
    scrollRaf = requestAnimationFrame(step);
  }
}

function onPointerUp(event: PointerEvent): void {
  if (dragState.active && dragState.source !== null) {
    const target = hitTest(event.clientX, event.clientY);
    const eligible =
      target !== null && dragState.eligibility[target] !== "unavailable";
    if (target !== null && eligible && dropHandler !== null) {
      dropHandler(target, dragState.source);
    }
  }
  endDrag(true);
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    // No click follows a keyboard cancel; arming the swallower here would
    // eat the user's next unrelated click.
    endDrag(false);
  }
}

/** Backstop, so a drop that draws no click at all leaves nothing armed. */
const CLICK_SWALLOW_MS = 300;

let swallowClick: ((event: MouseEvent) => void) | null = null;
let swallowTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Suppress the click a completed drop synthesizes on the card that was
 * pressed, and nothing else.
 *
 * Only that card's own click has to go: it would otherwise open the class
 * the student just dropped. Every other target passes through, because a
 * drop that carries the card to another term replaces the pressed element
 * and the browser then synthesizes no click at all. Swallowing the next
 * click whatever it landed on meant the student's following click was
 * eaten instead, which is what killed the term's Hydrant link.
 */
function armClickSwallow(): void {
  disarmClickSwallow();
  const pressed = pressedElement;
  swallowClick = (event: MouseEvent) => {
    if (
      pressed !== null &&
      event.target instanceof Node &&
      pressed.contains(event.target)
    ) {
      event.stopPropagation();
      event.preventDefault();
    }
    disarmClickSwallow();
  };
  window.addEventListener("click", swallowClick, { capture: true });
  swallowTimer = setTimeout(disarmClickSwallow, CLICK_SWALLOW_MS);
}

function disarmClickSwallow(): void {
  if (swallowClick !== null) {
    window.removeEventListener("click", swallowClick, { capture: true });
    swallowClick = null;
  }
  if (swallowTimer !== null) {
    clearTimeout(swallowTimer);
    swallowTimer = null;
  }
}

function endDrag(swallowNextClick: boolean): void {
  // A completed drag must not fire the click that follows pointerup;
  // dropping a card would also "open" it.
  if (dragState.active && swallowNextClick) {
    armClickSwallow();
  }
  // armClickSwallow has taken its own reference; releasing it here keeps a
  // card that the drop detached from being held to the next drag.
  pressedElement = null;
  dragState.pending = null;
  dragState.active = false;
  dragState.source = null;
  dragState.hoverTerm = null;
  scrollVelocity = 0;
  if (scrollRaf !== null) {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = null;
  }
  if (ghostEl !== null) {
    ghostEl.remove();
    ghostEl = null;
  }
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("keydown", onKeyDown);
}
