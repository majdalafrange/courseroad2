/**
 * Origin-isolated app storage: localStorage only, never cookies. Security
 * boundary, not preference: a cookie set with `Domain=.mit.edu` from any
 * MIT subdomain reaches courseroad.mit.edu and was attacker-writable:
 * planting `accessInfo` substituted the user's FireRoad token (roads
 * would sync into someone else's account); planting `versionNumber`
 * triggered the version-change branch that clears localStorage.
 * localStorage is origin-keyed, so no other host can touch it.
 *
 * Nothing here reaches a server: the FireRoad token travels in an
 * `Authorization: Bearer` header (lib/fireroad.ts). localStorage has no
 * expiry, so entries carry their own: a ttl'd value reads as absent once
 * past it, and is dropped on read.
 */

/** Every key this app owns. Used to clear storage on opt-out and logout. */
export const STORAGE_KEYS = {
  /** Full courseData snapshot (see lib/persistedStore.ts). */
  store: "courseRoadStore",
  /** FireRoad OAuth payload, including the bearer token. */
  accessInfo: "accessInfo",
  /** Roads created while logged out, awaiting a cloud id. */
  newRoads: "newRoads",
  /** Whether the user has ever logged in (drives the auto-login redirect). */
  hasLoggedIn: "hasLoggedIn",
  /** Storage-consent answer: "true" | "optout". */
  consent: "dismissedCookies",
  /** Per-tab agent ids for FireRoad conflict detection. */
  tabs: "tabs",
  /** Schema version; a mismatch resets local state. */
  versionNumber: "versionNumber",
  hasOnboarded: "hasOnboarded",
  dismissedAndroidWarning: "dismissedAndroidWarning",
  hideIAP: "hideIAP",
  showFifthYear: "showFifthYear",
  /** Set once the legacy cookie migration has run; see legacyStorage.ts. */
  migrated: "storageMigrated",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** Envelope written for every entry, so expiry can be enforced on read. */
interface Entry {
  v: unknown;
  /** Epoch ms after which the entry is treated as absent; 0 = no expiry. */
  e: number;
}

function isEntry(value: unknown): value is Entry {
  return (
    typeof value === "object" &&
    value !== null &&
    "v" in value &&
    "e" in value &&
    typeof (value as Entry).e === "number"
  );
}

/**
 * Read a stored value. Returns undefined when absent, unparseable, or
 * expired. Storage access itself can throw (Safari private mode, disabled
 * storage), so every path is guarded.
 */
export function readValue<T>(key: StorageKey): T | undefined {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return undefined;
  }
  if (raw === null) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isEntry(parsed)) {
    // Written by an older build, or hand-edited. Treat as absent.
    return undefined;
  }
  if (parsed.e !== 0 && Date.now() > parsed.e) {
    removeValue(key);
    return undefined;
  }
  return parsed.v as T;
}

/** Write a value, optionally expiring after `ttlMs`. Failures are ignored. */
export function writeValue(
  key: StorageKey,
  value: unknown,
  ttlMs?: number,
): void {
  const entry: Entry = {
    v: value,
    e: ttlMs === undefined ? 0 : Date.now() + ttlMs,
  };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage unavailable. The road still lives in the
    // cloud for logged-in users; logged-out state is best-effort.
  }
}

export function removeValue(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable; nothing to remove.
  }
}

/**
 * Read a raw-string boolean flag. hideIAP and showFifthYear predate the
 * Entry envelope and existing browsers hold them as bare "true"/"false"
 * strings, so these two keys keep that byte format forever. Never route
 * them through readValue: the envelope check would read them as absent
 * and silently reset the preference.
 */
export function readRawFlag(key: StorageKey): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    // Storage access itself can throw (Safari private mode, disabled
    // storage); an unreadable flag is simply off.
    return false;
  }
}

/** Write a raw-string boolean flag (same legacy byte format). */
export function writeRawFlag(key: StorageKey, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable; the toggle still applies for the session.
  }
}

/** Whether a live (unexpired) value exists for `key`. */
export function hasValue(key: StorageKey): boolean {
  return readValue(key) !== undefined;
}

/**
 * Whether ANY bytes exist for `key`, readable or not. readValue treats a
 * truncated or hand-edited entry as absent; restore paths use this to
 * tell "nothing was saved" from "something was saved and is unreadable",
 * so data loss can be reported instead of passing as a fresh start.
 */
export function hasRawValue(key: StorageKey): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Keys that survive a clear. The migration marker must never be cleared:
 * re-running the legacy import would re-read cookies, and a domain-scoped
 * cookie this origin cannot delete would be pulled back in. Consent is the
 * user's standing answer, not session data, so a logout keeps it rather
 * than re-asking.
 */
const DURABLE_KEYS: readonly StorageKey[] = [
  STORAGE_KEYS.migrated,
  STORAGE_KEYS.consent,
];

/** Drop the app's user data (opt-out, logout, version reset). */
export function clearAppStorage(): void {
  for (const key of Object.values(STORAGE_KEYS)) {
    if (!DURABLE_KEYS.includes(key)) {
      removeValue(key);
    }
  }
}

/** Three days, matching the expiry the accessInfo cookie used to carry. */
export const ACCESS_INFO_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Local-state schema version. A stored value that differs from this resets
 * local state, so it is a destructive trigger: it is written only by this
 * app, never carried over from an untrusted source.
 */
export const APP_VERSION = "1.0.0";
