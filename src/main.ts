import { createApp } from "vue";
import { createPinia } from "pinia";

import { router } from "./router.ts";
import App from "./App.vue";

// Fonts and design tokens.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./design/tokens.css";
import "./design/departmentColors.css";
import "./css/app.css";
import {
  applyThemeAttribute,
  resolveTheme,
  systemPrefersDark,
} from "./design/tokens";
import { fatalError } from "./lib/errorBoundary";
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
app.use(router);

// Last resort: an uncaught error in render, a watcher, or a lifecycle
// hook otherwise leaves whatever the crash froze on screen, with no
// affordance to recover. Roads are already persisted locally as they're
// edited, so a reload is safe, not a data-loss risk.
app.config.errorHandler = (err, _instance, info) => {
  console.error("Unhandled error:", err, info);
  fatalError.value = true;
};

// App.vue (not a page) now owns the boot sequence, and reads the initial
// route's params as part of it (which road to show). It used to run
// inside a page component, mounted only once the router had already
// resolved that page; now that it's the tree's root, it needs this wait
// itself or it can boot against a still-empty route.
void router.isReady().then(() => {
  app.mount("#app");
});
