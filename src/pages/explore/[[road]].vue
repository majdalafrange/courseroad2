<template>
  <main
    id="exploreMain"
    class="connections"
    tabindex="-1"
    aria-label="Connections"
  >
    <connections-toolbar v-if="store.status === 'ready'" />

    <div
      class="connections-body"
      :class="{ 'panel-left': courseData.panelSide === 'left' }"
    >
      <div v-if="store.status === 'loading'" class="state-fill" role="status">
        <div class="skeleton-graph" aria-hidden="true">
          <span v-for="i in 6" :key="i" class="skeleton-node" />
        </div>
        <p class="state-text">Building the graph...</p>
      </div>

      <div v-else-if="store.status === 'error'" class="state-fill" role="alert">
        <h2 class="state-title">The subject catalog didn't load.</h2>
        <p class="state-text">
          Connections needs the catalog to draw your graph. Check your network
          and try again.
        </p>
        <g-button variant="primary" @click="store.retry()">Try again</g-button>
      </div>

      <!-- cold start / empty -->
      <div v-else-if="store.status === 'empty'" class="state-fill">
        <h2 class="state-title">Pick a starting class</h2>
        <p class="state-text">
          {{
            roadEmpty
              ? "Your road is empty. Pick a class to start from."
              : "Pick a class to start from, or start from the classes on your road."
          }}
        </p>
        <div class="seed-search">
          <g-combobox-root ref="seedCombo" :open="seedResults.length > 0">
            <g-combobox-input
              ref="seedInput"
              v-model="seedQuery"
              class="seed-input"
              shell
              placeholder="Search for a class to start from..."
              aria-label="Search for a starting class"
            />
            <g-combobox-list label="Starting classes" class="seed-results">
              <g-combobox-item
                v-for="s in seedResults"
                :key="s.subject_id"
                :value="s.subject_id"
                class="seed-result"
                @select="store.seedFrom(s.subject_id)"
              >
                <span
                  class="seed-bar"
                  :style="{ background: courseColor(s) }"
                />
                <span class="seed-id">{{ s.subject_id }}</span>
                <span class="seed-title">{{ s.title }}</span>
              </g-combobox-item>
            </g-combobox-list>
          </g-combobox-root>
          <p v-if="seedNoMatch" class="seed-empty" role="status">
            No class matches "{{ seedQuery.trim() }}". Try a subject number,
            like 6.1210, or words from the title.
          </p>
        </div>
        <g-button
          v-if="!roadEmpty"
          variant="ghost"
          @click="store.reseedFromRoad()"
        >
          Start from my road
        </g-button>
      </div>

      <!-- ready -->
      <connections-canvas v-else @open="onOpen" @add="onAdd" />

      <!-- DOM order stays canvas-then-panel (node-panel's v-if would break
           the v-else chain above if moved first); order:-1 in the stylesheet
           makes it match the audit panel. -->
      <node-panel v-if="showPanel" @open="onOpen" @add="onAdd" />
    </div>
  </main>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import ConnectionsToolbar from "../../components/connections/ConnectionsToolbar.vue";
import ConnectionsCanvas from "../../components/connections/ConnectionsCanvas.vue";
import NodePanel from "../../components/connections/NodePanel.vue";
import GButton from "../../design/components/GButton.vue";
import {
  GComboboxInput,
  GComboboxItem,
  GComboboxList,
  GComboboxRoot,
} from "../../design/components/GCombobox";
import { courseColor } from "../../lib/colors";
import { useAppBootLoader } from "../../loaders/appBoot";
import { SearchIndex } from "../../lib/search";
import { flatten, type Subject } from "../../lib/types";
import { useCourseDataStore } from "../../stores/courseData";
import { useConnectionsStore } from "../../stores/connections";
import { useIsMobile } from "../../composables/useIsMobile";

// Attaches useAppBootLoader to this route (see loaders/appBoot.ts); the
// catalog is covered by App.vue's useSubjectsLoader().
useAppBootLoader();
const route = useRoute();
const router = useRouter();
const courseData = useCourseDataStore();
const store = useConnectionsStore();
const isMobile = useIsMobile();

const fromId = computed(() => {
  const q = route.query.from;
  return typeof q === "string" ? q : undefined;
});

watch(
  fromId,
  (id) => {
    void store.open(id);
  },
  { immediate: true },
);

// Explore isn't offered on small screens; send them to the plan.
watch(
  isMobile,
  (mobile) => {
    if (mobile) {
      router.replace({
        name: "/road/[[road]]",
        params: { road: courseData.activeRoad },
      });
    }
  },
  { immediate: true },
);

const roadEmpty = computed(() => {
  const road = courseData.activeRoadObject;
  return (
    road === undefined || flatten(road.contents.selectedSubjects).length === 0
  );
});

/* ---------- cold-start seed search ---------- */
const seedQuery = ref("");
const seedCombo = ref<InstanceType<typeof GComboboxRoot>>();
const seedInput = ref<InstanceType<typeof GComboboxInput>>();
const searchIndex = new SearchIndex();
watch(
  () => courseData.subjectsInfo,
  (subjects) => searchIndex.setSubjects(subjects as Subject[]),
  { immediate: true },
);
const seedResults = computed(() =>
  store.status === "empty"
    ? searchIndex.search(seedQuery.value.trim()).slice(0, 8)
    : [],
);
const seedNoMatch = computed(
  () => seedQuery.value.trim() !== "" && seedResults.value.length === 0,
);

/* The search is keyboard-first: Enter seeds the top result, unless the
   arrows moved the highlight. */
watch(seedResults, () => {
  void nextTick(() => seedCombo.value?.highlightFirst());
});

/* the prompt is the page's one action, so the input takes focus */
watch(
  () => store.status,
  async (status) => {
    if (status === "empty") {
      await nextTick();
      seedInput.value?.focus();
    }
  },
  { immediate: true },
);

/* ---------- narrow-screen panel gating ---------- */
const narrow = ref(false);
let narrowQuery: MediaQueryList | undefined;
function onNarrowChange(event: MediaQueryListEvent) {
  narrow.value = event.matches;
}
onMounted(() => {
  narrowQuery = window.matchMedia("(max-width: 859px)");
  narrow.value = narrowQuery.matches;
  narrowQuery.addEventListener("change", onNarrowChange);
});
onBeforeUnmount(() => {
  narrowQuery?.removeEventListener("change", onNarrowChange);
});

/**
 * The panel accompanies a working graph. On small screens it rides over the
 * canvas as a sheet, so it only appears once a selection or a pending
 * placement gives it something to hold.
 */
const showPanel = computed(() => {
  if (store.status !== "ready") {
    return false;
  }
  if (!narrow.value) {
    return true;
  }
  return (
    store.selectedSubject !== undefined || store.placementRequest !== undefined
  );
});

/* ---------- actions reuse the road's existing flows ---------- */
/** Opening leaves the exploration: the route change lands on the plan,
    which renders the stack this push created. */
function onOpen(id: string) {
  courseData.pushClassStack(id);
  void router.push({
    name: "/road/[[road]]",
    params: { road: courseData.activeRoad },
  });
}

/** Adding never leaves the exploration: the panel's term picker takes over. */
function onAdd(id: string) {
  store.requestPlacement(id);
}
</script>

<style scoped>
.connections:focus {
  outline: none;
}
.connections {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.connections-body {
  position: relative;
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* Explore reads the same preference as the plan, so the two modes never
   disagree about which edge a panel sits on. Below 860px the panel rides
   over the canvas as a sheet and the side stops applying. */
@media (min-width: 860px) {
  .connections-body.panel-left :deep(.node-panel) {
    order: -1;
    border-left: none;
    border-right: 1px solid var(--g-line);
  }
}

.state-fill {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  text-align: center;
}
.state-title {
  font: var(--text-display);
  margin: 0;
}
.state-text {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: 0;
  max-width: 420px;
}

.skeleton-graph {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
  width: 320px;
  margin-bottom: var(--space-3);
}
.skeleton-node {
  height: 44px;
  border-radius: var(--radius-full);
  background: var(--g-surface-2);
  animation: shimmer 1.4s ease-in-out infinite;
}
.skeleton-node:nth-child(even) {
  animation-delay: 0.3s;
}
@keyframes shimmer {
  50% {
    opacity: 0.4;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-node {
    animation: none;
  }
}

.seed-search {
  width: 100%;
  max-width: 440px;
}
.seed-input {
  width: 100%;
  height: 34px;
  padding: 0 var(--space-3);
  font: var(--text-body);
  color: var(--g-ink);
}
.seed-results {
  display: flex;
  flex-direction: column;
  margin: var(--space-2) 0 0;
  padding: var(--space-1);
  border: 1px solid var(--g-overlay-line);
  border-radius: var(--radius-md);
  background: var(--g-surface);
  box-shadow: var(--shadow-2);
  text-align: left;
  max-height: 280px;
}
.seed-empty {
  margin: var(--space-2) 0 0;
  font: var(--text-small);
  color: var(--g-ink-2);
  text-align: left;
}
.seed-result {
  text-align: left;
}
.seed-bar {
  width: 4px;
  height: 24px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.seed-id {
  font: var(--text-id-small);
  color: var(--g-ink);
  min-width: 64px;
}
.seed-title {
  font: var(--text-small);
  color: var(--g-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
