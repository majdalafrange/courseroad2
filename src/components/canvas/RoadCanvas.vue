<template>
  <div class="road-canvas" :data-cy="'road_' + roadID">
    <transition name="banner">
      <div v-if="placing" class="placement-banner">
        <span class="placement-text">
          Placing
          <strong class="placement-id">{{ itemAdding?.subject_id }}</strong
          >. Choose a term below
        </span>
        <g-button size="sm" variant="ghost" @click="store.cancelAddFromCard()">
          Cancel · Esc
        </g-button>
      </div>
    </transition>

    <transition name="banner">
      <div v-if="moveSource !== null" class="placement-banner">
        <span class="placement-text">
          Moving
          <strong class="placement-id">{{ moveSourceSubjectId }}</strong
          >. Arrow keys to choose a term, Enter to place, Esc to cancel
        </span>
      </div>
    </transition>

    <div class="canvas-toolbar">
      <g-popover v-model="settingsOpen" align="start">
        <template #anchor>
          <button
            class="year-pill"
            data-cy="semester_title"
            @click="settingsOpen = !settingsOpen"
          >
            <g-icon name="map" :size="14" class="year-pill-icon" />
            <span class="year-pill-text">
              {{ yearNames[store.userYear] }} · {{ termLabelNow }}
            </span>
            <g-icon name="chevronDown" :size="12" class="year-pill-icon" />
          </button>
        </template>
        <div class="settings-pop" @click.stop>
          <g-select
            label="I am a..."
            data-cy="selectClassYear"
            :model-value="store.userYear"
            :options="yearOptions"
            @update:model-value="changeYear"
          />
          <label class="settings-check">
            <input
              type="checkbox"
              :checked="showFifthYear"
              @change="
                setShowFifthYear(($event.target as HTMLInputElement).checked)
              "
            />
            Show a fifth year
          </label>
        </div>
      </g-popover>
      <button
        class="iap-toggle"
        data-cy="hideIapToggle"
        :title="
          store.hideIAP
            ? 'Show the IAP (January) term columns'
            : 'Hide the IAP (January) term columns'
        "
        @click="store.setHideIAP(!store.hideIAP)"
      >
        {{ store.hideIAP ? "Show IAP" : "Hide IAP" }}
      </button>
    </div>

    <term-cell
      :index="0"
      :road-i-d="roadID"
      :subjects="selectedSubjects[0]"
      :all-subjects="selectedSubjects"
      :base-year="baseYearValue"
      :placement-status-kind="placementKind(0)"
      :move-source="moveSource"
      :move-target="moveTarget === 0"
      class="prior-credit-row"
      @place-here="placeHere"
      @begin-keyboard-move="beginKeyboardMove"
    />

    <div
      v-for="year in visibleYears"
      :key="year"
      class="year-row"
      :class="{ 'no-iap': store.hideIAP }"
    >
      <div class="year-label">
        <span class="year-name">{{ yearNames[year] }}</span>
        <span class="year-span">’{{ yearSpan(year) }}</span>
      </div>
      <term-cell
        v-for="termIndex in yearBuckets(year)"
        :key="termIndex"
        :index="termIndex"
        :road-i-d="roadID"
        :subjects="selectedSubjects[termIndex]"
        :all-subjects="selectedSubjects"
        :base-year="baseYearValue"
        :placement-status-kind="placementKind(termIndex)"
        :move-source="moveSource"
        :move-target="moveTarget === termIndex"
        :class="{
          'col-fall': termIndex % 3 === 1,
          'col-iap': termIndex % 3 === 2,
          'col-spring': termIndex % 3 === 0,
        }"
        @place-here="placeHere"
        @begin-keyboard-move="beginKeyboardMove"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import TermCell from "./TermCell.vue";
import GButton from "../../design/components/GButton.vue";
import GIcon from "../../design/components/GIcon.vue";
import GPopover from "../../design/components/GPopover.vue";
import GSelect from "../../design/components/GSelect.vue";
import { announce } from "../../design/announce";
import {
  NUM_SEMESTERS,
  baseYear,
  placementEligibility,
  placementStatus,
  semesterCalendarYearShort,
  semesterType,
  termYearLabel,
  type PlacementStatus,
} from "../../lib/offering";
import { STORAGE_KEYS, readRawFlag, writeRawFlag } from "../../lib/appStorage";
import type { SelectedSubject, Subject } from "../../lib/types";
import {
  configureDrag,
  dragState,
  type DragSource,
} from "../../stores/dragdrop";
import { clearHighlight } from "../../stores/highlight";
import { useCourseDataStore } from "../../stores/courseData";

const props = defineProps<{
  selectedSubjects: SelectedSubject[][];
  roadID: string;
}>();

const emit = defineEmits<{
  (e: "change-year", year: number): void;
}>();

const store = useCourseDataStore();

const yearNames = ["Freshman", "Sophomore", "Junior", "Senior", "Fifth year"];
const yearOptions = [
  { value: 0, label: "First year / Freshman" },
  { value: 1, label: "Sophomore" },
  { value: 2, label: "Junior" },
  { value: 3, label: "Senior" },
  { value: 4, label: "Super senior" },
];
const settingsOpen = ref(false);

const baseYearValue = computed(() => baseYear(store.userYear));

const termLabelNow = computed(
  () =>
    `${termYearLabel(store.currentSemester, baseYearValue.value)} is current`,
);

/* ---- fifth year visibility ---- */
const showFifthYearPref = ref(readRawFlag(STORAGE_KEYS.showFifthYear));
const showFifthYear = computed(
  () =>
    showFifthYearPref.value ||
    props.selectedSubjects
      .slice(13, NUM_SEMESTERS)
      .some((bucket) => bucket.length > 0),
);
function setShowFifthYear(value: boolean) {
  showFifthYearPref.value = value;
  writeRawFlag(STORAGE_KEYS.showFifthYear, value);
}

const visibleYears = computed(() =>
  showFifthYear.value ? [0, 1, 2, 3, 4] : [0, 1, 2, 3],
);

function yearBuckets(year: number): number[] {
  const start = 1 + year * 3;
  return store.hideIAP ? [start, start + 2] : [start, start + 1, start + 2];
}

function yearSpan(year: number): string {
  const fallYear = semesterCalendarYearShort(1 + year * 3, baseYearValue.value);
  const springYear = semesterCalendarYearShort(
    3 + year * 3,
    baseYearValue.value,
  );
  return `${fallYear}–’${springYear}`;
}

function changeYear(year: number) {
  emit("change-year", year);
  settingsOpen.value = false;
}

/* ---- click-to-place mode ---- */
const placing = computed(() => store.addingFromCard);
const itemAdding = computed(() => store.itemAdding);

function statusFor(subject: Subject, index: number): PlacementStatus["kind"] {
  return placementStatus(
    subject,
    index,
    store.currentSemester,
    baseYearValue.value,
  ).kind;
}

function placementKind(index: number): PlacementStatus["kind"] | null {
  if (!placing.value || itemAdding.value === undefined) {
    return null;
  }
  return statusFor(itemAdding.value, index);
}

function bucketLabel(index: number): string {
  return index === 0
    ? "Prior credit"
    : `${yearNames[Math.floor((index - 1) / 3)]} ${semesterType(index)}`;
}

function placeHere(index: number) {
  const subjectId = itemAdding.value?.subject_id;
  store.addAtPlaceholder(index);
  if (subjectId !== undefined) {
    announce(`Added ${subjectId} to ${bucketLabel(index)}`);
  }
}

/* ---- keyboard move mode ---- */
const moveSource = ref<{ semester: number; index: number } | null>(null);
const moveTarget = ref<number | null>(null);

const moveSourceSubjectId = computed(() => {
  if (moveSource.value === null) {
    return "";
  }
  return props.selectedSubjects[moveSource.value.semester][
    moveSource.value.index
  ]?.subject_id;
});

const eligibleMoveTargets = computed<number[]>(() => {
  if (moveSource.value === null) {
    return [];
  }
  // The source card can vanish out from under an in-progress keyboard
  // move (e.g. deleting an earlier card in the same term shifts this
  // index): bail rather than crash on the next arrow-key/Enter press.
  const placedSubject =
    props.selectedSubjects[moveSource.value.semester][moveSource.value.index];
  if (placedSubject === undefined) {
    return [];
  }
  const subject =
    store.subjectsInfo[store.subjectsIndex[placedSubject.subject_id]] ??
    store.genericCourses[store.genericIndex[placedSubject.subject_id]];
  const buckets: number[] = [];
  for (let i = 0; i < 16; i++) {
    if (i === moveSource.value.semester) {
      continue;
    }
    if (store.hideIAP && i !== 0 && (i - 1) % 3 === 1) {
      continue;
    }
    if (subject === undefined || statusFor(subject, i) !== "unavailable") {
      buckets.push(i);
    }
  }
  return buckets;
});

function beginKeyboardMove(semester: number, index: number) {
  moveSource.value = { semester, index };
  const targets = eligibleMoveTargets.value;
  moveTarget.value = targets.find((t) => t > semester) ?? targets[0] ?? null;
}

function onCanvasKeydown(event: KeyboardEvent) {
  // A layer above this one (palette, popover) that consumed the Escape
  // marks it defaultPrevented; one keypress closes one layer.
  if (event.defaultPrevented) {
    return;
  }
  if (event.key === "Escape") {
    if (store.addingFromCard) {
      store.cancelAddFromCard();
      return;
    }
    if (moveSource.value !== null) {
      moveSource.value = null;
      moveTarget.value = null;
      return;
    }
  }
  if (moveSource.value === null) {
    return;
  }
  const targets = eligibleMoveTargets.value;
  if (targets.length === 0) {
    return;
  }
  const current = moveTarget.value ?? targets[0];
  const position = targets.indexOf(current);
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    moveTarget.value = targets[(position + 1) % targets.length];
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    moveTarget.value =
      targets[(position - 1 + targets.length) % targets.length];
  } else if (event.key === "Enter") {
    event.preventDefault();
    const source = moveSource.value;
    const target = moveTarget.value;
    const currentClass =
      source !== null
        ? props.selectedSubjects[source.semester][source.index]
        : undefined;
    if (source !== null && target !== null && currentClass !== undefined) {
      store.moveClass({
        currentClass,
        classIndex: source.index,
        semester: target,
      });
      announce(`Moved ${currentClass.subject_id} to ${bucketLabel(target)}`);
    }
    moveSource.value = null;
    moveTarget.value = null;
  }
}

/* ---- pointer drag wiring ---- */
function handleDrop(termIndex: number, source: DragSource) {
  clearHighlight();
  if (source.isNew) {
    const subject = source.subject;
    store.addClass({
      overrideWarnings: false,
      semester: termIndex,
      title: subject.title,
      subject_id: subject.subject_id,
      units: subject.total_units,
      ...(subject.public === false
        ? {
            in_class_hours: subject.in_class_hours,
            out_of_class_hours: subject.out_of_class_hours,
            custom_color: subject.custom_color,
            public: false as const,
          }
        : {}),
    });
    announce(`Added ${subject.subject_id} to ${bucketLabel(termIndex)}`);
  } else if (
    source.fromSemester !== undefined &&
    source.fromIndex !== undefined &&
    source.fromSemester !== termIndex
  ) {
    const currentClass =
      props.selectedSubjects[source.fromSemester][source.fromIndex];
    store.moveClass({
      currentClass,
      classIndex: source.fromIndex,
      semester: termIndex,
    });
    announce(`Moved ${currentClass.subject_id} to ${bucketLabel(termIndex)}`);
  }
}

function eligibilityFor(subject: Subject): PlacementStatus["kind"][] {
  return placementEligibility(
    subject,
    store.currentSemester,
    baseYearValue.value,
  );
}

onMounted(() => {
  configureDrag({
    onDrop: handleDrop,
    eligibility: eligibilityFor,
    scrollEl: document.getElementById("canvasScroll"),
  });
  window.addEventListener("keydown", onCanvasKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onCanvasKeydown);
});

void dragState;
</script>

<style scoped>
.road-canvas {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 1140px;
  margin: 0 auto;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
/* A disclosure control, not a floating card: it sits, ringed, no shadow. */
.year-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  font: var(--text-small);
  font-weight: 500;
  color: var(--g-ink-2);
  background: var(--g-surface);
  border: none;
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--g-line-strong);
  height: 28px;
  padding: 0 var(--space-3);
  cursor: pointer;
  transition:
    box-shadow var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out);
}
.year-pill:hover {
  box-shadow: inset 0 0 0 1px var(--g-ink-3);
  color: var(--g-ink);
}
.year-pill:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.year-pill-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.year-pill-icon {
  flex-shrink: 0;
}
.iap-toggle {
  display: inline-flex;
  align-items: center;
  font: var(--text-small);
  font-weight: 500;
  color: var(--g-ink-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out);
}
.iap-toggle:hover {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.iap-toggle:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

.settings-pop {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 220px;
}
.settings-check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-body);
  color: var(--g-ink-2);
  cursor: pointer;
}
.settings-check input {
  width: 14px;
  height: 14px;
  accent-color: var(--g-accent);
}

.placement-banner {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  background: var(--g-ink);
  color: var(--g-bg);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  box-shadow: var(--shadow-2);
}
.placement-text {
  font: var(--text-body);
}
.placement-id {
  /* inherits the banner's ink-inversion color (17:1 light, 15.7:1 dark);
     the accent on this near-black bar measured ~1.6:1 and was illegible */
  font: var(--text-id);
  font-weight: 600;
  color: inherit;
}
.placement-banner :deep(.g-button) {
  color: var(--g-bg);
}

.banner-enter-active {
  transition:
    opacity var(--motion-standard) var(--ease-out),
    transform var(--motion-standard) var(--ease-out);
}
.banner-leave-active {
  transition: opacity var(--motion-quick) var(--ease-in);
}
.banner-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.banner-leave-to {
  opacity: 0;
}

.year-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1.2fr) minmax(0, 0.55fr) minmax(
      0,
      1.2fr
    );
  gap: var(--space-3);
  align-items: stretch;
}
.year-row.no-iap {
  grid-template-columns: 92px minmax(0, 1fr) minmax(0, 1fr);
}

.year-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-05);
  padding-top: var(--space-2);
}
.year-name {
  font: var(--text-heading);
  color: var(--g-ink);
}
.year-span {
  font: var(--text-id-small);
  color: var(--g-ink-3);
}

/* On a phone, the year grid stacks into a single column. minmax(0, 1fr),
   not bare 1fr: a bare track's automatic minimum size still comes from
   its content, so it can force the column wider than the viewport. */
@media (max-width: 859px) {
  .year-row,
  .year-row.no-iap {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
  }
  .year-label {
    flex-direction: row;
    align-items: baseline;
    gap: var(--space-2);
    padding-top: var(--space-3);
  }
  .road-canvas {
    gap: var(--space-2);
  }
}

/* larger screens get larger maximum widths */
@media (min-width: 1600px) {
  .road-canvas {
    max-width: 1320px;
  }
}
@media (min-width: 2200px) {
  .road-canvas {
    max-width: 1500px;
  }
}
</style>
