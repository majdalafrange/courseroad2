/**
 * One-time move of legacy cookie state into origin-isolated storage.
 * After this and recordOldAppUse the app never reads `document.cookie`,
 * so a cookie planted by another `*.mit.edu` host is inert (a
 * `Domain=.mit.edu` cookie cannot be deleted from this origin, only
 * ignored).
 *
 * Data migrates, authority does not, since a planted cookie cannot be
 * told from a real one: the bearer token, the schema version, and the
 * login and consent flags are dropped. Logged-out roads are migrated
 * through the same validator, since losing them is the worse failure.
 *
 * Cookies are never deleted: the old app on this origin still reads them,
 * and clears localStorage when its versionNumber cookie is missing.
 */

import { APP_VERSION, STORAGE_KEYS, readValue, writeValue } from "./appStorage";
import { cookies } from "./cookies";
import { sanitizeRoadMap } from "./persistedStore";

/** Cosmetic "already seen it" flags. Worst case they hide a one-off notice. */
const STRING_KEYS = [
  STORAGE_KEYS.hasOnboarded,
  STORAGE_KEYS.dismissedAndroidWarning,
] as const;

/**
 * Copy legacy cookie state into localStorage, once (guarded by a marker).
 */
export function migrateLegacyCookies(): void {
  if (readValue<boolean>(STORAGE_KEYS.migrated) === true) {
    return;
  }

  for (const key of STRING_KEYS) {
    const value = cookies.get(key);
    if (typeof value === "string" && value !== "") {
      writeValue(key, value);
    }
  }

  // Logged-out roads: validated exactly as the cookie path validated them.
  const roads = sanitizeRoadMap(cookies.get(STORAGE_KEYS.newRoads));
  if (roads !== undefined && Object.keys(roads).length > 0) {
    writeValue(STORAGE_KEYS.newRoads, roads);
  }

  // Written from the constant, never from the cookie: a planted mismatch
  // would trigger the local-state reset on the next boot.
  writeValue(STORAGE_KEYS.versionNumber, APP_VERSION);

  // accessInfo, hasLoggedIn, consent and tab ids are not carried over.

  writeValue(STORAGE_KEYS.migrated, true);
}

/** The old app's snapshot key; it loads the value as its whole state. */
export const LEGACY_STORE_KEY = "courseRoadStore";

/** Cookies only the old app sets; this app never writes cookies. */
const OLD_APP_COOKIES = [
  "versionNumber",
  "dismissedCookies",
  "hasLoggedIn",
  "newRoads",
  "accessInfo",
  "has_set_year",
] as const;

/**
 * Record, once per browser, whether the old CourseRoad ran here. A planted
 * cookie can at most pick the classic layout. Run after
 * separateStoreSnapshot, so a snapshot this app wrote does not count.
 */
export function recordOldAppUse(): void {
  if (readValue<boolean>(STORAGE_KEYS.usedOldApp) !== undefined) {
    return;
  }
  let oldSnapshot = false;
  try {
    oldSnapshot = localStorage.getItem(LEGACY_STORE_KEY) !== null;
  } catch {
    // Storage unavailable; the cookies still answer.
  }
  const used = oldSnapshot || OLD_APP_COOKIES.some((key) => cookies.isKey(key));
  writeValue(STORAGE_KEYS.usedOldApp, used);
}

/**
 * Keep this app's snapshot off the old app's key. Adopts the old app's
 * snapshot when this app has none, and moves out one this app wrote there
 * (it has themeMode, panelSide or roadLayout, or no roads).
 */
export function separateStoreSnapshot(): void {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LEGACY_STORE_KEY);
  } catch {
    return;
  }
  if (raw === null) {
    return;
  }
  let blob: unknown;
  try {
    blob = JSON.parse(raw);
  } catch {
    return;
  }
  if (typeof blob !== "object" || blob === null || Array.isArray(blob)) {
    return;
  }
  const writtenHere =
    "themeMode" in blob ||
    "panelSide" in blob ||
    "roadLayout" in blob ||
    !("roads" in blob);
  try {
    if (localStorage.getItem(STORAGE_KEYS.store) === null) {
      localStorage.setItem(STORAGE_KEYS.store, raw);
    }
    if (writtenHere) {
      localStorage.removeItem(LEGACY_STORE_KEY);
    }
  } catch {
    // Storage unavailable; both keys stay as they were.
  }
}
