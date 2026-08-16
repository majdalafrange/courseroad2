/**
 * Theme preference: light, dark, or system (the default). "System" tracks
 * the OS setting live, including a change while the app is open; the
 * other two are lasting, explicit choices persisted across sessions.
 */

import { onBeforeUnmount, onMounted, watch } from "vue";

import { applyThemeAttribute, resolveTheme } from "../design/tokens";
import { persistThemeMode, type ThemeMode } from "../lib/persistedStore";
import { useCourseDataStore } from "../stores/courseData";

export function useTheme(): {
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
} {
  const store = useCourseDataStore();

  function setThemeMode(mode: ThemeMode): void {
    store.setThemeMode(mode);
    applyThemeAttribute(resolveTheme(mode, store.systemPrefersDark));
    // Written immediately: the beforeunload snapshot only runs for
    // logged-in students, which lost the theme on reload for everyone
    // else.
    if (store.cookiesAllowed) {
      persistThemeMode(mode);
    }
  }

  /**
   * The styleguide's quick preview control: flips between explicit
   * light/dark, skipping system (there's nothing to "toggle" once a
   * third option exists, so this just picks the opposite of what's
   * showing now).
   */
  function toggleTheme(): void {
    setThemeMode(store.isDarkMode ? "light" : "dark");
  }

  return { setThemeMode, toggleTheme };
}

/**
 * Keeps the applied theme attribute in sync with the OS while the
 * preference is "system", including a live OS change without a reload.
 * Call once from the app shell.
 */
export function useSystemThemeSync(): void {
  const store = useCourseDataStore();

  // Covers both an explicit switch and a system-driven change while
  // themeMode is "system": either way, isDarkMode is what actually
  // rendered, so it's the one thing worth watching.
  watch(
    () => store.isDarkMode,
    (dark) => applyThemeAttribute(dark ? "dark" : "light"),
  );

  if (typeof matchMedia !== "function") {
    return;
  }
  const query = matchMedia("(prefers-color-scheme: dark)");
  function onChange(event: MediaQueryListEvent): void {
    store.systemPrefersDark = event.matches;
  }
  onMounted(() => query.addEventListener("change", onChange));
  onBeforeUnmount(() => query.removeEventListener("change", onChange));
}
