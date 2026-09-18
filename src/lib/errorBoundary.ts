import { ref } from "vue";

/**
 * Flips true from main.ts's global Vue error handler. App.vue swaps the
 * whole page for a fallback when this is set, instead of leaving whatever
 * an uncaught render/watcher error froze on screen.
 */
export const fatalError = ref(false);

const CHUNK_RELOAD_KEY = "chunkReloadAt";
const CHUNK_RELOAD_WINDOW_MS = 30_000;

let reloading = false;

/** A dynamic import that failed to fetch, in Chrome, Firefox, Safari, or Vite's CSS preload wording. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    message,
  );
}

/**
 * Reload once to pick up a chunk that failed to load (network blip, or a
 * deploy that replaced the hashed assets under an open tab). A second
 * failure within the window, or blocked sessionStorage, shows the fatal
 * screen instead so the page cannot reload in a loop.
 */
export function recoverFromChunkLoadError(
  reload: () => void = () => window.location.reload(),
): void {
  if (reloading) {
    return;
  }
  let last: number;
  try {
    last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0;
    if (Date.now() - last >= CHUNK_RELOAD_WINDOW_MS) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    }
  } catch {
    fatalError.value = true;
    return;
  }
  if (Date.now() - last < CHUNK_RELOAD_WINDOW_MS) {
    fatalError.value = true;
    return;
  }
  reloading = true;
  reload();
}
