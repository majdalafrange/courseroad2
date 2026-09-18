/**
 * Guarded reads of persisted app state. localStorage is untrusted input
 * (a truncated or hand-edited blob), so nothing reaches the store without
 * passing through here: parse failures yield `undefined`, keys outside the
 * allowlist are dropped (`loggedIn` and `cookiesAllowed` especially),
 * `__proto__`-style keys are discarded, and objects are rebuilt fresh.
 */

import type {
  ProgressAssertion,
  Road,
  SelectedSubject,
  Subject,
} from "./types";
import { flatten } from "./types";
import { STORAGE_KEYS } from "./appStorage";
import { isCustomColor } from "./colors";
import { formatFireroadDate } from "./dates";
import { getSimpleSelectedSubjects } from "./roads";

// Imported, not copied: clearAppStorage iterates STORAGE_KEYS, and a
// hard-coded duplicate could drift.
export const PERSISTED_STORE_KEY = STORAGE_KEYS.store;

export type ThemeMode = "light" | "dark" | "system";
const THEME_MODES: readonly ThemeMode[] = ["light", "dark", "system"];

/** The theme a visitor gets before they have chosen one: the OS setting. */
export const DEFAULT_THEME_MODE: ThemeMode = "system";

/** Which side the audit panel (plan) and node panel (explore) render on. */
export type PanelSide = "left" | "right";
const PANEL_SIDES: readonly PanelSide[] = ["left", "right"];
export const DEFAULT_PANEL_SIDE: PanelSide = "left";

/**
 * Keys restored from a persisted snapshot into the courseData store.
 * Everything else in the blob is session state (or worse) and is dropped.
 */
const ALLOWED_KEYS = [
  "versionNumber",
  "currentSemester",
  "activeRoad",
  "roads",
  "hideIAP",
  "themeMode",
  "panelSide",
  "subjectsInfo",
  "subjectsIndex",
  "genericCourses",
  "genericIndex",
] as const;

/** Keys that reach the prototype chain instead of the object. Never copied. */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Own enumerable keys minus the prototype-reaching ones. */
function safeKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).filter((key) => !FORBIDDEN_KEYS.has(key));
}

/** Parse persisted JSON. Anything but a plain object yields undefined. */
export function parsePersistedBlob(
  raw: string | null | undefined,
): Record<string, unknown> | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Record with values of one primitive type; other entries are dropped. */
function cleanPrimitiveRecord<T extends number | string | boolean>(
  value: unknown,
  type: "number" | "string" | "boolean",
): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isPlainObject(value)) {
    return out;
  }
  for (const key of safeKeys(value)) {
    if (typeof value[key] === type) {
      out[key] = value[key] as T;
    }
  }
  return out;
}

function cleanProgressAssertions(
  value: unknown,
): Record<string, ProgressAssertion> {
  const out: Record<string, ProgressAssertion> = {};
  if (!isPlainObject(value)) {
    return out;
  }
  for (const key of safeKeys(value)) {
    const entry = value[key];
    if (!isPlainObject(entry)) {
      continue;
    }
    const assertion: ProgressAssertion = {};
    if (Array.isArray(entry.substitutions)) {
      assertion.substitutions = entry.substitutions.filter(
        (s): s is string => typeof s === "string",
      );
    }
    if (typeof entry.ignore === "boolean") {
      assertion.ignore = entry.ignore;
    }
    out[key] = assertion;
  }
  return out;
}

/**
 * One selected-subject entry. Only the id is required; the semester is
 * canonicalized by getSimpleSelectedSubjects and display fields are
 * back-filled from the catalog.
 */
function cleanSelectedSubject(value: unknown): SelectedSubject | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const id = typeof value.subject_id === "string" ? value.subject_id : value.id;
  if (typeof id !== "string") {
    return undefined;
  }
  const subject: Record<string, unknown> = {};
  for (const key of safeKeys(value)) {
    subject[key] = value[key];
  }
  // Pre-rename saves carry `id` only; mirrors roads.ts's
  // normalizeIncomingSubject.
  subject.subject_id = id;
  delete subject.id;
  // A color that does not name a palette entry is dropped; the render path
  // falls back to the department color.
  if (!isCustomColor(subject.custom_color)) {
    delete subject.custom_color;
  }
  return subject as unknown as SelectedSubject;
}

/**
 * One stored road, rebuilt onto a fresh object. Accepts the bucketed
 * layout ($state snapshots) and the flat list (old saves); both normalize
 * to 16 buckets. Undefined when the value is not road-shaped.
 */
function cleanStoredRoad(value: unknown): Road | undefined {
  if (!isPlainObject(value) || !isPlainObject(value.contents)) {
    return undefined;
  }
  const contents = value.contents;
  const rawSubjects = contents.selectedSubjects;
  if (rawSubjects !== undefined && !Array.isArray(rawSubjects)) {
    return undefined;
  }
  // flatten() is concat-based, so it accepts the flat list unchanged and
  // unwraps the bucketed layout by one level; either way a flat list.
  const flat = (
    rawSubjects === undefined ? [] : flatten(rawSubjects as unknown[][])
  )
    .map(cleanSelectedSubject)
    .filter((s): s is SelectedSubject => s !== undefined);
  return {
    downloaded:
      typeof value.downloaded === "string"
        ? value.downloaded
        : formatFireroadDate(),
    changed:
      typeof value.changed === "string" ? value.changed : formatFireroadDate(),
    name: typeof value.name === "string" ? value.name : "",
    agent: typeof value.agent === "string" ? value.agent : "",
    contents: {
      coursesOfStudy: Array.isArray(contents.coursesOfStudy)
        ? contents.coursesOfStudy.filter(
            (c): c is string => typeof c === "string",
          )
        : ["girs"],
      selectedSubjects: getSimpleSelectedSubjects(flat),
      progressOverrides: cleanPrimitiveRecord<number>(
        contents.progressOverrides,
        "number",
      ),
      progressAssertions: cleanProgressAssertions(contents.progressAssertions),
    },
  };
}

/**
 * Untrusted road map → a clean map on a fresh object. Roads that are not
 * road-shaped are dropped individually. Undefined when the value is not a
 * map.
 */
export function sanitizeRoadMap(
  value: unknown,
): Record<string, Road> | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  const roads: Record<string, Road> = {};
  for (const key of safeKeys(value)) {
    const road = cleanStoredRoad(value[key]);
    if (road !== undefined) {
      roads[key] = road;
    }
  }
  return roads;
}

/** Trimmed catalog entries persisted for first paint. */
function cleanSubjectList(value: unknown): Subject[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: Subject[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry) || typeof entry.subject_id !== "string") {
      continue;
    }
    const subject: Record<string, unknown> = {};
    for (const key of safeKeys(entry)) {
      subject[key] = entry[key];
    }
    if (typeof subject.title !== "string") {
      subject.title = "";
    }
    out.push(subject as unknown as Subject);
  }
  return out;
}

/**
 * Allowlist + per-key sanitization of a parsed snapshot, ready for
 * `$patch`. Never carries session keys; `activeRoad` is kept only when it
 * names a surviving road.
 */
export function sanitizePersistedStore(
  blob: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(blob, key)) {
      continue;
    }
    const value = blob[key];
    switch (key) {
      case "versionNumber":
      case "activeRoad":
        if (typeof value === "string") {
          clean[key] = value;
        }
        break;
      case "currentSemester":
        if (typeof value === "number" && Number.isFinite(value)) {
          clean[key] = value;
        }
        break;
      case "hideIAP":
        if (typeof value === "boolean") {
          clean[key] = value;
        }
        break;
      case "themeMode":
        if (
          typeof value === "string" &&
          THEME_MODES.includes(value as ThemeMode)
        ) {
          clean[key] = value;
        }
        break;
      case "panelSide":
        if (
          typeof value === "string" &&
          PANEL_SIDES.includes(value as PanelSide)
        ) {
          clean[key] = value;
        }
        break;
      case "roads": {
        const roads = sanitizeRoadMap(value);
        // undefined: nothing roads-shaped to restore. {}: every entry
        // failed validation. Kept apart.
        if (roads !== undefined) {
          if (
            Object.keys(roads).length === 0 &&
            isPlainObject(value) &&
            Object.keys(value).length > 0
          ) {
            console.warn(
              "Persisted roads all failed validation and were dropped.",
            );
          }
          clean.roads = roads;
        }
        break;
      }
      case "subjectsInfo":
      case "genericCourses":
        clean[key] = cleanSubjectList(value);
        break;
      case "subjectsIndex":
      case "genericIndex":
        clean[key] = cleanPrimitiveRecord<number>(value, "number");
        break;
    }
  }
  if (
    typeof clean.activeRoad === "string" &&
    (clean.roads === undefined ||
      !(clean.activeRoad in (clean.roads as Record<string, Road>)))
  ) {
    delete clean.activeRoad;
  }
  return clean;
}

/** Read and parse the persisted snapshot; undefined on any failure. */
export function loadPersistedStore(): Record<string, unknown> | undefined {
  try {
    return parsePersistedBlob(localStorage.getItem(PERSISTED_STORE_KEY));
  } catch {
    // localStorage itself can throw (privacy mode, storage disabled)
    return undefined;
  }
}

/**
 * Pre-paint theme read. A pre-"system" blob (only the old `isDarkMode`
 * flag) migrates to the equivalent explicit choice.
 */
export function persistedThemeMode(): ThemeMode {
  const blob = loadPersistedStore();
  const stored = blob?.themeMode;
  if (typeof stored === "string" && THEME_MODES.includes(stored as ThemeMode)) {
    return stored as ThemeMode;
  }
  const legacy = blob?.isDarkMode;
  if (typeof legacy === "boolean") {
    return legacy ? "dark" : "light";
  }
  return DEFAULT_THEME_MODE;
}

/**
 * Single-key mid-session write. Not through savePersistedStore, which
 * strips catalog descriptions on the assumption the page is closing.
 */
export function persistThemeMode(mode: ThemeMode): void {
  try {
    const blob =
      parsePersistedBlob(localStorage.getItem(PERSISTED_STORE_KEY)) ?? {};
    blob.themeMode = mode;
    // Clear the legacy flag so persistedThemeMode's migration path cannot
    // resurface it.
    delete blob.isDarkMode;
    localStorage.setItem(PERSISTED_STORE_KEY, JSON.stringify(blob));
  } catch {
    // Storage unavailable; the choice still applies for this session.
  }
}

/** Pre-paint read of which side the audit/node panel renders on. */
export function persistedPanelSide(): PanelSide {
  const stored = loadPersistedStore()?.panelSide;
  return typeof stored === "string" && PANEL_SIDES.includes(stored as PanelSide)
    ? (stored as PanelSide)
    : DEFAULT_PANEL_SIDE;
}

/** Single-key mid-session write, like persistThemeMode. */
export function persistPanelSide(side: PanelSide): void {
  try {
    const blob =
      parsePersistedBlob(localStorage.getItem(PERSISTED_STORE_KEY)) ?? {};
    blob.panelSide = side;
    localStorage.setItem(PERSISTED_STORE_KEY, JSON.stringify(blob));
  } catch {
    // Storage unavailable; the choice still applies for this session.
  }
}

/**
 * Single-key mid-session write, like persistThemeMode. Logged out this
 * copy is the only one.
 */
export function persistCurrentSemester(semester: number): void {
  try {
    const blob =
      parsePersistedBlob(localStorage.getItem(PERSISTED_STORE_KEY)) ?? {};
    blob.currentSemester = semester;
    localStorage.setItem(PERSISTED_STORE_KEY, JSON.stringify(blob));
  } catch {
    // Storage unavailable; the choice still applies for this session.
  }
}

/** Boot-time read of the persisted semester; anything but a whole number in bucket range reads as absent. */
export function persistedCurrentSemester(): number | undefined {
  const stored = loadPersistedStore()?.currentSemester;
  if (
    typeof stored === "number" &&
    Number.isInteger(stored) &&
    stored >= 1 &&
    stored <= 15
  ) {
    return stored;
  }
  return undefined;
}

/**
 * The beforeunload snapshot write. Descriptions are stripped from the
 * catalog first; they dominate the payload and reload from the network
 * anyway.
 */
export function savePersistedStore(store: {
  $state: unknown;
  subjectsInfo: Subject[];
  setSubjectsInfo(subjects: Subject[]): void;
}): void {
  const subjectsInfoNoDescriptions = store.subjectsInfo.map((x) => ({
    subject_id: x.subject_id,
    title: x.title,
    offered_fall: x.offered_fall,
    offered_spring: x.offered_spring,
    offered_IAP: x.offered_IAP,
  })) as Subject[];
  store.setSubjectsInfo(subjectsInfoNoDescriptions);
  try {
    localStorage.setItem(PERSISTED_STORE_KEY, JSON.stringify(store.$state));
  } catch {
    // Storage full or unavailable; the road still lives in cookies/cloud.
  }
}
