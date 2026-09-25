<template>
  <div id="app-wrapper">
    <div v-if="fatalError" class="fatal-error" role="alert">
      <h1 class="fatal-title">CourseRoad hit an error</h1>
      <p class="fatal-copy">
        Your roads were saved as you edited them. Reload to pick up where you
        left off.
      </p>
      <g-button variant="primary" @click="reload">Reload CourseRoad</g-button>
    </div>
    <router-view v-else-if="isStyleguide" />
    <template v-else>
      <a class="skip-link" :href="`#${mainId}`" @click.prevent="skipToMain">
        Skip to main content
      </a>
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
          :page-heading="pageHeading"
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
  useTemplateRef,
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

// Lazy: none of these render on first paint. CustomClass and
// CommandPalette stay eager: both are reached through a typed ref, and
// the palette answers a shortcut.
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
import { announce } from "./design/announce";
import { toast } from "./design/toast";
import { shortcutLabel } from "./lib/platform";
import { STORAGE_KEYS, writeValue } from "./lib/appStorage";
import { DEMO_ROAD, DEMO_ROAD_NAME } from "./lib/demoRoad";
import { savePersistedStore } from "./lib/persistedStore";
import { releaseTabID } from "./lib/agent";
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
const paletteRef = useTemplateRef("paletteRef");
const customClassRef = useTemplateRef("customClassRef");

/* ---- responsive ---- */
const isMobile = useIsMobile();
const mobileView = ref<"plan" | "progress">("plan");

// Placement mode needs the canvas visible: switch to Plan and close any
// class-detail popup. Every entry point funnels through this flag.
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

/* ---- page identity: title, heading, skip link ---- */
const activeRoadName = computed(() => store.roads[store.activeRoad]?.name);
const modeName = computed(() => (isExplore.value ? "Explore" : "Plan"));
const pageHeading = computed(() =>
  activeRoadName.value !== undefined
    ? `${modeName.value}: ${activeRoadName.value}`
    : modeName.value,
);
watch(
  pageHeading,
  (heading) => {
    document.title = isStyleguide.value
      ? "Styleguide | CourseRoad"
      : `${heading} | CourseRoad`;
  },
  { immediate: true },
);
// A mode switch swaps the whole page without a load, so nothing tells a
// screen reader it happened; the title change alone isn't read out.
watch(modeName, (mode, previous) => {
  if (previous !== undefined) {
    announce(`${mode} view`);
  }
});

/** The skip link's target is each page's own <main>. */
const mainId = computed(() =>
  isExplore.value ? "exploreMain" : "canvasScroll",
);
function skipToMain() {
  document.getElementById(mainId.value)?.focus();
}

/* ---- theme: keep the applied attribute in sync with "system" ---- */
useSystemThemeSync();

/* ---- catalog + requirements list: shared across every route, so the
   shell kicks them off (Pinia Colada queries, see loaders/courseData.ts) ---- */
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

/* ---- road-change orchestration ---- */
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
    // The URL's :road segment follows the store under whichever mode
    // prefix is active, so switching roads while exploring stays on
    // /explore.
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
// it. Not gated on consent: on a first run the cookie banner is still
// unanswered behind the wizard, and gating reopened it on every load.
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
    payload.year === 0 ? "Starting plan added" : "Road set up",
    payload.year === 0
      ? "First-year GIRs are in place. Move or swap them as you like."
      : `Terms start empty. Press ${shortcutLabel("K")} to add classes.`,
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
        parsed.progressAssertions,
      );
      store.setActiveRoad(id);
    });
  } catch (error) {
    console.warn("Demo seed failed:", error);
  }
}

/* ---- boot: what needs the route resolved lives in useAppBootLoader;
   this is the unload listener and the demo seed ---- */
onMounted(() => {
  window.addEventListener("beforeunload", onBeforeUnload);
  window.addEventListener("pagehide", onPageHide);

  // Dev-only demo seed: /road?demo=1, read before routing drops the
  // query. Waits for the catalog (subjectsLoaded).
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

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (store.cookiesAllowed && store.loggedIn) {
    savePersistedStore(store);
  }
  // A logged-out edit inside the save debounce would die with the tab.
  auth.flushPendingSaves();
  // Remote saves can't be flushed synchronously, so warn instead.
  if (auth.currentlySaving) {
    event.preventDefault();
    event.returnValue = "";
  }
}

function onPageHide(event: PageTransitionEvent) {
  // beforeunload also fires when the student chooses to stay; pagehide
  // with persisted false only fires when the page is going away.
  if (!event.persisted) {
    releaseTabID();
  }
}

onBeforeUnmount(() => {
  // Named so it can come off again.
  window.removeEventListener("beforeunload", onBeforeUnload);
  window.removeEventListener("pagehide", onPageHide);
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
