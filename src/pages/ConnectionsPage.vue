<template>
  <div class="connections">
    <connections-toolbar v-if="store.status === 'ready'" />

    <div
      class="connections-body"
      :class="{ 'panel-left': courseData.panelSide === 'left' }"
    >
      <!-- loading -->
      <div v-if="store.status === 'loading'" class="state-fill">
        <div class="skeleton-graph" aria-hidden="true">
          <span v-for="i in 6" :key="i" class="skeleton-node" />
        </div>
        <p class="state-text">Building the graph...</p>
      </div>

      <!-- catalog error -->
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
        <h2 class="state-title">Start exploring</h2>
        <p class="state-text">
          {{
            roadEmpty
              ? "Your road is empty. Pick a class to start from."
              : "Pick a class to start from, or seed from your road."
          }}
        </p>
        <div class="seed-search">
          <g-input
            ref="seedInput"
            v-model="seedQuery"
            placeholder="Search for a class to start from..."
            aria-label="Search for a starting class"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="seedResultsList"
            :aria-expanded="seedResults.length > 0"
            :aria-activedescendant="
              seedResults.length > 0 ? `seedOption-${seedActive}` : undefined
            "
            @keydown="onSeedKeydown"
          />
          <ul
            v-if="seedResults.length"
            id="seedResultsList"
            class="seed-results"
            role="listbox"
            aria-label="Starting classes"
          >
            <li
              v-for="(s, i) in seedResults"
              :id="`seedOption-${i}`"
              :key="s.subject_id"
              class="seed-result"
              :class="{ active: i === seedActive }"
              role="option"
              :aria-selected="i === seedActive"
              @mousemove="seedActive = i"
              @mousedown.prevent
              @click="store.seedFrom(s.subject_id)"
            >
              <span class="seed-bar" :style="{ background: courseColor(s) }" />
              <span class="seed-id">{{ s.subject_id }}</span>
              <span class="seed-title">{{ s.title }}</span>
            </li>
          </ul>
        </div>
        <g-button
          v-if="!roadEmpty"
          variant="ghost"
          @click="store.reseedFromRoad()"
        >
          Seed from road
        </g-button>
      </div>

      <!-- ready -->
      <connections-canvas v-else @open="onOpen" @add="onAdd" />

      <!-- DOM order stays canvas-then-panel (node-panel's v-if would break
           the v-else chain above if moved first); order:-1 in the stylesheet
           makes it match the audit panel. -->
      <node-panel v-if="showPanel" @open="onOpen" @add="onAdd" />
    </div>
  </div>
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
import ConnectionsToolbar from "../components/connections/ConnectionsToolbar.vue";
import ConnectionsCanvas from "../components/connections/ConnectionsCanvas.vue";
import NodePanel from "../components/connections/NodePanel.vue";
import GButton from "../design/components/GButton.vue";
import GInput from "../design/components/GInput.vue";
import { courseColor } from "../lib/colors";
import { SearchIndex } from "../lib/search";
import { flatten, type Subject } from "../lib/types";
import { useCourseDataStore } from "../stores/courseData";
import { useConnectionsStore } from "../stores/connections";

const route = useRoute();
const router = useRouter();
const courseData = useCourseDataStore();
const store = useConnectionsStore();

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

const roadEmpty = computed(() => {
  const road = courseData.activeRoadObject;
  return (
    road === undefined || flatten(road.contents.selectedSubjects).length === 0
  );
});

/* ---------- cold-start seed search ---------- */
const seedQuery = ref("");
const seedActive = ref(0);
const seedInput = ref<InstanceType<typeof GInput>>();
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
watch(seedResults, () => {
  seedActive.value = 0;
});

/** The search is keyboard-first: arrows move, Enter seeds. */
function onSeedKeydown(event: KeyboardEvent) {
  const count = seedResults.value.length;
  if (count === 0) {
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    seedActive.value = (seedActive.value + 1) % count;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    seedActive.value = (seedActive.value - 1 + count) % count;
  } else if (event.key === "Enter") {
    event.preventDefault();
    const pick = seedResults.value[seedActive.value] ?? seedResults.value[0];
    store.seedFrom(pick.subject_id);
  }
}

/* the prompt is the page's one action, so the input takes focus itself */
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
    where the stacked right panel (or the mobile sheet) renders the stack
    this push created. Explore itself keeps NodePanel. */
function onOpen(id: string) {
  courseData.pushClassStack(id);
  void router.push({ path: `/road/${courseData.activeRoad}` });
}

/** Adding never leaves the exploration: the panel's term picker takes over. */
function onAdd(id: string) {
  store.requestPlacement(id);
}
</script>

<style scoped>
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
.seed-results {
  list-style: none;
  margin: var(--space-2) 0 0;
  padding: var(--space-1);
  border: 1px solid var(--g-line);
  border-radius: var(--radius-md);
  background: var(--g-surface);
  box-shadow: var(--shadow-2);
  text-align: left;
  max-height: 280px;
  overflow-y: auto;
}
.seed-result {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
}
.seed-result.active {
  background: var(--g-accent-tint);
}
.seed-bar {
  width: 4px;
  height: 24px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.seed-id {
  font: var(--text-id-small);
  font-family: var(--font-mono);
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
