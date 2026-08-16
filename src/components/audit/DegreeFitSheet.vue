<template>
  <g-sheet
    :model-value="modelValue"
    label="Closest majors and minors"
    width="620px"
    :close-button="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="fit" data-cy="degreeFit">
      <header class="fit-head">
        <div class="fit-title-block">
          <h2 class="fit-title">Closest majors and minors</h2>
          <p class="fit-sub">
            Every major and minor measured against this road, by FireRoad's own
            audit. Majors and minors are ranked separately because their
            requirement counts are not the same scale.
          </p>
        </div>
        <button class="fit-close" aria-label="Close" @click="close">
          <g-icon name="close" :size="16" />
        </button>
      </header>

      <!-- scan state -->
      <div class="fit-bar">
        <template v-if="fit.scanning">
          <div
            class="scan-track"
            role="progressbar"
            :aria-valuenow="fit.percentDone"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Checking majors and minors, ${fit.percentDone}% done`"
          >
            <span class="scan-fill" :style="{ width: fit.percentDone + '%' }" />
          </div>
          <span class="scan-note">
            Checking {{ fit.completed }} of {{ fit.total }}
          </span>
          <g-button size="sm" variant="ghost" @click="fit.cancel()">
            Stop
          </g-button>
        </template>
        <template v-else-if="fit.status === 'ready'">
          <span class="scan-note">
            {{ summary }}
            <template v-if="fit.stale">
              Your road changed since this ran.
            </template>
          </span>
          <g-button size="sm" variant="subtle" @click="fit.scan(true)">
            {{ fit.stale ? "Check again" : "Refresh" }}
          </g-button>
        </template>
        <template v-else-if="fit.status === 'error'">
          <span class="scan-note scan-error">{{ fit.error }}</span>
          <g-button size="sm" variant="primary" @click="fit.scan(true)">
            Try again
          </g-button>
        </template>
      </div>

      <div class="fit-body">
        <div v-if="fit.status === 'idle' && !fit.scanning" class="fit-idle">
          <p>
            This runs the road against
            <template v-if="programCount">
              all {{ programCount }} majors and minors
            </template>
            <template v-else>every major and minor</template>
            FireRoad publishes, one request each. It takes a few seconds.
          </p>
          <g-button variant="primary" @click="fit.scan()">
            Check this road
          </g-button>
        </div>

        <template v-else>
          <!-- Majors and minors are separate rankings, so they are
                   separate tabs rather than one scroll. -->
          <div
            v-if="anyRanked"
            ref="tablistEl"
            class="fit-tabs"
            role="tablist"
            aria-label="Majors or minors"
            @keydown="onTablistKeydown"
          >
            <button
              v-for="option in TABS"
              :id="`fit-tab-${option}`"
              :key="option"
              class="fit-tab"
              :class="{ active: tab === option }"
              role="tab"
              :aria-selected="tab === option"
              :aria-controls="`fit-panel-${option}`"
              :tabindex="tab === option ? 0 : -1"
              :data-cy="`degreeFitTab-${option}`"
              @click="tab = option"
            >
              {{ option === "majors" ? "Majors" : "Minors" }}
              <span class="tab-count">{{ groups[option].length }}</span>
            </button>
          </div>

          <!-- Both panels stay mounted so each tab's aria-controls
                   resolves; v-show keeps the inactive one out of the
                   accessibility tree. -->
          <section
            v-for="option in anyRanked ? TABS : []"
            v-show="tab === option"
            :id="`fit-panel-${option}`"
            :key="option"
            class="fit-section"
            role="tabpanel"
            :aria-labelledby="`fit-tab-${option}`"
            tabindex="0"
          >
            <fit-row
              v-for="(row, i) in visible(groups[option], option)"
              :key="row.key"
              :fit="row"
              :rank="i + 1"
              @preview="preview(row.key)"
              @add="add(row.key)"
            />
            <p v-if="!groups[option].length" class="fit-section-note">
              No {{ option }} were ranked.
            </p>
            <button
              v-if="groups[option].length > shown[option]"
              class="fit-more"
              @click="shown[option] += PAGE"
            >
              Show {{ remainingCount(groups[option], option) }} more
            </button>
          </section>

          <!-- Below the tabs, not inside one: these span both types, and
                   a program the scan could not measure is an unanswered
                   question rather than a zero. -->
          <section v-if="groups.unranked.length" class="fit-section">
            <h3 class="fit-section-head">No progress reported</h3>
            <p class="fit-section-note">
              FireRoad answered for these but gave no percentage, so they hold
              no place in the ranking.
            </p>
            <div
              v-for="row in groups.unranked"
              :key="row.key"
              class="fit-plain"
            >
              <span class="plain-title">{{ row.title }}</span>
              <g-button size="sm" variant="ghost" @click="preview(row.key)">
                What if?
              </g-button>
            </div>
          </section>

          <section v-if="groups.failed.length" class="fit-section">
            <h3 class="fit-section-head">Could not be checked</h3>
            <div v-for="row in groups.failed" :key="row.key" class="fit-plain">
              <span class="plain-title">{{ row.title }}</span>
              <span class="plain-error">{{ row.error }}</span>
            </div>
          </section>

          <p v-if="fit.status === 'ready' && !anyResults" class="fit-empty">
            No majors or minors came back.
          </p>
        </template>
      </div>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import GButton from "../../design/components/GButton.vue";
import GSheet from "../../design/components/GSheet.vue";
import GIcon from "../../design/components/GIcon.vue";
import FitRow from "./FitRow.vue";
import type { ProgramFit } from "../../lib/degreeFit";
import { scannablePrograms } from "../../lib/degreeFit";
import { useAuditStore } from "../../stores/audit";
import { useCourseDataStore } from "../../stores/courseData";
import { useDegreeFitStore } from "../../stores/degreeFit";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const store = useCourseDataStore();
const auditStore = useAuditStore();
const fit = useDegreeFitStore();

/** How many rows each ranked group reveals at a time. */
const PAGE = 10;
const TABS = ["majors", "minors"] as const;
type Tab = (typeof TABS)[number];

const shown = reactive({ majors: PAGE, minors: PAGE });
const tab = ref<Tab>("majors");
const tablistEl = ref<HTMLElement>();

const groups = computed(() => fit.groups);
const anyRanked = computed(
  () => groups.value.majors.length > 0 || groups.value.minors.length > 0,
);
const programCount = computed(
  () => scannablePrograms(auditStore.reqList).length,
);
const anyResults = computed(
  () =>
    groups.value.majors.length > 0 ||
    groups.value.minors.length > 0 ||
    groups.value.unranked.length > 0 ||
    groups.value.failed.length > 0,
);

/**
 * What the scan actually established. Programs it could not measure are
 * counted out loud, so a partial answer never reads as a complete one.
 */
const summary = computed(() => {
  const ranked = fit.rankedCount;
  const missed = groups.value.unranked.length + groups.value.failed.length;
  if (missed === 0) {
    return `${ranked} majors and minors checked.`;
  }
  return `${ranked} of ${ranked + missed} ranked. ${missed} could not be checked.`;
});

function visible(rows: ProgramFit[], group: Tab): ProgramFit[] {
  return rows.slice(0, shown[group]);
}

function remainingCount(rows: ProgramFit[], group: Tab): number {
  return rows.length - shown[group];
}

/** Arrow, Home and End move between tabs, per the ARIA tabs pattern. */
function onTablistKeydown(event: KeyboardEvent) {
  const index = TABS.indexOf(tab.value);
  let next = index;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    next = (index + 1) % TABS.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    next = (index - 1 + TABS.length) % TABS.length;
  } else if (event.key === "Home") {
    next = 0;
  } else if (event.key === "End") {
    next = TABS.length - 1;
  } else {
    return;
  }
  event.preventDefault();
  tab.value = TABS[next];
  // Roving tabindex: focus follows selection so the arrows keep working.
  void nextTick(() => {
    tablistEl.value
      ?.querySelector<HTMLElement>(`#fit-tab-${TABS[next]}`)
      ?.focus();
  });
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      shown.majors = PAGE;
      shown.minors = PAGE;
      tab.value = "majors";
    } else {
      // A scan the student walked away from should stop asking FireRoad.
      fit.cancel();
    }
  },
);

function preview(key: string) {
  void auditStore.startPreview(key);
  close();
}

function add(key: string) {
  store.addReq(key);
  close();
}

function close() {
  emit("update:modelValue", false);
}
</script>

<style scoped>
.fit {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.fit-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--g-line);
}
.fit-title {
  font: var(--text-title);
  margin: 0;
}
.fit-sub {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin: var(--space-1) 0 0;
  max-width: 46ch;
}
.fit-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
}
.fit-close:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}

.fit-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 34px;
  padding: var(--space-2) var(--space-5);
  border-bottom: 1px solid var(--g-line);
}
.fit-bar:empty {
  display: none;
}
.scan-track {
  flex: 1;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--g-surface-sunken);
  overflow: hidden;
}
.scan-fill {
  display: block;
  height: 100%;
  background: var(--g-accent);
  transition: width var(--motion-quick) var(--ease-out);
}
.scan-note {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.scan-error {
  color: var(--g-danger);
}

.fit-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-5) var(--space-5);
}
.fit-idle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}
.fit-idle p {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: 0;
  max-width: 48ch;
}

/* Majors ⁄ Minors is a mode, so it uses the header's segmented-control
   recipe rather than inventing a second tab look. */
.fit-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--g-surface-sunken);
  border-radius: var(--radius-sm);
  padding: 2px;
  margin-bottom: var(--space-3);
}
.fit-tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  font-weight: 500;
  color: var(--g-ink-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  height: 24px;
  padding: 0 var(--space-3);
  cursor: pointer;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out),
    box-shadow var(--motion-quick) var(--ease-out);
}
.fit-tab:hover {
  color: var(--g-ink);
}
.fit-tab.active {
  background: var(--g-surface);
  color: var(--g-ink);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--g-line);
}
.tab-count {
  font: var(--text-micro);
  color: var(--g-ink-3);
}
.fit-tab.active .tab-count {
  color: var(--g-ink-2);
}
/* The panel is focusable for the tabs pattern; it should not draw a ring
   on mouse focus, only on keyboard. */
.fit-section:focus {
  outline: none;
}
.fit-section:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
  border-radius: var(--radius-md);
}
.fit-tab:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

.fit-section + .fit-section {
  margin-top: var(--space-5);
}
.fit-section-head {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin: 0 0 var(--space-2);
}
.fit-section-note {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin: 0 0 var(--space-2);
}
.fit-more {
  width: 100%;
  margin-top: var(--space-2);
  padding: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink-2);
  background: transparent;
  border: 1px solid var(--g-line);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.fit-more:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}

.fit-plain {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--g-line);
}
.plain-title {
  flex: 1;
  font: var(--text-body);
  color: var(--g-ink-2);
}
.plain-error {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.fit-empty {
  font: var(--text-body);
  color: var(--g-ink-3);
}

/* Durations come from the tokens, which reduced-motion already zeroes. */
</style>
