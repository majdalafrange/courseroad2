// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DARK_MODE,
  PERSISTED_STORE_KEY,
  loadPersistedStore,
  parsePersistedBlob,
  persistCurrentSemester,
  persistThemePreference,
  persistedCurrentSemester,
  persistedIsDarkMode,
  sanitizePersistedStore,
  sanitizeRoadMap,
} from "../../../src/lib/persistedStore";
import { placed } from "./fixtures";

function roadBlob(extra: Record<string, unknown> = {}) {
  return {
    downloaded: "2026-08-01T00:00:00.000Z",
    changed: "2026-08-01T00:00:00.000Z",
    name: "My First Road",
    agent: "test",
    contents: {
      coursesOfStudy: ["girs"],
      selectedSubjects: [placed("8.01", 1), placed("18.01", 2)],
      progressOverrides: {},
      progressAssertions: {},
    },
    ...extra,
  };
}

afterEach(() => {
  localStorage.clear();
});

describe("parsePersistedBlob", () => {
  it("returns undefined for corrupt or non-object JSON", () => {
    expect(parsePersistedBlob("{oops")).toBeUndefined();
    expect(parsePersistedBlob("3")).toBeUndefined();
    expect(parsePersistedBlob("[1]")).toBeUndefined();
    expect(parsePersistedBlob("null")).toBeUndefined();
    expect(parsePersistedBlob('"road"')).toBeUndefined();
    expect(parsePersistedBlob(null)).toBeUndefined();
    expect(parsePersistedBlob(undefined)).toBeUndefined();
  });

  it("parses a plain object", () => {
    expect(parsePersistedBlob('{"activeRoad":"a"}')).toEqual({
      activeRoad: "a",
    });
  });
});

describe("sanitizeRoadMap", () => {
  it("returns undefined for non-map input", () => {
    expect(sanitizeRoadMap("roads")).toBeUndefined();
    expect(sanitizeRoadMap([roadBlob()])).toBeUndefined();
    expect(sanitizeRoadMap(null)).toBeUndefined();
  });

  it("drops a malformed road without losing its siblings", () => {
    const map = sanitizeRoadMap({
      good: roadBlob(),
      bad: { contents: null },
      worse: "not a road",
    });
    expect(Object.keys(map ?? {})).toEqual(["good"]);
  });

  it("normalizes flat and bucketed subject lists to 16 buckets", () => {
    const flat = sanitizeRoadMap({ r: roadBlob() })?.r;
    expect(flat?.contents.selectedSubjects).toHaveLength(16);
    expect(flat?.contents.selectedSubjects[1][0].subject_id).toBe("8.01");

    const bucketed = sanitizeRoadMap({
      r: roadBlob({
        contents: {
          coursesOfStudy: ["girs"],
          selectedSubjects: [[], [placed("8.01", 1)]],
          progressOverrides: {},
          progressAssertions: {},
        },
      }),
    })?.r;
    expect(bucketed?.contents.selectedSubjects).toHaveLength(16);
    expect(bucketed?.contents.selectedSubjects[1][0].subject_id).toBe("8.01");
  });

  it("clamps out-of-range semesters instead of throwing", () => {
    const road = sanitizeRoadMap({
      r: roadBlob({
        contents: {
          coursesOfStudy: ["girs"],
          selectedSubjects: [
            placed("8.01", 99),
            placed("18.01", -3),
            { ...placed("6.0001", 1), semester: "not a number" },
          ],
          progressOverrides: {},
          progressAssertions: {},
        },
      }),
    })?.r;
    const buckets = road?.contents.selectedSubjects ?? [];
    expect(buckets[15].map((s) => s.subject_id)).toEqual(["8.01"]);
    expect(buckets[0].map((s) => s.subject_id)).toContain("18.01");
  });

  it("never pollutes Object.prototype via __proto__ keys", () => {
    const hostile = JSON.parse(
      `{"__proto__": {"polluted": true},
        "r": {"__proto__": {"polluted": true},
              "contents": {"__proto__": {"polluted": true},
                           "selectedSubjects": [],
                           "progressOverrides": {"__proto__": 7},
                           "progressAssertions": {"__proto__": {}}}}}`,
    );
    const map = sanitizeRoadMap(hostile);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(map ?? {})).toEqual(["r"]);
    expect(
      Object.prototype.hasOwnProperty.call(map?.r ?? {}, "__proto__"),
    ).toBe(false);
    expect(Object.keys(map?.r.contents.progressOverrides ?? {})).toEqual([]);
  });

  it("coerces malformed field types instead of trusting them", () => {
    const road = sanitizeRoadMap({
      r: roadBlob({
        name: { nested: "object" },
        agent: 42,
        contents: {
          coursesOfStudy: ["girs", 7, null],
          selectedSubjects: [{ no_id: true }, placed("8.01", 1)],
          progressOverrides: { "girs%girs": 3, bad: "NaN" },
          progressAssertions: { "girs%girs": { ignore: true }, bad: "x" },
        },
      }),
    })?.r;
    expect(road?.name).toBe("");
    expect(road?.agent).toBe("");
    expect(road?.contents.coursesOfStudy).toEqual(["girs"]);
    expect(road?.contents.selectedSubjects.flat()).toHaveLength(1);
    expect(road?.contents.progressOverrides).toEqual({ "girs%girs": 3 });
    expect(road?.contents.progressAssertions).toEqual({
      "girs%girs": { ignore: true },
    });
  });

  it("drops a custom_color that names no palette entry", () => {
    const road = sanitizeRoadMap({
      r: roadBlob({
        contents: {
          coursesOfStudy: ["girs"],
          selectedSubjects: [
            { ...placed("6.006", 1), custom_color: 5 },
            { ...placed("8.01", 1), custom_color: "@999" },
            { ...placed("18.01", 1), custom_color: "@5" },
          ],
          progressOverrides: {},
          progressAssertions: {},
        },
      }),
    })?.r;
    const colors = road?.contents.selectedSubjects[1].map(
      (s) => s.custom_color,
    );
    expect(colors).toEqual([undefined, undefined, "@5"]);
  });
});

describe("sanitizePersistedStore", () => {
  it("drops keys outside the allowlist (session and consent state)", () => {
    const clean = sanitizePersistedStore({
      loggedIn: true,
      cookiesAllowed: true,
      classInfoStack: ["8.01"],
      loadSubjectsPromise: {},
      subjectsLoaded: true,
      hideIAP: true,
      versionNumber: "1.0.0",
    });
    expect(clean).toEqual({ hideIAP: true, versionNumber: "1.0.0" });
  });

  it("keeps activeRoad only when it names a surviving road", () => {
    const kept = sanitizePersistedStore({
      activeRoad: "r",
      roads: { r: roadBlob() },
    });
    expect(kept.activeRoad).toBe("r");

    const dropped = sanitizePersistedStore({
      activeRoad: "ghost",
      roads: { r: roadBlob() },
    });
    expect(dropped.activeRoad).toBeUndefined();

    const noRoads = sanitizePersistedStore({ activeRoad: "r", roads: {} });
    expect(noRoads.activeRoad).toBeUndefined();
    expect(noRoads.roads).toBeUndefined();
  });

  it("sanitizes the catalog snapshot fields", () => {
    const clean = sanitizePersistedStore({
      subjectsInfo: [
        { subject_id: "8.01", title: "Classical Mechanics" },
        { subject_id: 42 },
        "junk",
      ],
      subjectsIndex: { "8.01": 0, bad: "x" },
      currentSemester: 4,
    });
    expect(clean.subjectsInfo).toEqual([
      { subject_id: "8.01", title: "Classical Mechanics" },
    ]);
    expect(clean.subjectsIndex).toEqual({ "8.01": 0 });
    expect(clean.currentSemester).toBe(4);
  });

  it("rejects non-finite currentSemester and non-boolean flags", () => {
    const clean = sanitizePersistedStore({
      currentSemester: Infinity,
      hideIAP: "yes",
      isDarkMode: 1,
    });
    expect(clean).toEqual({});
  });
});

describe("localStorage readers", () => {
  it("loadPersistedStore survives corrupt storage", () => {
    localStorage.setItem(PERSISTED_STORE_KEY, "{oops");
    expect(loadPersistedStore()).toBeUndefined();
  });

  it("persistedIsDarkMode takes a stored boolean either way", () => {
    localStorage.setItem(PERSISTED_STORE_KEY, '{"isDarkMode":true}');
    expect(persistedIsDarkMode()).toBe(true);
    localStorage.setItem(PERSISTED_STORE_KEY, '{"isDarkMode":false}');
    expect(persistedIsDarkMode()).toBe(false);
  });

  it("persistedIsDarkMode falls back to the default when unset or garbage", () => {
    expect(persistedIsDarkMode()).toBe(DEFAULT_DARK_MODE);
    localStorage.setItem(PERSISTED_STORE_KEY, '{"isDarkMode":"yes"}');
    expect(persistedIsDarkMode()).toBe(DEFAULT_DARK_MODE);
    localStorage.setItem(PERSISTED_STORE_KEY, "{oops");
    expect(persistedIsDarkMode()).toBe(DEFAULT_DARK_MODE);
  });

  it("persistThemePreference writes the flag without touching the rest", () => {
    localStorage.setItem(
      PERSISTED_STORE_KEY,
      '{"activeRoad":"a","isDarkMode":false}',
    );
    persistThemePreference(true);
    expect(loadPersistedStore()).toEqual({ activeRoad: "a", isDarkMode: true });
    expect(persistedIsDarkMode()).toBe(true);
  });

  it("persistThemePreference starts a blob when none exists or it is corrupt", () => {
    persistThemePreference(true);
    expect(persistedIsDarkMode()).toBe(true);
    localStorage.setItem(PERSISTED_STORE_KEY, "{oops");
    persistThemePreference(false);
    expect(loadPersistedStore()).toEqual({ isDarkMode: false });
  });
});

describe("current-semester persistence (the “I am a...” year)", () => {
  it("round-trips the choice through the persisted blob", () => {
    // hideIAP and the theme both survived a reload; this one was lost.
    expect(persistedCurrentSemester()).toBeUndefined();
    persistCurrentSemester(7);
    expect(persistedCurrentSemester()).toBe(7);
  });

  it("writes the one key without touching the rest of the blob", () => {
    localStorage.setItem(
      PERSISTED_STORE_KEY,
      '{"activeRoad":"a","isDarkMode":false}',
    );
    persistCurrentSemester(4);
    expect(loadPersistedStore()).toEqual({
      activeRoad: "a",
      isDarkMode: false,
      currentSemester: 4,
    });
  });

  it("reads garbage as absent", () => {
    for (const value of ['"7"', "0", "16", "3.5", "null", "{}"]) {
      localStorage.setItem(PERSISTED_STORE_KEY, `{"currentSemester":${value}}`);
      expect(persistedCurrentSemester()).toBeUndefined();
    }
  });
});
