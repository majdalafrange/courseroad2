<template>
  <div
    class="class-card"
    :class="{
      'is-ancestor': relation === 'ancestor',
      'is-dependent': relation === 'dependent',
      'is-dimmed': relation === 'dimmed',
      'is-audit-lit': auditLit,
      'is-dragging': isDragSource,
      'is-move-selected': moveSelected,
      'has-warnings': warnings.length > 0 && !subject.overrideWarnings,
    }"
    :style="{ '--dept-color': cardColor }"
    :data-cy="
      'classInSemester' +
      semesterIndex +
      '_' +
      subject.subject_id.replace('.', '_')
    "
    @pointerdown="onPointerDown"
    @click.stop="onClick"
    @mouseenter="onHoverStart"
    @mouseleave="onHoverEnd"
  >
    <!-- The note popover anchors to the card's main button: a
         double-click (or N) opens it, a single click opens the class. -->
    <g-popover
      v-model="noteOpen"
      class="card-note-anchor"
      align="start"
      placement="bottom"
      :label="`Note for ${subject.subject_id}`"
      @close-auto-focus="onNoteCloseFocus"
    >
      <template #anchor>
        <button
          ref="bodyEl"
          type="button"
          class="card-body"
          :aria-label="cardAriaLabel"
          :aria-describedby="hintId"
          aria-keyshortcuts="M N Delete"
          @keydown.m.exact.prevent="emit('keyboard-move')"
          @keydown.n.exact.prevent="noteOpen = true"
          @keydown.delete.prevent="removeSelf"
          @focus="onHoverStart"
          @blur="onHoverEnd"
        >
          <span class="card-id">
            {{ subject.subject_id
            }}<sub v-if="oldID !== undefined" class="card-old-id"
              >[{{ oldID }}]</sub
            >
          </span>
          <span class="card-title">{{ subject.title }}</span>
          <g-icon
            v-if="note !== undefined"
            name="message"
            :size="11"
            class="card-note-mark"
          />
        </button>
      </template>
      <div class="note-pop" @pointerdown.stop @click.stop>
        <g-textarea
          v-model="noteDraft"
          :label="`Note on ${subject.subject_id}`"
          placeholder="Check prereqs with the professor..."
          :rows="3"
          :maxlength="NOTE_MAX_LENGTH"
          hint="Only you see this. Shared across all roads."
          @keydown.enter.exact.prevent="noteOpen = false"
        />
        <div class="note-actions">
          <g-button
            v-if="note !== undefined"
            size="sm"
            variant="ghost"
            @click="clearNote"
          >
            Remove note
          </g-button>
          <g-button size="sm" variant="primary" @click="noteOpen = false">
            Done
          </g-button>
        </div>
      </div>
    </g-popover>
    <span :id="hintId" hidden>
      Press M to move it to another term, N to
      {{ note !== undefined ? "edit its note" : "add a note" }}, Delete to
      remove it.
    </span>

    <button
      type="button"
      class="card-remove"
      :aria-label="`Remove ${subject.subject_id}`"
      tabindex="-1"
      @pointerdown.stop
      @click.stop="removeSelf"
    >
      <g-icon name="close" :size="11" />
    </button>

    <g-popover
      v-if="warnings.length > 0"
      v-model="warningsOpen"
      align="end"
      placement="bottom"
      :label="`Warnings for ${subject.subject_id}`"
    >
      <template #anchor>
        <button
          type="button"
          class="card-warning"
          :class="{
            'is-quiet': subject.overrideWarnings && !hovering && !warningsOpen,
          }"
          :aria-label="`${warnings.length} ${
            warnings.length === 1 ? 'warning' : 'warnings'
          } for ${subject.subject_id}`"
          aria-haspopup="dialog"
          :aria-expanded="warningsOpen"
          @pointerdown.stop
          @click.stop="warningsOpen = !warningsOpen"
        >
          <g-icon name="warn" :size="13" />
        </button>
      </template>
      <div class="warning-pop" @pointerdown.stop>
        <!-- warning strings embed only FireRoad catalog data -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <p v-for="warning in warnings" :key="warning" v-html="warning" />
        <g-checkbox
          class="warning-mute"
          :model-value="subject.overrideWarnings"
          @update:model-value="
            (override: boolean) =>
              store.overrideWarnings({ override, classInfo: subject })
          "
        >
          Hide warnings for this class
        </g-checkbox>
      </div>
    </g-popover>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
  useId,
  useTemplateRef,
  watch,
} from "vue";
import GButton from "../../design/components/GButton.vue";
import GCheckbox from "../../design/components/GCheckbox.vue";
import GIcon from "../../design/components/GIcon.vue";
import GPopover from "../../design/components/GPopover.vue";
import GTextarea from "../../design/components/GTextarea.vue";
import { courseColor } from "../../lib/colors";
import { placedKey } from "../../lib/consequences";
import type { SelectedSubject, Subject } from "../../lib/types";
import { getSubject } from "../../lib/types";
import { dragState, pointerDown } from "../../stores/dragdrop";
import {
  clearHighlightIfOwnedBy,
  highlightState,
  highlightSubject,
} from "../../stores/highlight";
import { useCourseDataStore } from "../../stores/courseData";
import { NOTE_MAX_LENGTH, useNotesStore } from "../../stores/notes";

const props = defineProps<{
  subject: SelectedSubject;
  semesterIndex: number;
  classIndex: number;
  warnings: string[];
  moveSelected?: boolean;
}>();

const emit = defineEmits<{
  (e: "keyboard-move"): void;
}>();

const store = useCourseDataStore();

// The highlight begins on a 120ms timer; a card removed inside that
// window must not fire it after unmount. Scoped to this subject.
onBeforeUnmount(() => clearHighlightIfOwnedBy(props.subject.subject_id));

const hintId = `card-hint-${useId()}`;
const warningsOpen = ref(false);
const hovering = ref(false);

const cardColor = computed(() => courseColor(props.subject));

const oldID = computed(() => {
  if (props.subject.public === false) {
    return undefined;
  }
  const subjectIndex = store.subjectsIndex[props.subject.subject_id];
  return subjectIndex !== undefined
    ? store.subjectsInfo[subjectIndex].old_id
    : undefined;
});

const myKey = computed(() => placedKey(props.semesterIndex, props.classIndex));

type Relation = "none" | "ancestor" | "dependent" | "dimmed";

const relation = computed<Relation>(() => {
  if (highlightState.subjectId === null) {
    return "none";
  }
  if (highlightState.subjectId === props.subject.subject_id) {
    return "none"; // the hovered card itself stays full strength
  }
  if (highlightState.ancestors.has(myKey.value)) {
    return "ancestor";
  }
  if (highlightState.dependents.has(myKey.value)) {
    return "dependent";
  }
  return "dimmed";
});

const isDragSource = computed(
  () =>
    dragState.active &&
    dragState.source?.fromSemester === props.semesterIndex &&
    dragState.source?.fromIndex === props.classIndex,
);

/** Audit → canvas: lit when a hovered requirement is satisfied by us. */
const auditLit = computed(() =>
  highlightState.auditCourses.has(props.subject.subject_id),
);

const cardAriaLabel = computed(() => {
  const warningNote =
    props.warnings.length > 0
      ? `, ${props.warnings.length} ${
          props.warnings.length === 1 ? "warning" : "warnings"
        }`
      : "";
  const noteText = note.value !== undefined ? `, note: ${note.value}` : "";
  return `${props.subject.subject_id} ${props.subject.title}${warningNote}${noteText}`;
});

const fullSubject = computed<Subject>(() => {
  return (
    getSubject(store.catalog, props.subject.subject_id) ??
    (props.subject as unknown as Subject)
  );
});

function onPointerDown(event: PointerEvent) {
  if (props.subject.public === false) {
    // custom activities are draggable too
  }
  pointerDown(event, {
    subject: fullSubject.value,
    isNew: false,
    fromSemester: props.semesterIndex,
    fromIndex: props.classIndex,
  });
}

function openClass() {
  if (props.subject.public === false) {
    store.editCustomClass(props.subject);
  } else {
    store.pushClassStack(props.subject.subject_id);
  }
}

/* ---- click vs double-click ----
   A double-click opens the note, but its first click arrives as a plain
   click. A pointer click therefore waits out the double-click window
   before opening the class; a second click inside it opens the note
   instead. A keyboard click (Enter, Space: detail 0) can't be the start
   of a double-click, so it opens the class at once. */
const DOUBLE_CLICK_MS = 250;
let clickTimer: ReturnType<typeof setTimeout> | undefined;

function onClick(event: MouseEvent) {
  clearTimeout(clickTimer);
  clickTimer = undefined;
  if (event.detail === 0) {
    openClass();
  } else if (event.detail >= 2) {
    noteOpen.value = true;
  } else {
    clickTimer = setTimeout(() => {
      clickTimer = undefined;
      openClass();
    }, DOUBLE_CLICK_MS);
  }
}
onBeforeUnmount(() => clearTimeout(clickTimer));

/* ---- the note: a draft while open, saved when it closes (Done, Enter,
   Escape, or a click away), since it is a jotting, not a form ---- */
const notesStore = useNotesStore();
// One note per subject (FireRoad keeps them by subject id), so every card
// for this subject shows the same one.
const note = computed(() => notesStore.noteFor(props.subject.subject_id));
const noteOpen = ref(false);
const noteDraft = ref("");
const bodyEl = useTemplateRef("bodyEl");

watch(noteOpen, (open) => {
  if (open) {
    noteDraft.value = note.value ?? "";
    return;
  }
  notesStore.setNote(props.subject.subject_id, noteDraft.value);
});

/* The popover is anchored, not triggered, so Reka has nowhere to send
   focus on close. It goes back to the card, unless the close came from
   the student moving on to something else. */
function onNoteCloseFocus(event: Event) {
  event.preventDefault();
  const active = document.activeElement;
  const stranded =
    active === null ||
    active === document.body ||
    active.closest(".note-pop") !== null;
  if (stranded) {
    bodyEl.value?.focus();
  }
}

function clearNote() {
  noteDraft.value = "";
  noteOpen.value = false;
}

function removeSelf() {
  clearHighlightIfOwnedBy(props.subject.subject_id);
  store.removeClass({
    classInfo: props.subject,
    classIndex: props.classIndex,
  });
}

function onHoverStart() {
  hovering.value = true;
  const road = store.roads[store.activeRoad];
  if (road !== undefined && props.subject.public !== false) {
    highlightSubject(
      fullSubject.value,
      road.contents.selectedSubjects,
      store.catalog,
    );
  }
}

function onHoverEnd() {
  hovering.value = false;
  clearHighlightIfOwnedBy(props.subject.subject_id);
}
</script>

<style scoped>
.class-card {
  position: relative;
  display: flex;
  align-items: stretch;
  /* Solid department color (see tokens.css, course chips). */
  background: var(--dept-color, var(--g-line-strong));
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-1);
  cursor: grab;
  user-select: none;
  overflow: visible;
  min-height: 44px;
  /* Settle into place when a card mounts (drop, move, or first paint). */
  animation: card-settle var(--motion-standard) var(--ease-settle);
  transition:
    box-shadow var(--motion-quick) var(--ease-out),
    transform var(--motion-quick) var(--ease-out),
    opacity var(--motion-quick) var(--ease-out);
}
@keyframes card-settle {
  0% {
    opacity: 0;
    transform: translateY(-4px) scale(0.985);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .class-card {
    animation: none;
  }
}
.class-card:hover {
  box-shadow: var(--shadow-15);
  transform: translateY(-1px);
}
.class-card:has(.card-body:focus-visible) {
  box-shadow: var(--g-focus-ring);
}
.card-body:focus-visible {
  outline: none;
}
.class-card.is-dragging {
  opacity: 0.35;
}
.class-card.is-dimmed {
  opacity: 0.45;
}
.class-card.is-ancestor {
  box-shadow:
    0 0 0 2px var(--g-ok),
    var(--shadow-1);
}
.class-card.is-dependent {
  box-shadow:
    0 0 0 2px var(--g-accent),
    var(--shadow-1);
}
.class-card.is-move-selected {
  box-shadow:
    0 0 0 2px var(--g-accent),
    0 0 0 5px var(--g-accent-tint-strong);
}
.class-card.is-audit-lit {
  box-shadow:
    0 0 0 2px var(--g-ok),
    0 0 0 5px var(--g-ok-tint);
}

/* The note popover's anchor wraps the card body; it takes the body's
   place in the card's row. */
.class-card > :deep(.card-note-anchor) {
  flex: 1;
  min-width: 0;
  display: flex;
}
.card-body {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  padding: var(--space-1) var(--space-4);
  font: inherit;
  text-align: left;
  color: inherit;
  background: none;
  border: none;
  border-radius: inherit;
  cursor: inherit;
}
.card-id {
  font: var(--text-id-small);
  font-weight: 700; /* the id is the atomic unit; it leads by weight */
  color: var(--dept-on);
  white-space: nowrap;
  text-overflow: clip;
  overflow: hidden;
}
.card-old-id {
  font: var(--text-id-micro);
  color: var(--dept-on-3);
}
.card-title {
  font: var(--text-small);
  color: var(--dept-on-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The card's corner badges. Each button is a 24px target (WCAG 2.5.8);
   the disc drawn in it (::after) stays 20px, and the offsets keep the
   disc where it sat when the button was the disc. */
.card-remove,
.card-warning {
  position: absolute;
  top: -9px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-full);
  padding: 0;
  background: transparent;
  cursor: pointer;
  z-index: 3;
}
.card-remove::after,
.card-warning::after {
  content: "";
  position: absolute;
  inset: 2px;
  border-radius: var(--radius-full);
  background: var(--badge-fill);
  box-shadow: var(--shadow-1);
  transition: background-color var(--motion-quick) var(--ease-out);
}
/* the icon paints over the disc */
.card-remove > *,
.card-warning > * {
  position: relative;
  z-index: 1;
}
.card-remove {
  left: -9px;
  --badge-fill: var(--g-ink);
  color: var(--g-bg);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-quick) var(--ease-out);
}
.class-card:hover .card-remove,
.class-card:has(.card-body:focus-visible) .card-remove {
  opacity: 1;
  pointer-events: auto;
}
/* Touch: nothing reveals a hover-only control, and removing a class has
   no other route, so the button stays visible. */
@media (hover: none) {
  .card-remove {
    opacity: 1;
    pointer-events: auto;
  }
}
.card-remove:hover {
  --badge-fill: var(--g-danger);
  /* --g-surface, not #fff: dark-theme danger needs the near-black
     on-color (5.6:1); white on it is 1.9:1 */
  color: var(--g-surface);
}

.card-warning {
  right: -9px;
  --badge-fill: var(--g-warn);
  color: var(--g-surface); /* see .card-remove:hover; themed on-color */
  transition: opacity var(--motion-quick) var(--ease-out);
}
.card-warning.is-quiet:not(:focus-visible) {
  opacity: 0;
  pointer-events: none;
}
.card-warning:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

/* A note is on this placement: a small mark at the card's right edge;
   the text itself is in the card's accessible name and the popover. */
.card-note-mark {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-1);
  color: var(--dept-on-2);
}

.note-pop {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.note-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.warning-pop {
  width: 280px;
  font: var(--text-small);
  color: var(--g-ink);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.warning-pop p {
  margin: 0;
}
.warning-mute {
  font: var(--text-small);
  color: var(--g-ink-2);
  border-top: 1px solid var(--g-line);
  padding-top: var(--space-2);
}
</style>
