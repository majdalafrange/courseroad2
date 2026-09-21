import { createApp } from "vue";
import { createPinia } from "pinia";
import { PiniaColada } from "@pinia/colada";
import {
  PiniaColadaCachePersister,
  isCacheReady,
} from "@pinia/colada-plugin-cache-persister";
import { PiniaColadaRetry } from "@pinia/colada-plugin-retry";
import { get, set } from "idb-keyval";
import { DataLoaderPlugin } from "vue-router/experimental";

import { router } from "./router.ts";
import App from "./App.vue";
import { QUERY_CACHE_KEY } from "./loaders/courseData";

// Fonts and design tokens.
import "./css/fonts.css";
import "./design/tokens.css";
import "./design/departmentColors.css";
import "./css/app.css";
import {
  applyThemeAttribute,
  resolveTheme,
  systemPrefersDark,
} from "./design/tokens";
import {
  fatalError,
  isChunkLoadError,
  recoverFromChunkLoadError,
} from "./lib/errorBoundary";
import { migrateLegacyCookies } from "./lib/legacyStorage";
import { persistedThemeMode } from "./lib/persistedStore";

// Move any legacy cookie state into origin-isolated storage before
// anything reads it. After this the app never reads document.cookie.
migrateLegacyCookies();

// Apply the persisted theme before first paint to avoid a flash.
applyThemeAttribute(resolveTheme(persistedThemeMode(), systemPrefersDark()));

const pinia = createPinia();
const app = createApp(App);
app.use(pinia);
app.use(PiniaColada, {
  plugins: [
    // IndexedDB (idb-keyval), not localStorage: the catalog alone runs
    // several MB, more than localStorage should carry.
    PiniaColadaCachePersister({
      key: QUERY_CACHE_KEY,
      storage: {
        getItem: async (key) => (await get<string>(key)) ?? null,
        setItem: set,
      },
    }),
    // Plain GETs against FireRoad; worth a few retries with backoff
    // before surfacing an error.
    PiniaColadaRetry(),
  ],
});
// Before the router: adds the navigation guards useAppBootLoader runs in.
app.use(DataLoaderPlugin, { router });
app.use(router);

// Last resort: an uncaught error in render, a watcher, or a lifecycle
// hook otherwise leaves the crashed screen up. Roads are persisted as
// they're edited, so a reload is safe.
app.config.errorHandler = (err, _instance, info) => {
  console.error("Unhandled error:", err, info);
  fatalError.value = true;
};

// A lazy chunk that fails to load: Vite reports it as vite:preloadError,
// the router when it was a route component.
window.addEventListener("vite:preloadError", () => {
  recoverFromChunkLoadError();
});
router.onError((error) => {
  if (isChunkLoadError(error)) {
    recoverFromChunkLoadError();
  }
});

// router.isReady() rejects if the initial navigation fails; catch so the
// app still mounts.
void Promise.all([isCacheReady(), router.isReady()])
  .catch(() => {})
  .then(() => {
    app.mount("#app");
  });
