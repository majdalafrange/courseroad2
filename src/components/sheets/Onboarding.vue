<template>
  <!-- Not dismissible: a first-run wizard closes through Skip or the
       final action, never a stray Escape or scrim click. The focus trap
       still applies, and Skip is in the tab order. -->
  <g-sheet
    :model-value="visible"
    label="Set up your road"
    width="540px"
    :dismissible="false"
    scrim="opaque"
  >
    <template #scrim>
      <canvas-glyphs />
    </template>
    <div class="onboard">
      <button class="onboard-skip" @click="skip">Skip</button>

      <!-- step 1: welcome + year -->
      <div v-if="step === 0" class="onboard-step">
        <g-wordmark size="lg" />
        <h1 class="onboard-title">Welcome! Let's set up your road.</h1>
        <p class="onboard-copy">
          Tell us your year and what course you're in, and we'll get you
          started. You can always change these later.
        </p>
        <span id="onboardYearLabel" class="onboard-label">
          What year are you?
        </span>
        <g-radio-group
          v-model="selectedYear"
          class="year-grid"
          aria-labelledby="onboardYearLabel"
        >
          <g-radio-group-item
            v-for="year in years"
            :key="year.value"
            class="year-option"
            :value="year.value"
          >
            {{ year.label }}
          </g-radio-group-item>
        </g-radio-group>
        <div class="onboard-actions">
          <g-button variant="primary" @click="step = 1"> Next </g-button>
        </div>
      </div>

      <!-- step 2: programs -->
      <div v-else class="onboard-step">
        <h1 class="onboard-title">
          What course are you {{ selectedYear === 0 ? "considering" : "in" }}?
        </h1>
        <p class="onboard-copy">
          Add a major, a minor, or both. Skip it for now if you're not sure.
        </p>
        <div class="program-search">
          <g-icon name="search" :size="15" style="color: var(--g-ink-3)" />
          <input
            ref="programInput"
            v-model="programQuery"
            class="program-input"
            placeholder="Search majors and minors..."
          />
        </div>
        <div v-if="chosenPrograms.length" class="chosen-programs">
          <button
            v-for="key in chosenPrograms"
            :key="key"
            class="chosen-chip"
            @click="toggleProgram(key)"
          >
            {{ titleFor(key) }}
            <g-icon name="close" :size="9" />
          </button>
        </div>
        <div class="program-results">
          <button
            v-for="entry in programResults"
            :key="entry.key"
            class="program-result"
            :class="{ chosen: chosenPrograms.includes(entry.key) }"
            @click="toggleProgram(entry.key)"
          >
            <span>{{ entry["medium-title"] }}</span>
            <g-icon
              v-if="chosenPrograms.includes(entry.key)"
              name="check"
              :size="14"
            />
          </button>
        </div>
        <div class="onboard-actions">
          <g-button variant="ghost" @click="step = 0">Back</g-button>
          <g-button variant="primary" @click="finish">
            {{ selectedYear === 0 ? "Build starting plan" : "Start planning" }}
          </g-button>
        </div>
      </div>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import CanvasGlyphs from "../canvas/CanvasGlyphs.vue";
import GButton from "../../design/components/GButton.vue";
import { GRadioGroup, GRadioGroupItem } from "../../design/components/GRadio";
import GSheet from "../../design/components/GSheet.vue";
import GIcon from "../../design/components/GIcon.vue";
import GWordmark from "../../design/components/GWordmark.vue";
import { programTitle, sortCoursesList } from "../../lib/audit";
import { seedCoursesOfStudy, seedSelectedSubjects } from "../../lib/onboarding";
import { useAuditStore } from "../../stores/audit";
import { useCourseDataStore } from "../../stores/courseData";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (
    e: "seed",
    payload: {
      year: number;
      coursesOfStudy: string[];
      selectedSubjects: ReturnType<typeof seedSelectedSubjects>;
    },
  ): void;
}>();

const auditStore = useAuditStore();
const store = useCourseDataStore();

const visible = computed(() => props.modelValue);
const step = ref(0);
const selectedYear = ref(0);
const programQuery = ref("");
const chosenPrograms = ref<string[]>([]);
const programInput = ref<HTMLInputElement>();

const years = [
  { value: 0, label: "First year" },
  { value: 1, label: "Sophomore" },
  { value: 2, label: "Junior" },
  { value: 3, label: "Senior" },
  { value: 4, label: "Fifth year" },
];

watch(step, (s) => {
  if (s === 1) {
    void nextTick(() => programInput.value?.focus());
  }
});

const programResults = computed(() => {
  const query = programQuery.value.trim().toLowerCase();
  return sortCoursesList(auditStore.reqList)
    .filter((entry) => entry.key !== "girs")
    .filter(
      (entry) =>
        query === "" || entry["medium-title"].toLowerCase().includes(query),
    );
});

function titleFor(key: string): string {
  return programTitle(auditStore.reqList, key);
}

function toggleProgram(key: string) {
  if (chosenPrograms.value.includes(key)) {
    chosenPrograms.value = chosenPrograms.value.filter((k) => k !== key);
  } else {
    chosenPrograms.value.push(key);
  }
}

function finish() {
  emit("seed", {
    year: selectedYear.value,
    coursesOfStudy: seedCoursesOfStudy(chosenPrograms.value),
    selectedSubjects: seedSelectedSubjects(selectedYear.value, store.catalog),
  });
  close();
}

function skip() {
  close();
}

function close() {
  emit("update:modelValue", false);
}
</script>

<style scoped>
.onboard {
  position: relative;
  padding: var(--space-8);
}
.onboard-skip {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  font: var(--text-small);
  color: var(--g-ink-3);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs);
}
.onboard-skip:hover {
  color: var(--g-ink);
  background: var(--g-surface-sunken);
}

.onboard-step {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.onboard-title {
  font: var(--text-display);
  margin: var(--space-2) 0 0;
}
.onboard-copy {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: 0;
}
.onboard-label {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin-top: var(--space-2);
}

.year-grid {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
/* :deep(): GRadioGroupItem forwards this class to Reka's own RadioGroupItem
   internals, a grandchild scoped CSS can't otherwise reach. */
:deep(.year-option) {
  flex: 1;
  min-width: 84px;
  font: var(--text-body);
  color: var(--g-ink-2);
  background: var(--g-surface-2);
  border: 1.5px solid var(--g-line);
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-2);
  cursor: pointer;
  transition:
    border-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out);
}
:deep(.year-option:hover) {
  border-color: var(--g-line-strong);
}
:deep(.year-option:focus-visible) {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
:deep(.year-option[data-state="checked"]) {
  border-color: var(--g-accent);
  color: var(--g-ink);
  background: var(--g-accent-tint);
  font-weight: 600;
}

.program-search {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--g-surface);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--g-line-strong);
  padding: 0 var(--space-3);
  height: 38px;
}
.program-input {
  flex: 1;
  font: var(--text-body);
  color: var(--g-ink);
  background: transparent;
  border: none;
  outline: none;
}
.chosen-programs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.chosen-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-small);
  font-weight: 600;
  color: var(--g-on-accent);
  background: var(--g-accent);
  border: none;
  border-radius: var(--radius-full);
  padding: var(--space-05) var(--space-2);
  cursor: pointer;
}
.program-results {
  display: flex;
  flex-direction: column;
  max-height: 240px;
  overflow-y: auto;
}
.program-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font: var(--text-body);
  color: var(--g-ink);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  text-align: left;
}
.program-result:hover {
  background: var(--g-surface-2);
}
.program-result.chosen {
  color: var(--g-accent);
}

.onboard-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
