/**
 * One-time move of legacy cookie state into origin-isolated storage, run
 * once per browser before the app reads any state. After this the app
 * never reads `document.cookie` again, so a cookie planted by another
 * `*.mit.edu` host is inert. The guarantee comes from ignoring cookies,
 * not clearing them (a `Domain=.mit.edu` cookie can't be deleted from
 * this origin anyway).
 *
 * Rule for what crosses: migrate DATA, never authority/control flags. A
 * cookie present at migration time can't be told apart from an
 * attacker's plant.
 *
 * - `accessInfo` (bearer token): dropped, avoids a session-fixation risk;
 *   users just log in again.
 * - `versionNumber`: dropped and rewritten, since a planted mismatch
 *   would trigger the local-state-reset branch (a remote wipe).
 * - `hasLoggedIn`/consent answer: dropped; re-asking once is cheaper than
 *   honoring a forged answer.
 * - Roads created while logged out: migrated (through the same validator
 *   the cookie path uses), since they're the student's own work, and
 *   losing them is the worse failure.
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
