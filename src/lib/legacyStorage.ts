/**
 * One-time move of legacy cookie state into origin-isolated storage.
 * After this the app never reads `document.cookie`, so a cookie planted
 * by another `*.mit.edu` host is inert (a `Domain=.mit.edu` cookie cannot
 * be deleted from this origin, only ignored).
 *
 * Data migrates, authority does not, since a planted cookie cannot be
 * told from a real one: the bearer token, the schema version, and the
 * login and consent flags are dropped. Logged-out roads are migrated
 * through the same validator, since losing them is the worse failure.
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
 * Copy legacy cookie state into localStorage, then drop the cookies.
 * Idempotent: guarded by a marker so an undeletable domain-scoped cookie
 * cannot be re-imported on a later load.
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

  for (const key of cookies.keys()) {
    cookies.remove(key);
  }
  writeValue(STORAGE_KEYS.migrated, true);
}
