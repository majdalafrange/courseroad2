<template>
  <div
    class="shell"
    :class="{
      'is-mobile': isMobile,
      'show-plan': !isExplore && mobileView === 'plan',
      'show-progress': !isExplore && mobileView === 'progress',
    }"
  >
    <mobile-notice v-if="isMobile" />
    <shell-header
      @open-search="paletteOpen = true"
      @undo="doUndo"
      @redo="doRedo"
      @create-road="createRoad"
      @switch-road="switchRoad"
      @duplicate-road="duplicateRoad"
      @delete-road="deleteRoadWithUndo"
      @open-import="importOpen = true"
      @open-compare="compareOpen = true"
      @open-share="shareOpen = true"
      @open-about="aboutOpen = true"
      @open-settings="settingsOpen = true"
      @navigate-mode="navigateMode"
    />

    <div
      class="shell-body"
      :class="{ 'panel-right': store.panelSide === 'right' }"
    >
      <aside v-if="!isExplore" class="progress-panel">
        <audit-panel
          v-if="activeRoad !== '' && activeRoad in roads"
          :ledger="detailOpen && !isMobile"
          data-cy="audit"
        />
        <!-- One mount at a time (aside or sheet) so ClassDetail's window
             keydown listener never registers twice. Crossing 860px remounts
             the detail and loses its scroll position. -->
        <class-detail v-if="detailOpen && !isMobile" class="panel-detail" />
        <div class="progress-foot" data-cy="unofficialWarning">
          <span class="foot-line">
            Unofficial tool. Confirm with the
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://student.mit.edu/cgi-bin/shrwsdau.sh"
              >official audit</a
            >
          </span>
          <g-popover v-model="footLinksOpen" align="end" placement="top">
            <template #anchor>
              <button
                class="foot-more"
                :aria-expanded="footLinksOpen"
                @click="footLinksOpen = !footLinksOpen"
              >
                more
              </button>
            </template>
            <div class="foot-links" @click.stop>
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://student.mit.edu/catalog/index.cgi"
                >Subject listing ↗</a
              >
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://catalog.mit.edu/degree-charts/"
                >Degree charts ↗</a
              >
              <a
                target="_blank"
                rel="noopener noreferrer"
                href="https://fireroad.mit.edu/requirements/"
                >Requirement wrong? Request an edit ↗</a
              >
              <a href="mailto:courseroad@mit.edu">courseroad@mit.edu</a>
            </div>
          </g-popover>
        </div>
      </aside>

      <div class="shell-main">
        <!-- Never mounted on mobile: the graph can grow heavy enough to
             slow down or crash a phone's browser. -->
        <connections-page v-if="isExplore && !isMobile" />

        <main v-else id="canvasScroll" class="canvas">
          <!-- The glyph field sizes to the plan, not the viewport, so it
               scrolls with the cards instead of sitting still behind them. -->
          <div class="canvas-sheet">
            <canvas-glyphs />
            <div v-if="store.catalogError" class="catalog-error" role="alert">
              <div>
                <strong>We couldn't load the subject catalog.</strong>
                <span>
                  Check your connection. Your plan is safe in the meantime.
                </span>
              </div>
              <g-button
                variant="primary"
                size="sm"
                @click="store.retryCatalog()"
              >
                Try again
              </g-button>
            </div>
            <div v-else-if="offline" class="offline-note" role="status">
              <g-icon name="cloud" :size="14" />
              You're offline, but you can keep planning. We'll sync your changes
              when you're back.
            </div>
            <div v-else-if="roadLoading" class="road-loading" role="status">
              <span class="road-loading-spinner" aria-hidden="true" />
              Loading this road...
            </div>

            <div
              v-if="showEmptyState && !store.catalogError"
              class="empty-state"
            >
              <h2 class="empty-title">Search for a class</h2>
              <p class="empty-copy">
                Place it in a term, or add a major or minor on the
                {{ store.panelSide }} and we'll show you what's left.
              </p>
              <div class="empty-actions">
                <g-button variant="primary" @click.stop="focusSearch">
                  Add classes
                </g-button>
              </div>
            </div>

            <road-canvas
              v-if="activeRoad !== '' && activeRoad in roads && !roadLoading"
              :key="activeRoad"
              :selected-subjects="roads[activeRoad].contents.selectedSubjects"
              :road-i-d="activeRoad"
              @change-year="auth.changeSemester($event)"
            />
          </div>
        </main>
      </div>
    </div>

    <detail-sheet
      v-if="!isExplore && isMobile && detailOpen"
      @close="store.clearClassInfoStack()"
    >
      <class-detail />
    </detail-sheet>

    <command-palette
      ref="paletteRef"
      v-model="paletteOpen"
      @action="onPaletteAction"
    />

    <custom-class ref="customClassRef" />

    <conflict-dialog />
    <import-dialog v-model="importOpen" @add-road="addRoad" />
    <about-sheet v-model="aboutOpen" />
    <settings-sheet v-model="settingsOpen" />
    <share-sheet v-model="shareOpen" />
    <compare-roads v-model="compareOpen" />
    <onboarding v-model="onboardingOpen" @seed="seedFromOnboarding" />
    <cookie-consent />
    <mobile-nav
      v-if="isMobile"
      :active="mobileView"
      @navigate="onMobileNavigate"
      @search="paletteOpen = true"
    />
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";

import AuditPanel from "../components/audit/AuditPanel.vue";
import ClassDetail from "../components/detail/ClassDetail.vue";
import DetailSheet from "../components/detail/DetailSheet.vue";
import CommandPalette from "../components/palette/CommandPalette.vue";
import CookieConsent from "../components/shell/CookieConsent.vue";
import CustomClass from "../components/sheets/CustomClass.vue";
import RoadCanvas from "../components/canvas/RoadCanvas.vue";
import MobileNav from "../components/shell/MobileNav.vue";
import MobileNotice from "../components/shell/MobileNotice.vue";
import ShellHeader from "../components/shell/ShellHeader.vue";
import GButton from "../design/components/GButton.vue";
import CanvasGlyphs from "../components/canvas/CanvasGlyphs.vue";
import GIcon from "../design/components/GIcon.vue";
import GPopover from "../design/components/GPopover.vue";

// Lazy: the whole Connections engine (~5k LOC of graph code) loads on
// first entry to Explore instead of riding along with every plan view.
const ConnectionsPage = defineAsyncComponent(
  () => import("./ConnectionsPage.vue"),
);

// Lazy: none of these render on first paint, only after a menu click.
// CustomClass and CommandPalette stay eager: both are reached through a
// typed ref, and the palette should answer its shortcut instantly.
const AboutSheet = defineAsyncComponent(
  () => import("../components/sheets/AboutSheet.vue"),
);
const CompareRoads = defineAsyncComponent(
  () => import("../components/sheets/CompareRoads.vue"),
);
const ConflictDialog = defineAsyncComponent(
  () => import("../components/sheets/ConflictDialog.vue"),
);
const ImportDialog = defineAsyncComponent(
  () => import("../components/sheets/ImportDialog.vue"),
);
const Onboarding = defineAsyncComponent(
  () => import("../components/sheets/Onboarding.vue"),
);
const SettingsSheet = defineAsyncComponent(
  () => import("../components/sheets/SettingsSheet.vue"),
);
const ShareSheet = defineAsyncComponent(
  () => import("../components/sheets/ShareSheet.vue"),
);

import { toast } from "../design/toast";
import {
  STORAGE_KEYS,
  clearAppStorage,
  hasValue,
  readValue,
  writeValue,
} from "../lib/appStorage";
import { DEMO_ROAD, DEMO_ROAD_NAME } from "../lib/demoRoad";
import { defaultCurrentSemester } from "../lib/offering";
import { shortcutLabel } from "../lib/platform";
import {
  loadPersistedStore,
  persistedCurrentSemester,
  savePersistedStore,
} from "../lib/persistedStore";
import { useGlobalShortcuts } from "../composables/useGlobalShortcuts";
import { useSystemThemeSync } from "../composables/useTheme";
import {
  DEFAULT_ROAD_ID,
  DEFAULT_ROAD_NAME,
  newRoad,
  parseRoadFile,
} from "../lib/roads";
import { flatten, type SelectedSubject } from "../lib/types";
import { useAuditStore } from "../stores/audit";
import { useAuthStore } from "../stores/auth";
import { onRoadChange, useCourseDataStore } from "../stores/courseData";
import { onDragBegin } from "../stores/dragdrop";
import { history } from "../stores/history";
import { paletteRequest } from "../stores/palette";
import {
  addRoad,
  createRoad,
  deleteRoadWithUndo,
  duplicateRoad,
  exportActiveRoad,
  switchRoad,
} from "../stores/roadOps";

const store = useCourseDataStore();
const auth = useAuthStore();
const auditStore = useAuditStore();
const route = useRoute();
const router = useRouter();

const aboutOpen = ref(false);
const settingsOpen = ref(false);
const importOpen = ref(false);
const shareOpen = ref(false);
const compareOpen = ref(false);
const onboardingOpen = ref(false);
const footLinksOpen = ref(false);
const paletteOpen = ref(false);
const paletteRef = ref<InstanceType<typeof CommandPalette>>();
const customClassRef = ref<InstanceType<typeof CustomClass>>();

/* ---- responsive ---- */
const viewportWidth = ref(window.innerWidth);
const isMobile = computed(() => viewportWidth.value < 860);
const mobileView = ref<"plan" | "progress">("plan");
function onResize() {
  viewportWidth.value = window.innerWidth;
}

// Placement mode only makes sense with the canvas visible: switch to
// Plan and close any class-detail popup covering it. Every entry point
// (ClassDetail, palette, suggestions) already funnels through this
// flag, so one watcher covers them all.
watch(
  () => store.addingFromCard,
  (adding) => {
    if (adding) {
      mobileView.value = "plan";
      store.clearClassInfoStack();
    }
  },
);

/* ---- network ---- */
const offline = ref(!navigator.onLine);
function onOnline() {
  offline.value = false;
}
function onOffline() {
  offline.value = true;
}

const roads = computed(() => store.roads);
const activeRoad = computed(() => store.activeRoad);
const detailOpen = computed(() => store.classInfoStack.length > 0);
const isExplore = computed(() => route.path.startsWith("/explore"));
// True while the active road is still a blank placeholder awaiting its
// first fetch (see auth.retrieveRoad). Without this its empty placeholder
// reads as "Search for a class" instead of "still loading".
const roadLoading = computed(() =>
  store.unretrieved.includes(activeRoad.value),
);
const showEmptyState = computed(() => {
  if (roadLoading.value) {
    return false;
  }
  const road = store.roads[store.activeRoad];
  if (road === undefined) {
    return false;
  }
  return flatten(road.contents.selectedSubjects).length === 0;
});

/* ---- theme: keep the applied attribute in sync with "system" ---- */
useSystemThemeSync();

/* ---- Plan ⁄ Explore mode ---- */
function navigateMode(mode: "plan" | "explore") {
  // Every entry point already hides itself on mobile; this is the backstop.
  const prefix = mode === "explore" && !isMobile.value ? "/explore" : "/road";
  void router.push(
    store.activeRoad !== "" ? `${prefix}/${store.activeRoad}` : prefix,
  );
}

/** Bottom-nav taps. Progress lives in plan mode, so it navigates there too. */
function onMobileNavigate(view: "plan" | "progress") {
  mobileView.value = view;
}

// Explore's URL is still reachable directly on mobile (a bookmark, a
// resize while it's open); bounce back to the plan instead.
watch(
  [isMobile, isExplore],
  ([mobile, explore]) => {
    if (mobile && explore) {
      navigateMode("plan");
    }
  },
  { immediate: true },
);

/* ---- road-change orchestration (replaces the legacy deep watcher) ---- */
onRoadChange((event) => {
  auth.justLoaded = false;
  if (store.activeRoad !== "") {
    auditStore.updateFulfillment(event.fulfillment);
  }
  store.fulfillmentNeeded = "all";
  if (event.save) {
    const saveTarget = event.roadID ?? store.activeRoad;
    if (saveTarget !== "" && saveTarget in store.roads) {
      auth.queueSave(saveTarget);
    }
  }
});

/* ---- active road switching ---- */
watch(
  () => store.activeRoad,
  (newRoad) => {
    if (store.unretrieved.indexOf(newRoad) >= 0 && !auth.gettingUserData) {
      // retrieveRoad marks the road retrieved itself on success; this just
      // needs to run the audit once the fetch lands.
      void auth.retrieveRoad(newRoad).then(() => {
        auditStore.updateFulfillment(store.fulfillmentNeeded);
      });
    } else if (newRoad !== "") {
      auditStore.updateFulfillment(store.fulfillmentNeeded);
    }
    // The URL's :road segment follows the store either way, under
    // whichever mode prefix is already active, so switching roads while
    // exploring stays on /explore instead of bouncing back to the plan.
    if (newRoad !== "" && !auth.justLoaded) {
      const prefix = isExplore.value ? "/explore" : "/road";
      void router.push({ path: `${prefix}/${newRoad}` });
    }
    auth.justLoaded = false;
  },
);

watch(
  () => store.cookiesAllowed,
  (newCA) => {
    if (newCA) {
      writeValue(STORAGE_KEYS.dismissedAndroidWarning, "true");
    }
  },
);

/** Route palette actions to their shell behaviors. */
function onPaletteAction(name: string, payload?: string) {
  switch (name) {
    case "open-settings":
      settingsOpen.value = true;
      break;
    case "create-road":
      createRoad();
      break;
    case "switch-road":
      if (payload !== undefined) {
        switchRoad(payload);
      }
      break;
    case "open-import":
      importOpen.value = true;
      break;
    case "export-road":
      void exportActiveRoad();
      break;
    case "open-about":
      aboutOpen.value = true;
      break;
    case "new-custom-activity":
      customClassRef.value?.openNewClass();
      break;
    case "open-explore":
      navigateMode("explore");
      break;
    case "undo":
      doUndo();
      break;
    case "redo":
      doRedo();
      break;
  }
}

// Dragging a result out of the palette: yield to the canvas.
onDragBegin(() => {
  paletteOpen.value = false;
});

// Audit gap-to-action: open the palette pre-scoped.
watch(paletteRequest, (request) => {
  if (request === null) {
    return;
  }
  paletteOpen.value = true;
  void nextTick(() => {
    if (request.tokens?.length) {
      paletteRef.value?.openWithTokens(request.tokens);
    }
    if (request.query !== undefined) {
      paletteRef.value?.openWithQuery(request.query);
    }
    paletteRequest.value = null;
  });
});

/* ---- onboarding ---- */

// Skip and Finish both close the wizard, and either counts as having seen
// it. Recorded on the close itself, without the consent gate: on a true
// first run the cookie banner is still unanswered behind the wizard's
// scrim, and gating on it made the wizard reopen on every load.
watch(onboardingOpen, (open) => {
  if (!open) {
    writeValue(STORAGE_KEYS.hasOnboarded, "true");
  }
});

function seedFromOnboarding(payload: {
  year: number;
  coursesOfStudy: string[];
  selectedSubjects: SelectedSubject[][];
}) {
  // Apply year (best-effort; changeSemester also syncs the server if logged in)
  auth.changeSemester(payload.year);
  // Seed the active (default) road in place so we don't fork an extra road.
  const id = store.activeRoad;
  const road = newRoad(
    store.roads[id]?.name ?? DEFAULT_ROAD_NAME,
    payload.coursesOfStudy,
    payload.selectedSubjects,
  );
  store.setRoad({ id, road, ignoreSet: false });
  store.fulfillmentNeeded = "all";
  history.clear();
  toast.ok(
    payload.year === 0 ? "Your starting plan is ready!" : "You're all set up!",
    payload.year === 0
      ? "We've put GIR placeholders in freshman year. Drag in real classes anytime."
      : `Terms start empty. Search (${shortcutLabel("K")}) whenever you're ready to add classes.`,
  );
}

/* ---- undo/redo ---- */
function doUndo() {
  const label = history.undo();
  if (label !== undefined) {
    toast.show(`Undid: ${label}`, { duration: 2500 });
  }
}

function doRedo() {
  const label = history.redo();
  if (label !== undefined) {
    toast.show(`Redid: ${label}`, { duration: 2500 });
  }
}

/* ---- search ---- */
function focusSearch() {
  paletteOpen.value = true;
}

/* ---- keyboard ---- */
useGlobalShortcuts({
  togglePalette: () => (paletteOpen.value = !paletteOpen.value),
  undo: doUndo,
  redo: doRedo,
});

/** Dev-only: seed the demo Course 6-3 road (screenshots, design review). */
function seedDemoRoad() {
  if (Object.values(store.roads).some((road) => road.name === DEMO_ROAD_NAME)) {
    return;
  }
  try {
    const parsed = parseRoadFile(JSON.stringify(DEMO_ROAD), store.catalog);
    history.silence(() => {
      const id = addRoad(
        DEMO_ROAD_NAME,
        parsed.coursesOfStudy,
        parsed.selectedSubjects,
        parsed.progressOverrides,
      );
      store.setActiveRoad(id);
    });
  } catch (error) {
    console.warn("Demo seed failed:", error);
  }
}

/* ---- routing helpers ---- */
function setActiveRoadFromRoute(): boolean {
  const roadRequested = route.params.road as string | undefined;
  if (roadRequested !== undefined && roadRequested in store.roads) {
    store.setActiveRoad(roadRequested);
    return true;
  } else if (!hasValue(STORAGE_KEYS.accessInfo) && !isExplore.value) {
    // Missing or unknown id on /road rewrites to the road actually shown;
    // the roads are hydrated before this runs, so store.activeRoad is
    // already that road. /explore skips this: a stale id there just means
    // the URL and the active road disagree until the next road switch
    // corrects it, rather than bouncing the student out of exploring.
    const shownRoadId = store.activeRoad;
    void router.replace({ path: `/road/${shownRoadId}` });
  }
  return false;
}

/* ---- boot ---- */
onMounted(() => {
  // A stored version that differs resets local state. An absent one is
  // stamped without a reset: the stamp is written only on consented
  // boots, so the first boot after consent always saw it absent, treated
  // that as a version change, and wiped the flags written before consent
  // (hasOnboarded among them, which reopened the first-run wizard).
  const storedVersion = readValue<string>(STORAGE_KEYS.versionNumber);
  if (store.cookiesAllowed && storedVersion !== store.versionNumber) {
    if (storedVersion !== undefined) {
      console.warn("Warning: the version number has changed.");
      clearAppStorage();
    }
    writeValue(STORAGE_KEYS.versionNumber, store.versionNumber);
  }

  // The stored choice wins over the clock-derived default; logged in, a
  // later verify() replaces it with the server's value.
  store.setCurrentSemester(
    persistedCurrentSemester() ?? defaultCurrentSemester(),
  );

  const persisted = loadPersistedStore();
  if (persisted !== undefined && store.cookiesAllowed && store.loggedIn) {
    store.setFromLocalStorage(persisted);
  }

  // Hydrate the logged-out roads (and start the logged-in sync) BEFORE
  // anything reads store.roads. Running this last meant the route
  // resolution, the first audit recompute, and the onboarding gate all
  // saw only the empty default road.
  auth.restoreFromStorage(route.params.road as string | undefined);

  setActiveRoadFromRoute();

  auditStore
    .loadReqList()
    .catch((e: unknown) => console.warn("Failed to load the program list:", e));
  auditStore.updateFulfillment("all");

  window.addEventListener("resize", onResize);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  // First-run onboarding: a fresh, logged-out visitor with the untouched
  // default road who hasn't seen it before.
  if (
    !hasValue(STORAGE_KEYS.accessInfo) &&
    !isExplore.value &&
    readValue<string>(STORAGE_KEYS.hasOnboarded) !== "true" &&
    readValue<string>(STORAGE_KEYS.hasLoggedIn) !== "true" &&
    store.activeRoad === DEFAULT_ROAD_ID &&
    flatten(store.roads[DEFAULT_ROAD_ID]?.contents.selectedSubjects ?? [])
      .length === 0 &&
    !(import.meta.env.DEV && window.location.search.includes("demo"))
  ) {
    onboardingOpen.value = true;
  }

  window.addEventListener("beforeunload", onBeforeUnload);

  auth.attemptLogin();

  // Dev-only demo seed for screenshots/design review: /road?demo=1
  // (read before routing normalizes the URL and drops the query)
  const demoRequested =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("demo");

  store
    .loadAllSubjects()
    .then(() => {
      if (demoRequested) {
        seedDemoRoad();
      }
    })
    .catch((e) => console.error("There was an error loading subjects:", e));
});

function onBeforeUnload() {
  if (store.cookiesAllowed && store.loggedIn) {
    savePersistedStore(store);
  }
  // A logged-out edit inside the save debounce would die with the tab.
  auth.flushPendingSaves();
}

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("online", onOnline);
  window.removeEventListener("offline", onOffline);
  // Named so it can come off again: the anonymous version accumulated
  // one listener per MainPage remount (every /styleguide round trip).
  window.removeEventListener("beforeunload", onBeforeUnload);
});
</script>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--g-bg);
  color: var(--g-ink);
  font: var(--text-body);
  overflow: hidden;
}

.shell-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.shell-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.canvas {
  flex: 1;
  overflow-y: auto;
  /* The padding is named so the glyph field can stretch back across it
     (see CanvasGlyphs.vue); keep the two declarations together. */
  --canvas-pad-top: var(--space-4);
  --canvas-pad-x: var(--space-5);
  --canvas-pad-bottom: var(--space-16);
  padding: var(--canvas-pad-top) var(--canvas-pad-x) var(--canvas-pad-bottom);
}
/* Holds the plan and the glyph field together. The field is absolute against
   this sheet, so it spans the whole plan rather than one screen of it, and
   every card stacks above it. */
.canvas-sheet {
  position: relative;
  min-height: 100%;
  /* Contain child margins: the empty state's top margin used to collapse
     through the sheet, shifting it (and the field with it) 20px down and
     leaving the top run of padding bare. */
  display: flow-root;
}
.canvas-sheet > *:not(.glyph-field) {
  position: relative;
  z-index: 1;
}

.progress-panel {
  width: 384px;
  flex-shrink: 0;
  background: var(--g-surface);
  border-right: 1px solid var(--g-line);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* Settings' panel-side choice: DOM order stays panel-then-main (the
   default, left-side layout); "right" just reorders and re-sides the
   border, so the aside's own v-if is never in play. */
.shell-body.panel-right .progress-panel {
  order: 1;
  border-right: none;
  border-left: 1px solid var(--g-line);
}

/* With a detail open the audit above it compresses to a ledger, and the
   detail takes the remaining height with its own scroll. */
.progress-panel .panel-detail {
  flex: 1;
  min-height: 0;
  border-top: 1px solid var(--g-line);
  animation: detail-enter var(--motion-standard) var(--ease-out);
}
@keyframes detail-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .progress-panel .panel-detail {
    animation: none;
  }
}

/* The disclaimer holds one quiet line; the rest lives behind “more”. */
.progress-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink-3);
  padding: var(--space-2) var(--space-4);
  border-top: 1px solid var(--g-line);
}
.progress-foot a {
  color: var(--g-ink-2);
}
.foot-line {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.foot-more {
  font: var(--text-small);
  color: var(--g-ink-3);
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.foot-more:hover {
  color: var(--g-ink);
}
.foot-more:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
  border-radius: var(--radius-xs);
}
.foot-links {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  font: var(--text-small);
}
.foot-links a {
  color: var(--g-ink-2);
  text-decoration: none;
}
.foot-links a:hover {
  color: var(--g-accent);
}

.empty-state {
  /* Wide enough to hold the instruction on one line (it measures 467px). */
  max-width: 480px;
  margin: var(--space-5) auto var(--space-5);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.empty-title {
  font: var(--text-display);
  letter-spacing: var(--tracking-tight);
  margin: 0;
}
.empty-copy {
  font: var(--text-body);
  color: var(--g-ink-2);
  margin: 0;
}
.empty-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.catalog-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  max-width: 1080px;
  margin: 0 auto var(--space-3);
  background: var(--g-danger-tint);
  border: 1px solid var(--g-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.catalog-error strong {
  font: var(--text-body-strong);
  color: var(--g-ink);
  display: block;
}
.catalog-error span {
  font: var(--text-small);
  color: var(--g-ink-2);
}
.offline-note,
.road-loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 1080px;
  margin: 0 auto var(--space-3);
  font: var(--text-small);
  color: var(--g-ink-2);
  background: var(--g-surface-2);
  border: 1px solid var(--g-line);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
}
.road-loading-spinner {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  border-top-color: currentColor;
  animation: road-loading-spin 800ms linear infinite;
}
@keyframes road-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .road-loading-spinner {
    animation: none;
    border-color: currentColor;
  }
}

/* ---------- responsive ---------- */
@media (max-width: 859px) {
  .shell.is-mobile {
    height: 100dvh;
  }
  .shell.is-mobile .shell-body {
    flex-direction: column;
  }
  .shell.is-mobile .shell-main,
  .shell.is-mobile .progress-panel {
    width: 100%;
    height: auto;
    flex: 1;
    min-height: 0;
    border-right: none;
    border-left: none;
  }
  .shell.is-mobile .canvas {
    --canvas-pad-top: var(--space-3);
    --canvas-pad-x: var(--space-3);
    --canvas-pad-bottom: calc(64px + var(--space-4));
    padding: var(--canvas-pad-top) var(--canvas-pad-x) var(--canvas-pad-bottom);
  }
  .shell.is-mobile .progress-panel {
    padding-bottom: 64px;
  }
  /* Show one pane at a time; MobileNav switches. The class detail is not
     part of this trade: below 860px it renders in DetailSheet, over the
     whole shell, so a palette result is visible from either pane. */
  .shell.is-mobile.show-plan .progress-panel {
    display: none;
  }
  .shell.is-mobile.show-progress .shell-main {
    display: none;
  }
}
</style>
