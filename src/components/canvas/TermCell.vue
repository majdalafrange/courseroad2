<template>
  <section
    :ref="setTermRef"
    class="term-cell"
    :class="[
      dragClass,
      {
        'is-prior-credit': index === 0,
        'is-collapsed-prior': collapsedPrior,
        'is-empty': subjects.length === 0,
        'is-iap': isIAP,
        'is-current': isCurrentTerm,
        'is-move-target': moveTarget,
      },
    ]"
    :data-cy="'road_' + roadID + '__semester_' + index"
    :aria-label="termLabel"
  >
    <!-- Empty prior credit stays out of the way: one slim line that opens
         search, and grows back into a real cell whenever it can receive. -->
    <button
      v-if="collapsedPrior"
      class="prior-collapsed"
      @click.stop="openPaletteForTerm"
    >
      <span class="term-name is-prior">Prior credit</span>
      <span class="prior-hint">Add AP, transfer, or ASE from search</span>
      <g-icon name="plus" :size="13" class="prior-plus" />
    </button>

    <header v-if="!collapsedPrior" class="term-head">
      <div class="term-title-row">
        <h3 class="term-name" :class="{ 'is-prior': index === 0 }">
          <template v-if="index === 0">Prior credit</template>
          <template v-else>
            {{ termSeason }}<span class="term-year">’{{ termYearShort }}</span>
          </template>
        </h3>
        <a
          v-if="subjects.length && index !== 0"
          class="term-hydrant"
          :href="hydrantLink"
          target="_blank"
          rel="noopener"
          aria-label="Open this term in Hydrant"
          @pointerdown.stop
          @click.stop
        >
          <g-tooltip text="Build this term's schedule in Hydrant">
            <span class="hydrant-mark">H</span>
          </g-tooltip>
        </a>
      </div>
      <div v-if="subjects.length" class="term-stats">
        <span class="term-units" data-cy="semesterUnits"
          >{{ info.totalUnits }}u</span
        >
        <g-tooltip placement="bottom">
          <span class="term-hours" :class="loadTone"
            >{{ info.totalExpectedHours.toFixed(0) }}h</span
          >
          <template #content>
            <div class="hours-detail">
              <template v-if="info.anyClassInSingleQuarter">
                <div class="hours-quarter">
                  <strong>First half</strong>
                  <span
                    v-for="subj in info.expectedHoursQuarter1"
                    :key="subj.subject_id"
                  >
                    {{ subj.subject_id }} · {{ subj.hours.toFixed(1) }}h
                  </span>
                  <em
                    >{{ info.totalExpectedHoursQuarter1.toFixed(1) }}h total</em
                  >
                </div>
                <div class="hours-quarter">
                  <strong>Second half</strong>
                  <span
                    v-for="subj in info.expectedHoursQuarter2"
                    :key="subj.subject_id"
                  >
                    {{ subj.subject_id }} · {{ subj.hours.toFixed(1) }}h
                  </span>
                  <em
                    >{{ info.totalExpectedHoursQuarter2.toFixed(1) }}h total</em
                  >
                </div>
              </template>
              <template v-else>
                <span
                  v-for="subj in info.expectedHoursQuarter1"
                  :key="subj.subject_id"
                >
                  {{ subj.subject_id }} · {{ subj.hours.toFixed(1) }}h
                </span>
                <em>expected hours per week</em>
              </template>
            </div>
          </template>
        </g-tooltip>
      </div>
      <g-progress
        v-if="index !== 0 && subjects.length"
        class="load-gauge"
        :class="loadTone"
        fill-class="load-fill"
        :value="loadPercent"
        :get-value-label="
          () => `${info.totalExpectedHours.toFixed(0)} expected hours per week`
        "
      />
    </header>

    <div v-if="!collapsedPrior" class="term-classes">
      <class-card
        v-for="(subject, subjIndex) in subjects"
        :key="subjectKeys[subjIndex]"
        :subject="subject"
        :semester-index="index"
        :class-index="subjIndex"
        :warnings="warnings[subjIndex] ?? []"
        :move-selected="
          moveSource?.semester === index && moveSource?.index === subjIndex
        "
        @keyboard-move="emit('begin-keyboard-move', index, subjIndex)"
      />

      <button
        v-if="
          placementStatusKind !== null && placementStatusKind !== 'unavailable'
        "
        class="place-slot"
        :class="placementStatusKind"
        :data-cy="'road_' + roadID + '__semester_' + index + '_dropZone'"
        :aria-label="placementAriaLabel"
        @click.stop="emit('place-here', index)"
      >
        <g-icon name="plus" :size="13" />
        <span>{{ placementMessage }}</span>
      </button>

      <button
        v-else-if="!subjects.length && placementStatusKind === null"
        class="term-empty"
        :data-cy="'road_' + roadID + '__semester_' + index + '_emptyAdd'"
        :aria-label="`Add a class to ${termLabel}`"
        @click.stop="openPaletteForTerm"
      >
        <g-icon name="plus" :size="13" class="term-empty-glyph" />
        <span class="term-empty-label">add</span>
      </button>
    </div>

    <div v-if="dragClass !== ''" class="drop-veil" :class="dragClass">
      <span v-if="dragState.hoverTerm === index" class="drop-hint">
        {{ dropHint }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import ClassCard from "./ClassCard.vue";
import GIcon from "../../design/components/GIcon.vue";
import GProgress from "../../design/components/GProgress.vue";
import GTooltip from "../../design/components/GTooltip.vue";
import { semesterInformation } from "../../lib/hours";
import { hydrantURL } from "../../lib/hydrant";
import {
  isSameYear,
  scheduledSemester,
  semesterCalendarYearShort,
  semesterType,
  termYearLabel,
  type PlacementStatus,
} from "../../lib/offering";
import { semesterWarnings } from "../../lib/warnings";
import type { SelectedSubject } from "../../lib/types";
import { dragState, registerTermElement } from "../../stores/dragdrop";
import { requestPalette } from "../../stores/palette";
import { useCourseDataStore } from "../../stores/courseData";

const props = defineProps<{
  index: number;
  roadID: string;
  subjects: SelectedSubject[];
  allSubjects: SelectedSubject[][];
  baseYear: number;
  /** Placement-mode status (null when not placing). */
  placementStatusKind: PlacementStatus["kind"] | null;
  moveSource: { semester: number; index: number } | null;
  moveTarget: boolean;
}>();

const emit = defineEmits<{
  (e: "place-here", index: number): void;
  (e: "begin-keyboard-move", semester: number, index: number): void;
}>();

const store = useCourseDataStore();

function setTermRef(el: unknown) {
  registerTermElement(props.index, (el as HTMLElement) ?? null);
}

onBeforeUnmount(() => {
  registerTermElement(props.index, null);
});

const isIAP = computed(() => semesterType(props.index) === "IAP");
const termSeason = computed(() => semesterType(props.index));
const termYearShort = computed(() =>
  semesterCalendarYearShort(props.index, props.baseYear),
);
const termLabel = computed(() => termYearLabel(props.index, props.baseYear));

const isCurrentTerm = computed(
  () =>
    props.index === store.currentSemester &&
    isSameYear(props.index, store.currentSemester),
);

/* Empty prior credit collapses to a single line; most students never use
   it, and it shouldn't be the tallest thing above freshman fall. It expands
   the instant it could receive something (drag, placement, keyboard move);
   rects are captured a frame after drag start, so geometry stays honest. */
const collapsedPrior = computed(
  () =>
    props.index === 0 &&
    props.subjects.length === 0 &&
    props.placementStatusKind === null &&
    props.moveSource === null &&
    !dragState.active,
);

/** Open the add palette scoped to this term's season. Prior credit has
 *  no season, so it opens the palette unscoped. */
function openPaletteForTerm() {
  if (props.index === 0) {
    requestPalette({ query: "" });
  } else {
    requestPalette({ tokens: [semesterType(props.index).toLowerCase()] });
  }
}

const info = computed(() => semesterInformation(props.subjects, store.catalog));

/**
 * Stable per-card keys: subject_id alone, so reordering within a term
 * patches the moved card instead of recreating every row. Suffixed only
 * for a genuine duplicate id (two identically-named custom activities).
 */
const subjectKeys = computed<string[]>(() => {
  const seen = new Map<string, number>();
  return props.subjects.map((subject) => {
    const id = subject.subject_id;
    const occurrence = seen.get(id) ?? 0;
    seen.set(id, occurrence + 1);
    return occurrence === 0 ? id : `${id}-${occurrence}`;
  });
});

/** 60h/week ≈ a death semester; the gauge tops out there. */
const loadPercent = computed(() =>
  Math.min(100, (info.value.totalExpectedHours / 60) * 100),
);

const loadTone = computed(() => {
  const hours = info.value.totalExpectedHours;
  if (hours >= 55) {
    return "load-danger";
  }
  if (hours >= 42) {
    return "load-warn";
  }
  return "load-ok";
});

const warnings = computed(() =>
  semesterWarnings({
    catalog: store.catalog,
    selectedSubjects: props.allSubjects,
    index: props.index,
    baseYear: props.baseYear,
    scheduledSemesterIndex: scheduledSemester(store.currentSemester),
  }),
);

const hydrantLink = computed(() =>
  hydrantURL(props.index, props.baseYear, props.subjects),
);

/** During a drag, the cell communicates eligibility. */
const dragClass = computed(() => {
  if (!dragState.active) {
    return "";
  }
  const kind = dragState.eligibility[props.index];
  if (kind === null) {
    return "";
  }
  const hover = dragState.hoverTerm === props.index ? " is-hover" : "";
  if (kind === "ok") {
    return "drag-ok" + hover;
  }
  if (kind === "unavailable") {
    return "drag-blocked" + hover;
  }
  return "drag-maybe" + hover;
});

const dropHint = computed(() => {
  const kind = dragState.eligibility[props.index];
  if (kind === "ok") {
    return "Drop to place";
  }
  if (kind === "unavailable") {
    return "Not offered this term";
  }
  if (kind === "no-longer-offered") {
    return "No longer offered";
  }
  if (kind === "not-this-year") {
    return "Skipping this year";
  }
  return "May not be offered";
});

const placementMessage = computed(() => {
  switch (props.placementStatusKind) {
    case "ok":
      return "Add here";
    case "no-longer-offered":
      return "No longer offered. Add anyway";
    case "not-this-year":
      return "Not offered this year. Add anyway";
    case "maybe":
      return "May not be offered. Add anyway";
    default:
      return "";
  }
});

/* The visible text stays short; the accessible name carries the term,
   or every target in placement mode announces an identical "Add here". */
const placementAriaLabel = computed(() => {
  switch (props.placementStatusKind) {
    case "ok":
      return `Add to ${termLabel.value}`;
    case "no-longer-offered":
      return `No longer offered. Add to ${termLabel.value} anyway`;
    case "not-this-year":
      return `Not offered this year. Add to ${termLabel.value} anyway`;
    case "maybe":
      return `May not be offered. Add to ${termLabel.value} anyway`;
    default:
      return "";
  }
});
</script>

<style scoped>
.term-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--g-cell);
  border: 1px solid var(--g-line);
  border-radius: var(--radius-md);
  min-height: 96px;
  transition:
    border-color var(--motion-quick) var(--ease-out),
    box-shadow var(--motion-quick) var(--ease-out);
}
.term-cell.is-current {
  border-color: var(--g-accent);
  box-shadow: 0 0 0 1px var(--g-accent);
}
.term-cell.is-empty {
  background: transparent;
}
.term-cell.is-prior-credit {
  background: transparent;
  border-style: dashed;
  min-height: 64px;
}
.term-cell.is-collapsed-prior {
  min-height: 0;
}
.prior-collapsed {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  text-align: left;
}
.prior-collapsed .term-name {
  flex-shrink: 0;
}
.prior-hint {
  font: var(--text-small);
  color: var(--g-ink-3);
  opacity: 0;
  transition: opacity var(--motion-quick) var(--ease-out);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prior-plus {
  color: var(--g-ink-3);
  margin-left: auto;
  opacity: 0;
  transition: opacity var(--motion-quick) var(--ease-out);
  flex-shrink: 0;
}
.prior-collapsed:hover .prior-hint,
.prior-collapsed:focus-visible .prior-hint,
.prior-collapsed:hover .prior-plus,
.prior-collapsed:focus-visible .prior-plus {
  opacity: 1;
}
.prior-collapsed:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.term-cell.is-move-target {
  border-color: var(--g-accent);
  box-shadow: 0 0 0 2px var(--g-accent-tint-strong);
}

.term-head {
  padding: var(--space-2) var(--space-3) var(--space-1);
}
.term-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
/* A season label is a data column header, so it keeps the caps treatment.
   The prior-credit row is a row name, not a column, so it does not. */
.term-name {
  font: var(--text-micro);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  color: var(--g-ink-3);
  margin: 0;
  white-space: nowrap;
}
.term-name.is-prior {
  font: var(--text-small);
  letter-spacing: normal;
  text-transform: none;
}
.is-current .term-name {
  color: var(--g-accent);
}
.term-year {
  margin-left: 3px;
  color: var(--g-ink-3);
  opacity: 0.8;
}
.term-hydrant {
  text-decoration: none;
  line-height: 1;
}
.hydrant-mark {
  font: var(--text-id-small);
  font-weight: 600;
  color: var(--g-ink-3);
  border: 1px solid var(--g-line-strong);
  border-radius: var(--radius-xs);
  padding: 0 4px;
  transition:
    color var(--motion-quick) var(--ease-out),
    border-color var(--motion-quick) var(--ease-out);
}
.term-hydrant:hover .hydrant-mark {
  color: var(--g-accent);
  border-color: var(--g-accent);
}

.term-stats {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font: var(--text-id-small);
  color: var(--g-ink-2);
  margin-top: var(--space-05);
}
.term-hours {
  cursor: default;
}
.term-hours.load-warn {
  color: var(--g-warn);
  font-weight: 600;
}
.term-hours.load-danger {
  color: var(--g-danger);
  font-weight: 600;
}

.load-gauge {
  position: relative;
  height: 3px;
  border-radius: var(--radius-full);
  background: var(--g-line);
  margin-top: var(--space-2);
  overflow: hidden;
}
/* Notches at the thresholds where the tone changes (42h and 55h of the
   60h scale); the gauge shows where "too much" begins, not just how full.
   They sit above the fill so they cut it, not just the track. */
.load-gauge::before,
.load-gauge::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--g-cell);
  z-index: 1;
}
.load-gauge::before {
  left: 70%;
}
.load-gauge::after {
  left: 91.7%;
}
/* :deep(): GProgress's own indicator, a grandchild from here. */
:deep(.load-fill) {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--g-ink-3);
  transition: width var(--motion-standard) var(--ease-out);
}
.load-warn :deep(.load-fill) {
  background: var(--g-warn);
}
.load-danger :deep(.load-fill) {
  background: var(--g-danger);
}

.term-classes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3) var(--space-3);
  flex: 1;
}
.is-prior-credit .term-classes {
  flex-direction: row;
  flex-wrap: wrap;
}
.is-prior-credit .term-classes > * {
  min-width: 180px;
  flex: 0 1 auto;
}
/* On a phone, prior credit stacks full-width like the other terms
   instead of wrapping 180px-min cards, which never fit more than one
   per row anyway. */
@media (max-width: 859px) {
  .is-prior-credit .term-classes {
    flex-direction: column;
  }
  .is-prior-credit .term-classes > * {
    /* flex: 0 1 auto above assumes a row; it no longer stretches width
       once flex-direction flips to column, so width is set explicitly. */
    min-width: 0;
    width: 100%;
  }
}

/* A control that whispers: it opens the palette scoped to this term,
   and its label surfaces on cell hover or its own focus so an empty
   cell stays quiet at rest. */
.term-empty {
  flex: 1;
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  font: var(--text-small);
  color: var(--g-ink-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0;
  cursor: pointer;
}
.term-empty-glyph,
.term-empty-label {
  opacity: 0;
  transition: opacity var(--motion-quick) var(--ease-out);
}
.term-cell:hover .term-empty-glyph,
.term-cell:hover .term-empty-label,
.term-empty:focus-visible .term-empty-glyph,
.term-empty:focus-visible .term-empty-label {
  opacity: 1;
}
/* Touch: the slot is tappable either way, so without a hover state to
   name it an empty term read as inert. */
@media (hover: none) {
  .term-empty-glyph,
  .term-empty-label {
    opacity: 1;
  }
}
.term-empty:hover {
  color: var(--g-ink-2);
}
.term-empty:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

/* An eligible slot is the normal case, so it stays neutral; the warn
   variants carry the doubt in their words alone. */
.place-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font: var(--text-small);
  font-weight: 500;
  color: var(--g-ink-2);
  border: 1.5px dashed var(--g-line-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  padding: var(--space-2);
  cursor: pointer;
  min-height: 36px;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.place-slot:hover {
  background: var(--g-surface-sunken);
}
.place-slot.maybe,
.place-slot.no-longer-offered,
.place-slot.not-this-year {
  color: var(--g-warn);
}

/* drag eligibility veil */
.drop-veil {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-md);
  pointer-events: none;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: var(--space-2);
}
.drop-veil.drag-ok {
  box-shadow: inset 0 0 0 1.5px var(--g-ok);
  background: var(--g-ok-tint);
}
.drop-veil.drag-maybe {
  box-shadow: inset 0 0 0 1.5px var(--g-warn);
  background: var(--g-warn-tint);
}
.drop-veil.drag-blocked {
  box-shadow: inset 0 0 0 1.5px var(--g-danger);
  background: var(--g-danger-tint);
  opacity: 0.7;
}
.drop-veil.is-hover.drag-ok {
  box-shadow: inset 0 0 0 2.5px var(--g-ok);
}
.drop-veil.is-hover.drag-maybe {
  box-shadow: inset 0 0 0 2.5px var(--g-warn);
}
.drop-veil.is-hover.drag-blocked {
  box-shadow: inset 0 0 0 2.5px var(--g-danger);
}
.drop-hint {
  font: var(--text-small);
  font-weight: 600;
  background: var(--g-surface);
  color: var(--g-ink);
  border-radius: var(--radius-full);
  padding: var(--space-05) var(--space-3);
  box-shadow: var(--shadow-2);
}

.hours-detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-05);
  font: var(--text-small);
}
.hours-detail em {
  color: inherit;
  opacity: 0.75;
  font-style: normal;
}
.hours-quarter {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: var(--space-05) 0;
}
</style>
