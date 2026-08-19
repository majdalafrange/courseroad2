<template>
  <g-sheet
    :model-value="modelValue"
    label="Compare roads"
    width="760px"
    :close-button="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="compare">
      <header class="compare-head">
        <h2 class="compare-title">Compare roads</h2>
        <button class="compare-close" aria-label="Close" @click="close">
          <g-icon name="close" :size="16" />
        </button>
      </header>

      <div class="compare-pickers">
        <g-select v-model="roadA" class="road-select" :options="roadOptions" />
        <span class="vs">vs</span>
        <g-select v-model="roadB" class="road-select" :options="roadOptions" />
      </div>

      <div v-if="roadA !== roadB" class="compare-options">
        <label class="iap-check">
          <input
            type="checkbox"
            data-cy="compareHideIapToggle"
            :checked="store.hideIAP"
            @change="
              store.setHideIAP(($event.target as HTMLInputElement).checked)
            "
          />
          Hide IAP
        </label>
      </div>

      <div v-if="roadA !== roadB" class="compare-body">
        <!-- headline numbers -->
        <div class="compare-summary">
          <div class="summary-col">
            <span class="summary-units">{{ unitsA }}</span>
            <span class="summary-label">units · {{ programsA }} programs</span>
          </div>
          <div class="summary-col">
            <span class="summary-units">{{ unitsB }}</span>
            <span class="summary-label">units · {{ programsB }} programs</span>
          </div>
        </div>

        <!-- programs -->
        <section
          v-if="programDiff.onlyInA.length || programDiff.onlyInB.length"
          class="compare-section"
        >
          <h3 class="section-label">Programs</h3>
          <div class="diff-cols">
            <div class="diff-col">
              <span
                v-for="p in programDiff.onlyInA"
                :key="p"
                class="diff-chip add-a"
                >{{ titleFor(p) }}</span
              >
            </div>
            <div class="diff-col">
              <span
                v-for="p in programDiff.onlyInB"
                :key="p"
                class="diff-chip add-b"
                >{{ titleFor(p) }}</span
              >
            </div>
          </div>
        </section>

        <!-- classes -->
        <section class="compare-section">
          <h3 class="section-label">
            Classes · {{ classDiff.shared.length }} in common
          </h3>
          <div class="diff-cols">
            <div class="diff-col">
              <span class="diff-col-head">Only in {{ roads[roadA].name }}</span>
              <span
                v-for="s in classDiff.onlyInA"
                :key="s.subject_id"
                class="diff-chip add-a"
                :style="{ '--dept-color': courseColor(s) }"
                >{{ s.subject_id }}</span
              >
              <span v-if="!classDiff.onlyInA.length" class="diff-none"
                >none</span
              >
            </div>
            <div class="diff-col">
              <span class="diff-col-head">Only in {{ roads[roadB].name }}</span>
              <span
                v-for="s in classDiff.onlyInB"
                :key="s.subject_id"
                class="diff-chip add-b"
                :style="{ '--dept-color': courseColor(s) }"
                >{{ s.subject_id }}</span
              >
              <span v-if="!classDiff.onlyInB.length" class="diff-none"
                >none</span
              >
            </div>
          </div>
        </section>

        <!-- per-term load -->
        <section class="compare-section">
          <h3 class="section-label">Term load</h3>
          <div class="load-chart">
            <div
              v-for="delta in chartDeltas"
              :key="delta.index"
              class="load-row"
            >
              <span class="load-term">{{ bucketName(delta.index) }}</span>
              <div class="load-bars">
                <span
                  class="load-bar bar-a"
                  :style="{ width: barWidth(delta.hoursA) }"
                  >{{ delta.hoursA.toFixed(0) }}h</span
                >
                <span
                  class="load-bar bar-b"
                  :style="{ width: barWidth(delta.hoursB) }"
                  >{{ delta.hoursB.toFixed(0) }}h</span
                >
              </div>
            </div>
          </div>
        </section>
      </div>
      <div v-else class="compare-same">
        Pick two different roads and we'll compare them side by side.
      </div>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import GIcon from "../../design/components/GIcon.vue";
import GSelect from "../../design/components/GSelect.vue";
import GSheet from "../../design/components/GSheet.vue";
import { courseColor } from "../../lib/colors";
import {
  diffClasses,
  diffPrograms,
  diffTermLoads,
  totalUnits,
} from "../../lib/compare";
import { programTitle } from "../../lib/audit";
import { bucketName, semesterType } from "../../lib/offering";
import { useAuditStore } from "../../stores/audit";
import { useCourseDataStore } from "../../stores/courseData";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const store = useCourseDataStore();
const auditStore = useAuditStore();

const roads = computed(() => store.roads);
const roadIds = computed(() => Object.keys(store.roads));
const roadOptions = computed(() =>
  roadIds.value.map((id) => ({ value: id, label: roads.value[id].name })),
);

const roadA = ref(store.activeRoad);
const roadB = ref("");

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      roadA.value = store.activeRoad;
      roadB.value =
        roadIds.value.find((id) => id !== store.activeRoad) ?? store.activeRoad;
    }
  },
);

const contentsA = computed(() => roads.value[roadA.value]?.contents);
const contentsB = computed(() => roads.value[roadB.value]?.contents);

const classDiff = computed(() =>
  contentsA.value && contentsB.value
    ? diffClasses(contentsA.value, contentsB.value)
    : { onlyInA: [], onlyInB: [], shared: [] },
);
const programDiff = computed(() =>
  contentsA.value && contentsB.value
    ? diffPrograms(contentsA.value, contentsB.value)
    : { onlyInA: [], onlyInB: [], shared: [] },
);
const termDeltas = computed(() =>
  contentsA.value && contentsB.value
    ? diffTermLoads(contentsA.value, contentsB.value, store.catalog)
    : [],
);
/**
 * Rows for the chart: every term the plans span, first occupied through
 * last, not only the terms carrying hours. Empty terms are drawn at 0h,
 * which is what the canvas does with its empty IAP columns. Dropping them
 * left holes in the timeline (a Sophomore Fall between two occupied
 * terms would vanish) and left Hide IAP with nothing to act on whenever
 * a plan had no January classes.
 */
const chartDeltas = computed(() => {
  const occupied = termDeltas.value.filter((d) => d.hoursA > 0 || d.hoursB > 0);
  if (occupied.length === 0) {
    return [];
  }
  const first = occupied[0].index;
  const last = occupied[occupied.length - 1].index;
  return termDeltas.value.filter(
    (d) =>
      d.index >= first &&
      d.index <= last &&
      !(store.hideIAP && semesterType(d.index) === "IAP"),
  );
});

const unitsA = computed(() =>
  contentsA.value ? totalUnits(contentsA.value, store.catalog) : 0,
);
const unitsB = computed(() =>
  contentsB.value ? totalUnits(contentsB.value, store.catalog) : 0,
);
const programsA = computed(() => contentsA.value?.coursesOfStudy.length ?? 0);
const programsB = computed(() => contentsB.value?.coursesOfStudy.length ?? 0);

const maxHours = computed(() =>
  Math.max(1, ...chartDeltas.value.flatMap((d) => [d.hoursA, d.hoursB])),
);

function barWidth(hours: number): string {
  return `${(hours / maxHours.value) * 100}%`;
}

function titleFor(key: string): string {
  return programTitle(auditStore.reqList, key);
}

function close() {
  emit("update:modelValue", false);
}
</script>

<style scoped>
.compare {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.compare-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--g-line);
}
.compare-title {
  font: var(--text-title);
  margin: 0;
}
.compare-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
}
.compare-close:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}

.compare-pickers {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
}
.road-select {
  flex: 1;
  min-width: 0;
}
.vs {
  font: var(--text-small);
  color: var(--g-ink-3);
}

.compare-body {
  overflow-y: auto;
  padding: 0 var(--space-5) var(--space-5);
}
.compare-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}
.summary-col {
  display: flex;
  flex-direction: column;
  background: var(--g-surface-2);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}
.summary-units {
  font: var(--text-display);
  font-family: var(--font-mono);
  color: var(--g-ink);
}
.summary-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}

.compare-section {
  margin-bottom: var(--space-5);
}
.section-label {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin: 0 0 var(--space-2);
}
/* Sits above the scrolling body so the option is visible when the panel
   opens, rather than only once you reach the term-load chart. */
.compare-options {
  display: flex;
  justify-content: flex-end;
  padding: 0 var(--space-5) var(--space-3);
}
.iap-check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink-3);
  cursor: pointer;
}
.iap-check input {
  width: 14px;
  height: 14px;
  accent-color: var(--g-accent);
}
.diff-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.diff-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: flex-start;
}
.diff-col-head {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin-bottom: var(--space-1);
}
.diff-chip {
  font: var(--text-id-small);
  border-radius: var(--radius-xs);
  padding: var(--space-05) var(--space-2);
  border-left: 4px solid
    color-mix(
      in srgb,
      var(--dept-color, var(--g-line-strong)) var(--dept-rest-mix),
      var(--g-line-strong)
    );
  background: var(--g-surface-2);
  color: var(--g-ink);
}
.diff-chip.add-a {
  background: var(--g-info-tint);
}
.diff-chip.add-b {
  background: var(--g-ok-tint);
}
.diff-none {
  font: var(--text-small);
  color: var(--g-ink-3);
  font-style: italic;
}

.load-chart {
  /* One grid for the whole chart, not one per row: the term column sizes
     to the longest label and every row's bars start at the same x, so bar
     lengths stay comparable down the column. */
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: var(--space-2);
}
.load-row {
  display: contents;
}
.load-term {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.load-bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-05);
}
.load-bar {
  font: var(--text-micro);
  /* on-color for the semantic fills: white in light, near-black in dark;
     white on the dark-theme pastels would sit around 2.3:1 */
  color: var(--g-surface);
  border-radius: var(--radius-xs);
  padding: 0 var(--space-1);
  min-width: 28px;
  height: 14px;
  display: flex;
  align-items: center;
}
.bar-a {
  background: var(--g-info);
}
.bar-b {
  background: var(--g-ok);
}

.compare-same {
  padding: var(--space-8);
  text-align: center;
  font: var(--text-body);
  color: var(--g-ink-3);
}
</style>
