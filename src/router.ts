import { createRouter, createWebHistory } from "vue-router";
import { routes, handleHotUpdate } from "vue-router/auto-routes";

export const router = createRouter({
  // BASE_URL comes from vite's --base flag (build-dev passes /dev), so
  // the router base and the served path are one fact instead of a
  // string-sniff of VITE_URL.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

if (import.meta.hot) {
  handleHotUpdate(router);
}
