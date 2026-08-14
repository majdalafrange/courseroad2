<template>
  <section
    v-if="subject"
    ref="sheetEl"
    class="term-picker"
    role="dialog"
    :aria-label="`Add ${subject.subject_id} to a term`"
    tabindex="-1"
    @keydown.esc.stop="store.cancelPlacement()"
  >
    <div class="picker-head">
      <span class="picker-title">
        Add <span class="picker-id">{{ subject.subject_id }}</span> to…
      </span>
      <button
        class="picker-close"
        aria-label="Cancel adding"
        @click="store.cancelPlacement()"
      >
        <g-icon name="close" :size="13" />
      </button>
    </div>

    <div class="picker-grid">
      <button
        v-for="term in terms"
        :key="term.index"
        class="term-chip"
        :class="[`k-${term.kind}`, { early: term.early }]"
        :disabled="term.kind === 'unavailable'"
        :title="term.title"
        :data-cy="`connectionTerm_${term.index}`"
        @click="store.confirmPlacement(term.index)"
      >
        {{ term.label }}
        <span v-if="term.early" class="early-dot" aria-hidden="true">•</span>
      </button>
    </div>

    <p v-if="note" class="picker-note">{{ note }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import GIcon from "../../design/components/GIcon.vue";
import {
  NUM_SEMESTERS,
  baseYear,
  placementStatus,
  type PlacementStatus,
} from "../../lib/offering";
import { useCourseDataStore } from "../../stores/courseData";
import { useConnectionsStore } from "../../stores/connections";

const store = useConnectionsStore();
const courseData = useCourseDataStore();
const sheetEl = ref<HTMLElement>();

const subject = computed(() => store.placementRequest);

const KIND_TITLE: Record<PlacementStatus["kind"], string> = {
  ok: "Offered in this term",
  "no-longer-offered": "No longer offered",
  "not-this-year": "Not offered that school year",
  unavailable: "Not offered in this term",
  maybe: "Schedule not published, so it may not be offered",
};

interface TermChip {
  index: number;
  label: string;
  kind: PlacementStatus["kind"];
  title: string;
  /** Falls before the term where this subject's prereqs are complete. */
  early: boolean;
}

const readiness = computed(() =>
  subject.value === undefined ? undefined : store.readinessFor(subject.value),
);

const readyFromTerm = computed(() => {
  const r = readiness.value;
  return r?.kind === "ready-after" ? r.term : undefined;
});

const terms = computed<TermChip[]>(() => {
  const s = subject.value;
  if (s === undefined) {
    return [];
  }
  const baseYearValue = baseYear(courseData.userYear);
  const out: TermChip[] = [];
  for (let index = 0; index < NUM_SEMESTERS; index++) {
    if (courseData.hideIAP && index !== 0 && (index - 1) % 3 === 1) {
      continue;
    }
    const kind = placementStatus(
      s,
      index,
      courseData.currentSemester,
      baseYearValue,
    ).kind;
    const early =
      readyFromTerm.value !== undefined &&
      index > 0 &&
      index < readyFromTerm.value;
    out.push({
      index,
      label: store.termName(index),
      kind,
      title: early
        ? `${KIND_TITLE[kind]}. Prereqs not complete yet`
        : KIND_TITLE[kind],
      early,
    });
  }
  return out;
});

/** One quiet line of prereq context under the grid: advice, not a gate. */
const note = computed(() => {
  const s = subject.value;
  if (s !== undefined) {
    const status = store.roadStatus.get(s.subject_id);
    if (status !== undefined) {
      return `Already on your road (${status}). This adds a repeat.`;
    }
  }
  const r = readiness.value;
  if (r === undefined) {
    return undefined;
  }
  if (r.kind === "ready-after") {
    return r.term >= NUM_SEMESTERS
      ? "Prereqs finish after your current plan."
      : `Prereqs complete from ${store.termName(r.term)} (•).`;
  }
  if (r.kind === "missing") {
    const listed = r.missing.slice(0, 4).join(", ");
    const more = r.missing.length > 4 || r.approximate ? " + more" : "";
    return `Your plan is missing prereqs: ${listed}${more}.`;
  }
  return undefined;
});

onMounted(() => {
  sheetEl.value?.focus();
});
</script>

<style scoped>
.term-picker {
  flex-shrink: 0;
  margin: var(--space-2);
  padding: var(--space-3);
  background: var(--g-surface);
  border: 1px solid var(--g-accent);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
}
.term-picker:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}
.picker-title {
  font: var(--text-small);
  color: var(--g-ink-2);
}
.picker-id {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--g-ink);
}
.picker-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
}
.picker-close:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.term-chip {
  position: relative;
  font: var(--text-micro);
  padding: 4px 2px;
  border: 1px solid var(--g-line);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--g-ink-2);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    border-color var(--motion-quick) var(--ease-out);
}
/* The dashed border is the one steady mark of offering doubt; hover says
   only that the chip is interactive, and the dash stays visible under it. */
.term-chip.k-maybe,
.term-chip.k-not-this-year,
.term-chip.k-no-longer-offered {
  border-style: dashed;
  color: var(--g-ink-3);
}
.term-chip.k-ok:hover,
.term-chip.k-maybe:hover,
.term-chip.k-not-this-year:hover,
.term-chip.k-no-longer-offered:hover {
  background: var(--g-accent-tint);
  border-color: var(--g-accent);
  color: var(--g-ink);
}
.term-chip.k-unavailable {
  opacity: 0.35;
  cursor: not-allowed;
  text-decoration: line-through;
}
.early-dot {
  color: var(--g-info);
  margin-left: 1px;
}

.picker-note {
  font: var(--text-micro);
  color: var(--g-ink-3);
  margin: var(--space-2) 0 0;
}
</style>
