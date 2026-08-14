/**
 * One-time move of legacy cookie state into origin-isolated storage.
 *
 * Runs once per browser, before the app reads any state. After it has run
 * the app never reads `document.cookie` again, so a cookie planted by
 * another `*.mit.edu` host is inert from then on. That matters because a
 * cookie carrying `Domain=.mit.edu` cannot be deleted from this origin (a
 * host-only delete does not match it); the guarantee comes from ignoring
 * cookies entirely, not from clearing them.
 *
 * The rule for what crosses the boundary: migrate DATA, never authority or
 * control flags. A cookie present at migration time cannot be told apart
 * from one an attacker planted, so anything that grants access or triggers
 * a destructive branch is dropped rather than trusted.
 *
 * - `accessInfo` (the bearer token) is dropped: importing it would carry a
 *   session-fixation risk across the very boundary this establishes. Users
 *   log in once more; their roads are already in FireRoad.
 * - `versionNumber` is dropped and rewritten to the current version: a
 *   mismatched value triggers the local-state reset, so honoring a planted
 *   one would hand an attacker a remote wipe.
 * - `hasLoggedIn` and the consent answer are dropped: both are decisions,
 *   and re-asking once is cheaper than honoring a forged answer.
 * - Roads created while logged out ARE migrated, through the same
 *   validator the cookie path used. They are the student's own work, they
 *   are visible and deletable in the UI, and losing them is the worse
 *   failure.
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

  // Written from the constant, never from the cookie: a planted value here
  // would trigger the local-state reset on the next boot. Migrated state is
  // by definition current, so the current version is the honest answer.
  writeValue(STORAGE_KEYS.versionNumber, APP_VERSION);

  // accessInfo, hasLoggedIn, consent and tab ids are intentionally not
  // carried over (see module docstring); tab ids reallocate on demand.

  for (const key of cookies.keys()) {
    cookies.remove(key);
  }
  writeValue(STORAGE_KEYS.migrated, true);
}
