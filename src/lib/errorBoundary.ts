import { ref } from "vue";

/**
 * Flips true from main.ts's global Vue error handler. App.vue swaps the
 * whole page for a fallback when this is set, instead of leaving whatever
 * an uncaught render/watcher error froze on screen.
 */
export const fatalError = ref(false);
