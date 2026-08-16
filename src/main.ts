import { createApp } from "vue";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";

import App from "./App.vue";
import MainPage from "./pages/MainPage.vue";

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

const routes = [
  { path: "/", redirect: "/road" },
  { path: "/road/:road?", component: MainPage },
  // Connections takes over the canvas area within the same shell, so it is
  // the same page component, seedable via ?from=<id> and deep-linkable.
  { path: "/explore/:road?", component: MainPage },
  {
    path: "/styleguide",
    component: () => import("./pages/StyleguidePage.vue"),
  },
  { path: "/:pathMatch(.*)*", redirect: "/road" },
];

const router = createRouter({
  // BASE_URL comes from vite's --base flag (build-dev passes /dev), so
  // the router base and the served path are one fact instead of a
  // string-sniff of VITE_URL.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

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

app.mount("#app");
