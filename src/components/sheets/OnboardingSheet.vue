<template>
  <!-- Not dismissible: a first-run wizard closes through Skip or the
       final action, never a stray Escape or scrim click. The focus trap
       still applies, and Skip is in the tab order. -->
  <BaseSheet
    :model-value="isOpen"
    label="Set up your road"
    width="540px"
    :dismissible="false"
    :auto-focus="false"
    scrim="opaque"
  >
    <template #scrim>
      <CanvasGlyphs />
    </template>
    <div class="onboard">
      <!-- step 1: welcome + year -->
      <div v-if="step === 0" class="onboard-step">
        <BaseWordmark size="lg" />
        <h1 class="onboard-title">Set up your road</h1>
        <p class="onboard-copy">
          Pick your class year and program. You can change both later.
        </p>
        <span id="onboardYearLabel" class="onboard-label">
          What year are you?
        </span>
        <BaseRadioGroup
          v-model="selectedYear"
          class="year-grid"
          aria-labelledby="onboardYearLabel"
        >
          <BaseRadioGroupItem
            v-for="year in years"
            :key="year.value"
            class="year-option"
            :choice="true"
            :value="year.value"
          >
            {{ year.label }}
          </BaseRadioGroupItem>
        </BaseRadioGroup>
        <div class="onboard-actions">
          <BaseButton variant="primary" @click="step = 1"> Next </BaseButton>
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
        <BaseInput
          ref="programInput"
          v-model="programQuery"
          placeholder="Search majors and minors..."
          aria-label="Search majors and minors"
        >
          <template #leading>
            <BaseIcon
              name="search"
              :size="15"
              style="color: var(--base-ink-3)"
            />
          </template>
        </BaseInput>
        <div v-if="chosenPrograms.length" class="chosen-programs">
          <button
            v-for="key in chosenPrograms"
            :key="key"
            class="chosen-chip"
            :aria-label="`Remove ${titleFor(key)}`"
            @click="toggleProgram(key)"
          >
            {{ titleFor(key) }}
            <BaseIcon name="close" :size="9" />
          </button>
        </div>
        <BaseToggleGroupRoot
          v-model="chosenPrograms"
          class="program-results"
          aria-label="Majors and minors"
          orientation="vertical"
        >
          <BaseToggleGroupItem
            v-for="entry in programResults"
            :key="entry.key"
            :value="entry.key"
            as-child
          >
            <button type="button" class="program-result">
              <span>{{ entry["medium-title"] }}</span>
              <BaseIcon
                v-if="chosenPrograms.includes(entry.key)"
                name="check"
                :size="14"
              />
            </button>
          </BaseToggleGroupItem>
        </BaseToggleGroupRoot>
        <p
          v-if="programResults.length === 0"
          class="program-empty"
          role="status"
        >
          <template v-if="programQuery.trim() !== ''">
            No major or minor matches "{{ programQuery.trim() }}".
          </template>
          <template v-else-if="reqListStatus === 'error'">
            The list of majors and minors didn't load.
            <BaseButton variant="link" size="sm" @click="refetchReqList()"
              >Try again</BaseButton
            >
          </template>
          <template v-else-if="reqListStatus === 'pending'"
            >Loading majors and minors...</template
          >
          <template v-else>No majors or minors are available.</template>
        </p>
        <div class="onboard-actions">
          <BaseButton variant="ghost" @click="step = 0">Back</BaseButton>
          <BaseButton variant="primary" @click="finish">
            {{ selectedYear === 0 ? "Build starting plan" : "Start planning" }}
          </BaseButton>
        </div>
      </div>

      <!-- Last in DOM order (absolutely positioned top-right), so Tab
           reaches the step's own controls before the way out. -->
      <BaseButton variant="ghost" size="sm" class="onboard-skip" @click="skip"
        >Skip</BaseButton
      >
    </div>
  </BaseSheet>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import CanvasGlyphs from "../canvas/CanvasGlyphs.vue";
import {
  BaseToggleGroupItem,
  BaseToggleGroupRoot,
} from "../../design/components/BaseToggleGroup";
import BaseButton from "../../design/components/BaseButton.vue";
import BaseInput from "../../design/components/BaseInput.vue";
import {
  BaseRadioGroup,
  BaseRadioGroupItem,
} from "../../design/components/BaseRadio";
import BaseSheet from "../../design/components/BaseSheet.vue";
import BaseIcon from "../../design/components/BaseIcon.vue";
import BaseWordmark from "../../design/components/BaseWordmark.vue";
import { programTitle, sortCoursesList } from "../../lib/audit";
import { seedCoursesOfStudy, seedSelectedSubjects } from "../../lib/onboarding";
import { useReqListLoader } from "../../loaders/courseData";
import { useAuditStore } from "../../stores/audit";
import { useCourseDataStore } from "../../stores/courseData";

const isOpen = defineModel<boolean>({ required: true });

const emit = defineEmits<{
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
const { status: reqListStatus, refetch: refetchReqList } = useReqListLoader();

const step = ref(0);
const selectedYear = ref(0);
const programQuery = ref("");
const chosenPrograms = ref<string[]>([]);
const programInput = useTemplateRef("programInput");

const years = [
  { value: 0, label: "First year" },
  { value: 1, label: "Sophomore" },
  { value: 2, label: "Junior" },
  { value: 3, label: "Senior" },
  { value: 4, label: "Fifth year" },
];

// Each step replaces the other, and the control that changed it goes
// with it; focus moves to the new step instead of falling to the panel.
watch(step, (s) => {
  void nextTick(() => {
    if (s === 1) {
      programInput.value?.focus();
    } else {
      (
        document.querySelector<HTMLElement>(
          '.year-option[data-state="checked"]',
        ) ?? document.querySelector<HTMLElement>(".year-option")
      )?.focus();
    }
  });
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
  isOpen.value = false;
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
  color: var(--base-ink-2);
  margin: 0;
}
.onboard-label {
  font: var(--text-small);
  color: var(--base-ink-3);
  margin-top: var(--space-2);
}

.year-grid {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
/* :deep(): BaseRadioGroupItem forwards this class to Reka's own RadioGroupItem
   internals, a grandchild scoped CSS can't otherwise reach. */
/* Surface and states come from BaseRadioGroupItem's `choice` prop. */
:deep(.year-option) {
  flex: 1;
  min-width: 84px;
  font: var(--text-body);
  padding: var(--space-3) var(--space-2);
}
:deep(.year-option[data-state="checked"]) {
  font-weight: 600;
}

.chosen-programs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.chosen-chip {
  /* 24px: the minimum target size (WCAG 2.5.8) */
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-small);
  font-weight: 600;
  color: var(--base-on-accent);
  background: var(--base-accent);
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
  color: var(--base-ink);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  text-align: left;
}
/* Touch tier (tokens.css). */
@media (max-width: 859px) and (pointer: coarse) {
  .program-result {
    min-height: 44px;
  }
}
.program-empty {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  font: var(--text-small);
  color: var(--base-ink-2);
}
.program-result:hover {
  background: var(--base-surface-2);
}
.program-result[data-state="on"] {
  color: var(--base-accent);
}

.onboard-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
