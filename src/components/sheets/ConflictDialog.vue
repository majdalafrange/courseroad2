<template>
  <g-sheet
    :model-value="conflictInfo !== undefined && conflictDialog"
    label="Save conflict"
    width="680px"
    :dismissible="false"
  >
    <div v-if="conflictInfo !== undefined" class="conflict">
      <header class="conflict-head">
        <h2 class="conflict-title">This road changed in two places</h2>
        <p class="conflict-sub">
          “{{ roads[conflictInfo.id]?.name }}” was edited here and in another
          tab or device. Keep one version. The other is discarded.
        </p>
      </header>

      <div class="conflict-cols">
        <div
          v-for="side in ['remote', 'local']"
          :key="side"
          class="conflict-col"
          :class="side"
        >
          <span class="col-tag">{{
            side === "remote" ? "From the cloud" : "This tab"
          }}</span>
          <dl class="col-facts">
            <dt>Saved by</dt>
            <dd>{{ agentFor(side) }}</dd>
            <dt>When</dt>
            <dd>{{ dateFor(side) }}</dd>
          </dl>
          <div class="col-subjects">
            <span
              v-for="(course, index) in subjectsFor(side)"
              :key="JSON.stringify(course) + index"
              class="col-subject"
              :class="{ changed: isChanged(index, side) }"
            >
              {{ course.subject_id }}
            </span>
          </div>
          <g-button
            variant="primary"
            @click="
              side === 'remote'
                ? auth.updateLocal(conflictInfo.id)
                : auth.updateRemote(conflictInfo.id)
            "
          >
            Keep this one
          </g-button>
        </div>
      </div>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GButton from "../../design/components/GButton.vue";
import GSheet from "../../design/components/GSheet.vue";
import { flatten } from "../../lib/types";
import type { SelectedSubject } from "../../lib/types";
import { useAuthStore } from "../../stores/auth";
import { useCourseDataStore } from "../../stores/courseData";

const auth = useAuthStore();
const store = useCourseDataStore();

const conflictInfo = computed(() => auth.conflictInfo);
const conflictDialog = computed(() => auth.conflictDialog);
const roads = computed(() => store.roads);

const localFlatSubjects = computed<SelectedSubject[]>(() => {
  if (conflictInfo.value === undefined) {
    return [];
  }
  return flatten(roads.value[conflictInfo.value.id].contents.selectedSubjects);
});

function subjectsFor(side: string): SelectedSubject[] {
  if (conflictInfo.value === undefined) {
    return [];
  }
  return side === "remote"
    ? conflictInfo.value.other_contents.selectedSubjects
    : localFlatSubjects.value;
}

function agentFor(side: string): string {
  if (conflictInfo.value === undefined) {
    return "";
  }
  return side === "remote"
    ? conflictInfo.value.other_agent
    : roads.value[conflictInfo.value.id]?.agent ?? "";
}

function dateFor(side: string): string {
  if (conflictInfo.value === undefined) {
    return "";
  }
  const raw =
    side === "remote"
      ? conflictInfo.value.other_date
      : roads.value[conflictInfo.value.id]?.changed ?? "";
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? raw : parsed.toLocaleString();
}

/* ---- change highlighting (ported from the legacy diff coloring) ---- */
function count(arr: string[], elem: string): number {
  return arr.reduce((n, e) => (e === elem ? n + 1 : n), 0);
}
function renumberDuplicates(arr: string[]): string[] {
  return arr.map((elem, index) => {
    if (count(arr, elem) > 1) {
      const appendNumber = count(arr.slice(0, index), elem);
      if (appendNumber > 0) {
        return elem + "-" + appendNumber.toString();
      }
    }
    return elem;
  });
}
function diff(a1: string[], a2: string[]): string[] {
  return a1.filter((i) => a2.indexOf(i) === -1);
}

function isChanged(subjectIndex: number, side: string): boolean {
  if (conflictInfo.value === undefined) {
    return false;
  }
  const remote = renumberDuplicates(
    conflictInfo.value.other_contents.selectedSubjects.map(
      (s) => s.subject_id + " " + s.semester,
    ),
  );
  const local = renumberDuplicates(
    localFlatSubjects.value.map((s) => s.subject_id + " " + s.semester),
  );
  if (side === "remote") {
    return diff(remote, local).indexOf(remote[subjectIndex]) >= 0;
  }
  return diff(local, remote).indexOf(local[subjectIndex]) >= 0;
}
</script>

<style scoped>
.conflict {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.conflict-head {
  padding: var(--space-5) var(--space-5) var(--space-3);
}
.conflict-title {
  font: var(--text-title);
  margin: 0;
}
.conflict-sub {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: var(--space-2) 0 0;
}
.conflict-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  padding: 0 var(--space-5) var(--space-5);
  overflow-y: auto;
}
.conflict-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--g-surface-2);
  border: 1px solid var(--g-line);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
.col-tag {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.col-facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px var(--space-3);
  margin: 0;
}
.col-facts dt {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.col-facts dd {
  font: var(--text-small);
  color: var(--g-ink);
  margin: 0;
}
.col-subjects {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  flex: 1;
  align-content: flex-start;
}
.col-subject {
  font: var(--text-id-small);
  color: var(--g-ink-2);
  background: var(--g-surface);
  border-radius: var(--radius-xs);
  padding: 1px var(--space-1);
}
.col-subject.changed {
  background: var(--g-info-tint);
  color: var(--g-info);
  font-weight: 600;
}
</style>
