/**
 * The one theme toggle: flips the store flag, applies the document
 * attribute, and persists the choice when storage consent allows. Every
 * surface with a toggle uses this; a page-local copy is how the
 * styleguide's toggle once lost persistence.
 */

import { applyThemeAttribute } from "../design/tokens";
import { persistThemePreference } from "../lib/persistedStore";
import { useCourseDataStore } from "../stores/courseData";

export function useTheme(): { toggleTheme: () => void } {
  const store = useCourseDataStore();

  function toggleTheme(): void {
    store.changeTheme();
    applyThemeAttribute(store.isDarkMode ? "dark" : "light");
    // Written immediately: the beforeunload snapshot only runs for
    // logged-in students, which lost the theme on reload for everyone
    // else.
    if (store.cookiesAllowed) {
      persistThemePreference(Boolean(store.isDarkMode));
    }
  }

  return { toggleTheme };
}
