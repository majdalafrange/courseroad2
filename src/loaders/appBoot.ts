/**
 * The one-time boot sequence for whichever road/explore route the app
 * first lands on: restore persisted state, resolve the active road from
 * the URL, and gate first-run onboarding. A data loader (not App.vue's
 * onMounted) is where this lives: App.vue is the tree's root, not a
 * page, so its mount has no guarantee the router's initial navigation
 * has resolved, but a loader attached to the road/explore pages does.
 * Not lazy: everything downstream needs the resolved road in place first.
 */
import { ref } from "vue";
import { defineBasicLoader } from "vue-router/experimental";
import { useRouter, type RouteLocationNormalizedLoaded } from "vue-router";
import {
  STORAGE_KEYS,
  clearAppStorage,
  hasValue,
  readValue,
  writeValue,
} from "../lib/appStorage";
import { defaultCurrentSemester } from "../lib/offering";
import {
  loadPersistedStore,
  persistedCurrentSemester,
} from "../lib/persistedStore";
import { DEFAULT_ROAD_ID } from "../lib/roads";
import { flatten } from "../lib/types";
import { useAuditStore } from "../stores/audit";
import { useAuthStore } from "../stores/auth";
import { useCourseDataStore } from "../stores/courseData";

/** App.vue watches this rather than calling the loader itself, which
 * only gets a resolved `to` by being attached to the road/explore pages. */
export const shouldOpenOnboarding = ref(false);

// route.params is a union across every page (only /road and /explore
// carry a road segment), so "road" narrows it rather than reading it
// directly.
function routeRoad(to: RouteLocationNormalizedLoaded): string | undefined {
  return "road" in to.params ? to.params.road : undefined;
}

let booted = false;

export const useAppBootLoader = defineBasicLoader(async (to) => {
  if (booted) {
    return true;
  }
  booted = true;

  const store = useCourseDataStore();
  const auth = useAuthStore();
  const auditStore = useAuditStore();
  const router = useRouter();
  const isExplore = to.name === "/explore/[[road]]";

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
  const roadRequested = routeRoad(to);
  auth.restoreFromStorage(roadRequested);

  if (roadRequested !== undefined && roadRequested in store.roads) {
    store.setActiveRoad(roadRequested);
  } else if (!hasValue(STORAGE_KEYS.accessInfo) && !isExplore) {
    // Missing or unknown id on /road rewrites to the road actually shown;
    // the roads are hydrated above, so store.activeRoad is already that
    // road. /explore skips this: a stale id there just means the URL and
    // the active road disagree until the next road switch corrects it,
    // rather than bouncing the student out of exploring.
    void router.replace({ path: `/road/${store.activeRoad}` });
  }

  auditStore.updateFulfillment("all");

  // First-run onboarding: a fresh, logged-out visitor with the untouched
  // default road who hasn't seen it before.
  if (
    !hasValue(STORAGE_KEYS.accessInfo) &&
    !isExplore &&
    readValue<string>(STORAGE_KEYS.hasOnboarded) !== "true" &&
    readValue<string>(STORAGE_KEYS.hasLoggedIn) !== "true" &&
    store.activeRoad === DEFAULT_ROAD_ID &&
    flatten(store.roads[DEFAULT_ROAD_ID]?.contents.selectedSubjects ?? [])
      .length === 0 &&
    !(import.meta.env.DEV && window.location.search.includes("demo"))
  ) {
    shouldOpenOnboarding.value = true;
  }

  auth.attemptLogin();

  return true;
});
