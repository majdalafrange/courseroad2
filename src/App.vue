<template>
  <div id="app-wrapper">
    <div v-if="fatalError" class="fatal-error" role="alert">
      <h1 class="fatal-title">Something went wrong</h1>
      <p class="fatal-copy">
        Sorry about that. Your roads are saved as you edit them, so nothing is
        lost, and reloading should get you back to normal.
      </p>
      <g-button variant="primary" @click="reload">Reload CourseRoad</g-button>
    </div>
    <router-view v-else-if="isStyleguide" />
    <template v-else>
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

        <div class="shell-body">
          <router-view />
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
      <g-toast-host />
      <g-live-region />
    </template>
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

import ClassDetail from "./components/detail/ClassDetail.vue";
import DetailSheet from "./components/detail/DetailSheet.vue";
import CommandPalette from "./components/palette/CommandPalette.vue";
import CookieConsent from "./components/shell/CookieConsent.vue";
import CustomClass from "./components/sheets/CustomClass.vue";
import MobileNav from "./components/shell/MobileNav.vue";
import MobileNotice from "./components/shell/MobileNotice.vue";
import ShellHeader from "./components/shell/ShellHeader.vue";
import GButton from "./design/components/GButton.vue";
import GLiveRegion from "./design/components/GLiveRegion.vue";
import GToastHost from "./design/components/GToastHost.vue";

// Lazy: none of these render on first paint, only after a menu click.
// CustomClass and CommandPalette stay eager: both are reached through a
// typed ref, and the palette should answer its shortcut instantly.
const AboutSheet = defineAsyncComponent(
  () => import("./components/sheets/AboutSheet.vue"),
);
const CompareRoads = defineAsyncComponent(
  () => import("./components/sheets/CompareRoads.vue"),
);
const ConflictDialog = defineAsyncComponent(
  () => import("./components/sheets/ConflictDialog.vue"),
);
const ImportDialog = defineAsyncComponent(
  () => import("./components/sheets/ImportDialog.vue"),
);
const Onboarding = defineAsyncComponent(
  () => import("./components/sheets/Onboarding.vue"),
);
const SettingsSheet = defineAsyncComponent(
  () => import("./components/sheets/SettingsSheet.vue"),
);
const ShareSheet = defineAsyncComponent(
  () => import("./components/sheets/ShareSheet.vue"),
);

import { fatalError } from "./lib/errorBoundary";
import { toast } from "./design/toast";
import { STORAGE_KEYS, writeValue } from "./lib/appStorage";
import { DEMO_ROAD, DEMO_ROAD_NAME } from "./lib/demoRoad";
import { shortcutLabel } from "./lib/platform";
import { savePersistedStore } from "./lib/persistedStore";
import { useGlobalShortcuts } from "./composables/useGlobalShortcuts";
import { useIsMobile } from "./composables/useIsMobile";
import { useSystemThemeSync } from "./composables/useTheme";
import { shouldOpenOnboarding } from "./loaders/appBoot";
import { useReqListLoader, useSubjectsLoader } from "./loaders/courseData";
import { DEFAULT_ROAD_NAME, newRoad, parseRoadFile } from "./lib/roads";
import type { SelectedSubject } from "./lib/types";
import { useAuditStore } from "./stores/audit";
import { useAuthStore } from "./stores/auth";
import { onRoadChange, useCourseDataStore } from "./stores/courseData";
import { onDragBegin } from "./stores/dragdrop";
import { history } from "./stores/history";
import { paletteRequest } from "./stores/palette";
import {
  addRoad,
  createRoad,
  deleteRoadWithUndo,
  duplicateRoad,
  exportActiveRoad,
  switchRoad,
} from "./stores/roadOps";

function reload() {
  window.location.reload();
}

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
const paletteOpen = ref(false);
const paletteRef = ref<InstanceType<typeof CommandPalette>>();
const customClassRef = ref<InstanceType<typeof CustomClass>>();

/* ---- responsive ---- */
const isMobile = useIsMobile();
const mobileView = ref<"plan" | "progress">("plan");

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

const detailOpen = computed(() => store.classInfoStack.length > 0);
const isExplore = computed(() => route.name === "/explore/[[road]]");
// The styleguide is a self-contained reference page (its own header, its
// own GToastHost) rather than part of the app.
const isStyleguide = computed(() => route.name === "/styleguide");

/* ---- theme: keep the applied attribute in sync with "system" ---- */
useSystemThemeSync();

/* ---- catalog + requirements list: shared across every route, so the
   shell (not a page) is where they're kicked off; both are Pinia Colada
   queries (see loaders/courseData.ts), fetched once and shared with
   whichever other code also calls the same loader. ---- */
useSubjectsLoader();
const { error: reqListError } = useReqListLoader();
watch(reqListError, (e) => {
  if (e !== null) {
    console.warn("Failed to load the program list:", e);
  }
});

// The boot loader itself is attached to the road/explore pages (see
// loaders/appBoot.ts); this just reacts to what it decided.
watch(shouldOpenOnboarding, (open) => {
  if (open) {
    onboardingOpen.value = true;
  }
});

/* ---- Plan ⁄ Explore mode ---- */
function navigateMode(mode: "plan" | "explore") {
  // Every entry point already hides itself on mobile; this is the backstop.
  void router.push({
    name:
      mode === "explore" && !isMobile.value
        ? "/explore/[[road]]"
        : "/road/[[road]]",
    params: { road: store.activeRoad == "" ? undefined : store.activeRoad },
  });
}

/** Bottom-nav taps. Progress lives in plan mode, so it navigates there too. */
function onMobileNavigate(view: "plan" | "progress") {
  mobileView.value = view;
}

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
      const name = route.name;
      if (name === "/road/[[road]]" || name === "/explore/[[road]]") {
        void router.push({ name, params: { road: newRoad } });
      }
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

// Audit gap-to-action: open the palette pre-scoped. Also the target for
// any page's plain "open the search" request (an empty payload).
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

/* ---- boot ----
   Everything that needs the route resolved (which road, plan or
   explore) lives in useAppBootLoader instead, attached to the road and
   explore pages so vue-router runs it only once that's settled. This is
   left with what doesn't: the unload listener, and the demo seed. */
onMounted(() => {
  window.addEventListener("beforeunload", onBeforeUnload);

  // Dev-only demo seed for screenshots/design review: /road?demo=1 (read
  // before routing drops the query). Waits for useSubjectsLoader (called
  // above) to land: subjectsLoaded flips once applyCatalog runs.
  if (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).has("demo")
  ) {
    const stopWatchingSubjects = watch(
      () => store.subjectsLoaded,
      (loaded) => {
        if (loaded) {
          seedDemoRoad();
          stopWatchingSubjects();
        }
      },
      { immediate: true },
    );
  }
});

function onBeforeUnload() {
  if (store.cookiesAllowed && store.loggedIn) {
    savePersistedStore(store);
  }
  // A logged-out edit inside the save debounce would die with the tab.
  auth.flushPendingSaves();
}

onBeforeUnmount(() => {
  // Named so it can come off again: the anonymous version accumulated
  // one listener per remount.
  window.removeEventListener("beforeunload", onBeforeUnload);
});
</script>

<style scoped>
.fatal-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  height: 100vh;
  padding: var(--space-5);
  text-align: center;
  background: var(--g-bg);
  color: var(--g-ink);
}
.fatal-title {
  font: var(--text-display);
  letter-spacing: var(--tracking-tight);
  margin: 0;
}
.fatal-copy {
  font: var(--text-body);
  color: var(--g-ink-2);
  max-width: 420px;
  margin: 0;
}

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

@media (max-width: 859px) {
  .shell.is-mobile {
    height: 100dvh;
  }
  .shell.is-mobile .shell-body {
    flex-direction: column;
  }
}
</style>
