<template>
  <div class="audit-panel" :class="{ 'is-ledger': ledger }" data-cy="auditBox">
    <suggestion-strip v-if="!ledger" @see-all="onSeeAll" />

    <!-- program picker -->
    <div v-if="!ledger" class="picker">
      <g-popover v-model="pickerOpen">
        <template #anchor>
          <button
            class="picker-trigger"
            data-cy="auditMajorChips"
            @click="openPicker"
          >
            <g-icon name="plus" :size="13" />
            <span>{{
              selectedReqs.length
                ? "Add a major or minor"
                : "Pick your majors and minors"
            }}</span>
          </button>
        </template>
        <div class="picker-pop" @click.stop>
          <g-input
            ref="pickerInput"
            v-model="pickerQuery"
            placeholder="Majors, minors, GIRs…"
            @keydown.esc.stop="pickerOpen = false"
          />
          <div class="picker-list">
            <div
              v-for="entry in pickerResults"
              :key="entry.key"
              class="picker-row"
            >
              <span class="picker-name">{{ entry["medium-title"] }}</span>
              <g-button
                size="sm"
                variant="ghost"
                @click="previewProgram(entry.key)"
              >
                What if?
              </g-button>
              <g-button
                size="sm"
                variant="primary"
                :data-cy="'addProgram' + entry.key"
                @click="addProgram(entry.key)"
              >
                Add
              </g-button>
            </div>
            <span v-if="!pickerResults.length" class="picker-empty">
              Nothing matches.
            </span>
          </div>
        </div>
      </g-popover>

      <button
        class="picker-trigger fit-trigger"
        data-cy="openDegreeFit"
        @click="fitOpen = true"
      >
        <g-icon name="graph" :size="13" />
        <span>Closest majors and minors</span>
      </button>
    </div>

    <degree-fit-sheet v-model="fitOpen" />

    <!-- what-if preview -->
    <program-section
      v-if="auditStore.previewProgram !== null"
      :program-key="auditStore.previewProgram"
      :tree="previewTreeWithIds"
      :title="titleFor(auditStore.previewProgram)"
      preview
      :collapsed="ledger"
    />

    <!-- committed programs -->
    <program-section
      v-for="(req, index) in selectedReqs"
      :key="req"
      :program-key="req"
      :tree="treeFor(req, index)"
      :title="titleFor(req)"
      :start-open="index === 0"
      :collapsed="ledger"
      @remove="removeProgram(req)"
    />

    <div v-if="!selectedReqs.length" class="audit-empty">
      Pick a program to see your distance to the degree.
    </div>

    <div v-if="!ledger" class="audit-links">
      <a
        v-for="courseLink in courseLinks"
        :key="courseLink.link"
        :href="courseLink.link"
        target="_blank"
        rel="noopener"
        class="audit-link"
        >{{ courseLink.text }} ↗</a
      >
      <a
        href="https://mit.turbovote.org/"
        target="_blank"
        rel="noopener"
        class="audit-link"
        >Register to vote ↗</a
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GButton from "../../design/components/GButton.vue";
import GIcon from "../../design/components/GIcon.vue";
import GInput from "../../design/components/GInput.vue";
import GPopover from "../../design/components/GPopover.vue";
import DegreeFitSheet from "./DegreeFitSheet.vue";
import ProgramSection from "./ProgramSection.vue";
import SuggestionStrip from "./SuggestionStrip.vue";
import { assignListIDs, programTitle, sortCoursesList } from "../../lib/audit";
import { getCourseLinks } from "../../lib/courseLinks";
import { toast } from "../../design/toast";
import type { RequirementNode } from "../../lib/types";
import { useAuditStore } from "../../stores/audit";
import { useCourseDataStore } from "../../stores/courseData";
import { requestPalette } from "../../stores/palette";

/**
 * ledger: the compact mode used while a class detail is stacked below.
 * Each program keeps its ring, title, and percent; the strip, picker,
 * degree-fit trigger, links, and program bodies are hidden. The student's
 * expansion state is untouched (see ProgramSection's collapsed prop).
 */
defineProps<{
  ledger?: boolean;
}>();

const store = useCourseDataStore();
const auditStore = useAuditStore();

const pickerOpen = ref(false);
const fitOpen = ref(false);
const pickerQuery = ref("");
const pickerInput = ref<InstanceType<typeof GInput>>();

const selectedReqs = computed(
  () => store.roads[store.activeRoad]?.contents.coursesOfStudy ?? [],
);

const courseLinks = computed(() => getCourseLinks(selectedReqs.value));

const sortedPrograms = computed(() => sortCoursesList(auditStore.reqList));

const pickerResults = computed(() => {
  const query = pickerQuery.value.trim().toLowerCase();
  return sortedPrograms.value
    .filter((entry) => !selectedReqs.value.includes(entry.key))
    .filter(
      (entry) =>
        query === "" ||
        entry["medium-title"].toLowerCase().includes(query) ||
        entry.key.toLowerCase().includes(query),
    );
});

function openPicker() {
  pickerOpen.value = !pickerOpen.value;
  if (pickerOpen.value) {
    pickerQuery.value = "";
    /* setTimeout, not nextTick: the popover measures itself behind
       visibility:hidden for a tick, and a hidden input refuses focus */
    setTimeout(() => pickerInput.value?.focus());
  }
}

function addProgram(key: string) {
  store.addReq(key);
  pickerOpen.value = false;
}

function previewProgram(key: string) {
  auditStore.startPreview(key);
  pickerOpen.value = false;
}

function removeProgram(key: string) {
  store.removeReq(key);
  toast.undoable(`Removed ${titleFor(key)}`, () => {
    store.addReq(key);
  });
}

function titleFor(key: string): string {
  return programTitle(auditStore.reqList, key);
}

function treeFor(req: string, index: number): RequirementNode | null {
  const tree = auditStore.reqTrees[req];
  if (tree === undefined) {
    return null;
  }
  return assignListIDs(Object.assign({}, tree) as RequirementNode, index);
}

function onSeeAll(tokens: string[]) {
  requestPalette({ tokens });
}

const previewTreeWithIds = computed(() => {
  if (auditStore.previewTree === null) {
    return null;
  }
  return assignListIDs(
    Object.assign({}, auditStore.previewTree) as RequirementNode,
    999,
  );
});
</script>

<style scoped>
.audit-panel {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}
/* Ledger: hold only the program rows, capped so many programs still
   leave the detail its height. */
.audit-panel.is-ledger {
  flex: none;
  flex-shrink: 0;
  max-height: 30vh;
  overflow-y: auto;
  padding: var(--space-2) var(--space-4);
}

.picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.picker-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  font-weight: 500;
  color: var(--g-ink-2);
  background: var(--g-surface-2);
  border: 1px dashed var(--g-line-strong);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-3);
  cursor: pointer;
  transition:
    color var(--motion-quick) var(--ease-out),
    border-color var(--motion-quick) var(--ease-out);
}
.picker-trigger:hover {
  color: var(--g-accent);
  border-color: var(--g-accent);
}
.picker-trigger:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

.picker-pop {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 290px;
}
.picker-list {
  display: flex;
  flex-direction: column;
  max-height: 300px;
  overflow-y: auto;
}
.picker-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}
.picker-name {
  font: var(--text-small);
  color: var(--g-ink);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-empty {
  font: var(--text-small);
  color: var(--g-ink-3);
  padding: var(--space-2);
}

.audit-empty {
  font: var(--text-small);
  color: var(--g-ink-3);
  padding: var(--space-4) var(--space-2);
}

.audit-links {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--g-line);
}
.audit-link {
  font: var(--text-small);
  color: var(--g-ink-3);
  text-decoration: none;
}
.audit-link:hover {
  color: var(--g-accent);
}
</style>
