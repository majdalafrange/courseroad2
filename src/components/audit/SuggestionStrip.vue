<template>
  <div
    v-if="suggestions.length && !dismissed && store.hasGIRReqList"
    class="suggestion-strip"
  >
    <div class="strip-head">
      <div class="strip-title">
        <span class="strip-label">Suggestions</span>
        <g-popover v-model="infoOpen">
          <template #anchor="{ toggle }">
            <button
              class="strip-info"
              data-cy="suggestionsInfo"
              aria-label="How suggestions are produced"
              :aria-expanded="infoOpen"
              @click="toggle"
            >
              <g-icon name="notice" :size="13" />
            </button>
          </template>
          <p class="strip-explain">
            Generated using your progress towards the GIRs.
          </p>
        </g-popover>
      </div>
      <button
        class="strip-dismiss"
        aria-label="Dismiss suggestions"
        @click="dismiss"
      >
        <g-icon name="close" :size="12" />
      </button>
    </div>
    <div
      v-for="suggestion in suggestions.slice(0, 2)"
      :key="suggestion.attribute"
      class="suggestion"
    >
      <p class="suggestion-headline">
        {{ suggestion.headline }}.
        <span class="suggestion-term">Offered this {{ suggestion.term }}:</span>
      </p>
      <div class="suggestion-classes">
        <button
          v-for="candidate in suggestion.classes.slice(0, 3)"
          :key="candidate.subject.subject_id"
          class="suggestion-class"
          :style="{ '--dept-color': courseColor(candidate.subject) }"
          :title="candidate.subject.title"
          @pointerdown="dragClass($event, candidate.subject)"
          @click="openClass(candidate.subject)"
        >
          <span class="sc-id">{{ candidate.subject.subject_id }}</span>
          <span v-if="candidate.rating" class="sc-rating"
            ><g-icon name="star" :size="10" />{{
              candidate.rating.toFixed(1)
            }}</span
          >
        </button>
        <button
          class="suggestion-more"
          @click="emit('see-all', suggestion.tokens)"
        >
          see all
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GIcon from "../../design/components/GIcon.vue";
import GPopover from "../../design/components/GPopover.vue";
import { courseColor } from "../../lib/colors";
import { buildSuggestions } from "../../lib/suggestions";
import type { Subject } from "../../lib/types";
import { useAuditStore } from "../../stores/audit";
import { useCourseDataStore } from "../../stores/courseData";
import { pointerDown } from "../../stores/dragdrop";

const emit = defineEmits<{
  (e: "see-all", tokens: string[]): void;
}>();

const store = useCourseDataStore();
const auditStore = useAuditStore();

const dismissed = ref(false);
const infoOpen = ref(false);

const suggestions = computed(() => {
  const road = store.roads[store.activeRoad];
  if (road === undefined) {
    return [];
  }
  return buildSuggestions({
    catalog: store.catalog,
    reqTrees: auditStore.reqTrees,
    selectedSubjects: road.contents.selectedSubjects,
    currentSemester: store.currentSemester,
    hideIAP: store.hideIAP,
  });
});

function openClass(subject: Subject) {
  store.pushClassStack(subject.subject_id);
}

function dragClass(event: PointerEvent, subject: Subject) {
  store.dragStartClass({ classInfo: subject });
  pointerDown(event, { subject, isNew: true });
}

function dismiss() {
  dismissed.value = true;
}
</script>

<style scoped>
/* Audit gaps, not a recommendation widget: no card, no fill. A hairline
   separates it from the programs below. */
.suggestion-strip {
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-3);
  border-bottom: 1px solid var(--g-line);
}
.strip-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}
.strip-title {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.strip-label {
  /* a label, not an action: accent never decorates */
  font: var(--text-small);
  color: var(--g-ink-3);
}
.strip-info {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
}
.strip-info:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}
.strip-info:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.strip-explain {
  max-width: 320px;
  font: var(--text-small);
  color: var(--g-ink-2);
  margin: 0;
}
.strip-dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
}
.strip-dismiss:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}

.suggestion {
  margin-top: var(--space-2);
}
.suggestion-headline {
  font: var(--text-small);
  color: var(--g-ink-2);
  margin: 0 0 var(--space-2);
}
.suggestion-term {
  color: var(--g-ink-3);
}
.suggestion-classes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
/* the shared course-chip anatomy (see tokens.css): solid department
   color, not a rail beside it. A preview of the card it would become. */
.suggestion-class {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font: var(--text-id-small);
  color: var(--dept-on);
  height: 22px;
  background: var(--dept-color, var(--g-line-strong));
  border: none;
  border-radius: var(--radius-sm);
  padding: 0 var(--space-2);
  cursor: pointer;
  transition: box-shadow var(--motion-quick) var(--ease-out);
}
.suggestion-class:hover {
  box-shadow: 0 0 0 1.5px var(--g-accent);
}
.sc-rating {
  display: inline-flex;
  align-items: center;
  gap: var(--space-05);
  font: var(--text-micro);
  color: var(--dept-on-2);
}
.suggestion-more {
  font: var(--text-id-small);
  color: var(--g-accent);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: var(--space-05) var(--space-2);
}
.suggestion-more:hover {
  text-decoration: underline;
}
</style>
