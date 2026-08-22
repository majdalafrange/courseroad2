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
    tabindex="0"
    role="button"
    :aria-label="cardAriaLabel"
    @pointerdown="onPointerDown"
    @click.stop="onClick"
    @keydown.enter.prevent.stop="emit('keyboard-move')"
    @keydown.space.prevent.stop="emit('keyboard-move')"
    @keydown.delete="removeSelf"
    @mouseenter="onHoverStart"
    @mouseleave="onHoverEnd"
  >
    <div class="card-body">
      <span class="card-id">
        {{ subject.subject_id
        }}<sub v-if="oldID !== undefined" class="card-old-id">{{ oldID }}</sub>
      </span>
      <span class="card-title">{{ subject.title }}</span>
    </div>

    <button
      class="card-remove"
      aria-label="Remove class"
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
    >
      <template #anchor>
        <button
          class="card-warning"
          :class="{
            'is-quiet': subject.overrideWarnings && !hovering && !warningsOpen,
          }"
          :aria-label="`${warnings.length} ${
            warnings.length === 1 ? 'warning' : 'warnings'
          }`"
          tabindex="-1"
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
        <label class="warning-mute">
          <input
            type="checkbox"
            :checked="subject.overrideWarnings"
            @change="
              store.overrideWarnings({
                override: ($event.target as HTMLInputElement).checked,
                classInfo: subject,
              })
            "
          />
          Mute warnings for this class
        </label>
      </div>
    </g-popover>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import GIcon from "../../design/components/GIcon.vue";
import GPopover from "../../design/components/GPopover.vue";
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
// window must not fire a stale highlight after it's gone. Scoped to this
// subject so removing an unrelated card doesn't clear someone else's.
onBeforeUnmount(() => clearHighlightIfOwnedBy(props.subject.subject_id));

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
  return `${props.subject.subject_id} ${props.subject.title}${warningNote}. Press Enter to move.`;
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

function onClick() {
  if (props.subject.public === false) {
    store.editCustomClass(props.subject);
  } else {
    store.pushClassStack(props.subject.subject_id);
  }
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
  /* Solid department color, not a rail beside it (see tokens.css →
     course chips). */
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
.class-card:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
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

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  padding: var(--space-1) var(--space-4);
}
.card-id {
  font: var(--text-id-small);
  font-weight: 600; /* the id is the atomic unit; it leads by weight */
  color: var(--dept-on);
  white-space: nowrap;
  text-overflow: clip;
  overflow: hidden;
}
.card-old-id {
  font: var(--text-micro);
  color: var(--dept-on-3);
  margin-left: var(--space-1);
}
.card-title {
  font: var(--text-small);
  color: var(--dept-on-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-remove {
  position: absolute;
  top: -7px;
  left: -7px;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-full);
  background: var(--g-ink);
  color: var(--g-bg);
  cursor: pointer;
  z-index: 3;
  box-shadow: var(--shadow-1);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-quick) var(--ease-out);
}
.class-card:hover .card-remove,
.class-card:focus-visible .card-remove {
  opacity: 1;
  pointer-events: auto;
}
/* Touch: nothing reveals a hover-only control, and removing a class has no
   other route (the detail panel moves a class, it does not drop one), so
   the button stays out. Desktop keeps the reveal. */
@media (hover: none) {
  .card-remove {
    opacity: 1;
    pointer-events: auto;
  }
}
.card-remove:hover {
  background: var(--g-danger);
  /* --g-surface, not #fff: dark-theme danger is a pastel that needs the
     near-black on-color (5.6:1); white on it is 1.9:1 */
  color: var(--g-surface);
}

.card-warning {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-full);
  background: var(--g-warn);
  color: var(--g-surface); /* see .card-remove:hover; themed on-color */
  cursor: pointer;
  z-index: 3;
  box-shadow: var(--shadow-1);
  transition: opacity var(--motion-quick) var(--ease-out);
}
.card-warning.is-quiet {
  opacity: 0;
  pointer-events: none;
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
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink-2);
  cursor: pointer;
  border-top: 1px solid var(--g-line);
  padding-top: var(--space-2);
}
.warning-mute input {
  accent-color: var(--g-accent);
}
</style>
