<template>
  <a class="skip-link" :href="`#${mainId}`" @click.prevent="skipToMain">
    Skip to main content
  </a>
  <div class="shell" :class="{ 'is-mobile': isMobile }">
    <MobileNotice v-if="isMobile" />
    <ShellHeader
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
      <RouterView />
    </div>

    <CommandPalette
      ref="paletteRef"
      v-model="paletteOpen"
      @action="onPaletteAction"
    />

    <CustomClass ref="customClassRef" />

    <ConflictDialog />
    <ImportDialog v-model="importOpen" @add-road="addRoad" />
    <AboutSheet v-model="aboutOpen" />
    <SettingsSheet v-model="settingsOpen" />
    <ShareSheet v-model="shareOpen" />
    <CompareRoads v-model="compareOpen" />
    <OnboardingSheet v-model="onboardingOpen" @seed="seedFromOnboarding" />
    <CookieConsent />
  </div>
  <BaseToastHost />
  <BaseLiveRegion />
</template>

<script setup lang="ts">
// The shell shared by Plan and Explore. Each page declares its mode and
// skip-link target in route meta; the styleguide sits outside the group.
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
import { useRoute, useRouter, type RouteMeta } from "vue-router";

import CommandPalette from "../components/palette/CommandPalette.vue";
import CookieConsent from "../components/shell/CookieConsent.vue";
import CustomClass from "../components/sheets/CustomClass.vue";
import MobileNotice from "../components/shell/MobileNotice.vue";
import ShellHeader from "../components/shell/ShellHeader.vue";
import BaseLiveRegion from "../design/components/BaseLiveRegion.vue";
import { BaseToastHost } from "../design/components/BaseToast";

// Lazy: none of these render on first paint. CustomClass and
// CommandPalette stay eager: both are reached through a typed ref, and
// the palette answers a shortcut.
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
const OnboardingSheet = defineAsyncComponent(
  () => import("../components/sheets/OnboardingSheet.vue"),
);
const SettingsSheet = defineAsyncComponent(
  () => import("../components/sheets/SettingsSheet.vue"),
);
const ShareSheet = defineAsyncComponent(
  () => import("../components/sheets/ShareSheet.vue"),
);

import { announce } from "../design/announce";
import { toast } from "../design/toast";
import { shortcutLabel } from "../lib/platform";
import { STORAGE_KEYS, writeValue } from "../lib/appStorage";
import { DEMO_ROAD, DEMO_ROAD_NAME } from "../lib/demoRoad";
import { savePersistedStore } from "../lib/persistedStore";
import { releaseTabID } from "../lib/agent";
import { useGlobalShortcuts } from "../composables/useGlobalShortcuts";
import { useIsMobile } from "../composables/useIsMobile";
import {
  shouldOpenOnboarding,
  shouldShowSettingsNotice,
  useAppBootLoader,
} from "../loaders/appBoot";
import { DEFAULT_ROAD_NAME, newRoad, parseRoadFile } from "../lib/roads";
import type { SelectedSubject } from "../lib/types";
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

// The redirect lives here because an index.vue at "/" would tie with this
// route and lose. Keep the query: FireRoad's OAuth callback carries ?code=.
definePage({
  redirect: (to) => ({
    name: "/(app)/road/[[road]]",
    query: to.query,
  }),
});

// Attached here, not per page: a parent route's loader runs for every
// child navigation, so Plan and Explore share one boot.
useAppBootLoader();

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

const isMobile = useIsMobile();

/* ---- page identity: title, heading, skip link (from route meta) ---- */
const modeLabels: Record<NonNullable<RouteMeta["mode"]>, string> = {
  plan: "Plan",
  explore: "Explore",
};
const modeName = computed(() => route.meta.mode ?? "plan");
const isExplore = computed(() => modeName.value === "explore");
/** The mode as people read it, in the heading, title and announcement. */
const modeLabel = computed(() => modeLabels[modeName.value]);
const activeRoadName = computed(() => store.roads[store.activeRoad]?.name);
const pageHeading = computed(() =>
  activeRoadName.value !== undefined
    ? `${modeLabel.value}: ${activeRoadName.value}`
    : modeLabel.value,
);
watch(
  pageHeading,
  (heading) => {
    document.title = `${heading} | CourseRoad`;
  },
  { immediate: true },
);
// A mode switch swaps the whole page without a load, so nothing tells a
// screen reader it happened; the title change alone isn't read out.
watch(modeLabel, (mode, previous) => {
  if (previous !== undefined) {
    announce(`${mode} view`);
  }
});

/** The skip link's target is each page's own <main>. */
const mainId = computed(() => route.meta.mainId ?? "");
function skipToMain() {
  document.getElementById(mainId.value)?.focus();
}

// Immediate: the boot loader finishes before this layout is set up.
watch(
  shouldOpenOnboarding,
  (open) => {
    if (open) {
      onboardingOpen.value = true;
    }
  },
  { immediate: true },
);

// Once per browser; held back while onboarding is open.
watch(
  [shouldShowSettingsNotice, onboardingOpen],
  ([show, onboarding]) => {
    if (!show || onboarding) {
      return;
    }
    shouldShowSettingsNotice.value = false;
    writeValue(STORAGE_KEYS.seenSettingsNotice, true);
    const classic = store.roadLayout === "classic";
    const id = toast.show(
      classic
        ? "Your plan uses the classic layout"
        : "Layout and theme are in Settings",
      {
        detail: classic
          ? "You've used the original CourseRoad in this browser. Switch to the year grid in Settings."
          : "Settings also has a classic layout with one row per term, like the original CourseRoad.",
        duration: 12000,
        action: {
          label: "Open settings",
          handler: () => {
            settingsOpen.value = true;
            toast.dismiss(id);
          },
        },
      },
    );
  },
  { flush: "post", immediate: true },
);

/* ---- Plan / Explore mode ---- */
function navigateMode(mode: "plan" | "explore") {
  // Every entry point already hides itself on mobile; this is the backstop.
  void router.push({
    name:
      mode === "explore" && !isMobile.value
        ? "/(app)/explore/[[road]]"
        : "/(app)/road/[[road]]",
    params: { road: store.activeRoad == "" ? undefined : store.activeRoad },
  });
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
    syncUrlToRoad();
    auth.justLoaded = false;
  },
);

/* ---- URL and active road stay in step ---- */
const routeRoad = computed(() =>
  "road" in route.params ? route.params.road : undefined,
);

/** Keeps the current mode (Plan or Explore) and the query. */
function syncUrlToRoad() {
  const name = route.name;
  const target = store.activeRoad;
  const current = routeRoad.value;
  if (
    target === "" ||
    current === target ||
    (name !== "/(app)/road/[[road]]" && name !== "/(app)/explore/[[road]]")
  ) {
    return;
  }
  // Filling in a missing or stale id replaces; only a switch between two
  // real roads earns a history entry.
  const location = { name, params: { road: target }, query: route.query };
  void (current === undefined || !(current in store.roads)
    ? router.replace(location)
    : router.push(location));
}

// Back and Forward move the URL; the store follows. An id the store doesn't
// hold yet (a logged-in road still loading) waits for the store instead.
watch(
  routeRoad,
  (road) => {
    if (road === undefined) {
      syncUrlToRoad();
    } else if (road in store.roads && road !== store.activeRoad) {
      store.setActiveRoad(road);
    }
  },
  { immediate: true },
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
  // Best-effort; changeSemester also syncs the server when logged in.
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

useGlobalShortcuts({
  togglePalette: () => {
    if (!isExplore.value) {
      paletteOpen.value = !paletteOpen.value;
    }
  },
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
.shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--base-bg);
  color: var(--base-ink);
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
