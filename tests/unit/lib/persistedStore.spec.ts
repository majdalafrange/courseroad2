// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PANEL_SIDE,
  DEFAULT_THEME_MODE,
  PERSISTED_STORE_KEY,
  loadPersistedStore,
  parsePersistedBlob,
  persistCurrentSemester,
  persistPanelSide,
  persistThemeMode,
  persistedCurrentSemester,
  persistedPanelSide,
  persistedThemeMode,
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
    // A genuinely empty roads object still comes back as {}, not omitted.
    expect(noRoads.roads).toEqual({});
  });

  it("surfaces (rather than silently drops) a roads field that had entries but none survived validation", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // roads is present and non-empty, but its only entry is invalid
    // (contents isn't a plain object), so cleanStoredRoad drops it.
    const clean = sanitizePersistedStore({
      roads: { r: { contents: "not-an-object" } },
    });
    expect(clean.roads).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("failed validation"),
    );

    vi.mocked(console.warn).mockClear();

    // A field that was never there in the first place must not warn.
    expect(sanitizePersistedStore({}).roads).toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();

    vi.restoreAllMocks();
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

  it("rejects non-finite currentSemester, non-boolean flags, and an unknown themeMode", () => {
    const clean = sanitizePersistedStore({
      currentSemester: Infinity,
      hideIAP: "yes",
      themeMode: "sepia",
    });
    expect(clean).toEqual({});
  });

  it("keeps a valid themeMode", () => {
    const clean = sanitizePersistedStore({ themeMode: "dark" });
    expect(clean).toEqual({ themeMode: "dark" });
  });

  it("keeps a valid panelSide and rejects an unknown one", () => {
    expect(sanitizePersistedStore({ panelSide: "right" })).toEqual({
      panelSide: "right",
    });
    expect(sanitizePersistedStore({ panelSide: "center" })).toEqual({});
  });
});

describe("localStorage readers", () => {
  it("loadPersistedStore survives corrupt storage", () => {
    localStorage.setItem(PERSISTED_STORE_KEY, "{oops");
    expect(loadPersistedStore()).toBeUndefined();
  });

  it("persistedThemeMode takes a stored mode as-is", () => {
    localStorage.setItem(PERSISTED_STORE_KEY, '{"themeMode":"dark"}');
    expect(persistedThemeMode()).toBe("dark");
    localStorage.setItem(PERSISTED_STORE_KEY, '{"themeMode":"light"}');
    expect(persistedThemeMode()).toBe("light");
    localStorage.setItem(PERSISTED_STORE_KEY, '{"themeMode":"system"}');
    expect(persistedThemeMode()).toBe("system");
  });

  it('migrates a pre-"System Default" blob\'s legacy isDarkMode flag', () => {
    localStorage.setItem(PERSISTED_STORE_KEY, '{"isDarkMode":true}');
    expect(persistedThemeMode()).toBe("dark");
    localStorage.setItem(PERSISTED_STORE_KEY, '{"isDarkMode":false}');
    expect(persistedThemeMode()).toBe("light");
  });

  it("prefers a stored themeMode over a stale legacy isDarkMode", () => {
    localStorage.setItem(
      PERSISTED_STORE_KEY,
      '{"themeMode":"system","isDarkMode":false}',
    );
    expect(persistedThemeMode()).toBe("system");
  });

  it("persistedThemeMode falls back to the default when unset or garbage", () => {
    expect(persistedThemeMode()).toBe(DEFAULT_THEME_MODE);
    localStorage.setItem(PERSISTED_STORE_KEY, '{"themeMode":"sepia"}');
    expect(persistedThemeMode()).toBe(DEFAULT_THEME_MODE);
    localStorage.setItem(PERSISTED_STORE_KEY, '{"isDarkMode":"yes"}');
    expect(persistedThemeMode()).toBe(DEFAULT_THEME_MODE);
    localStorage.setItem(PERSISTED_STORE_KEY, "{oops");
    expect(persistedThemeMode()).toBe(DEFAULT_THEME_MODE);
  });

  it("persistThemeMode writes the mode without touching the rest, clearing any legacy flag", () => {
    localStorage.setItem(
      PERSISTED_STORE_KEY,
      '{"activeRoad":"a","isDarkMode":false}',
    );
    persistThemeMode("dark");
    expect(loadPersistedStore()).toEqual({
      activeRoad: "a",
      themeMode: "dark",
    });
    expect(persistedThemeMode()).toBe("dark");
  });

  it("persistThemeMode starts a blob when none exists or it is corrupt", () => {
    persistThemeMode("dark");
    expect(persistedThemeMode()).toBe("dark");
    localStorage.setItem(PERSISTED_STORE_KEY, "{oops");
    persistThemeMode("light");
    expect(loadPersistedStore()).toEqual({ themeMode: "light" });
  });

  it("persistedPanelSide defaults to left, and takes a stored side as-is", () => {
    expect(persistedPanelSide()).toBe(DEFAULT_PANEL_SIDE);
    expect(DEFAULT_PANEL_SIDE).toBe("left");
    localStorage.setItem(PERSISTED_STORE_KEY, '{"panelSide":"right"}');
    expect(persistedPanelSide()).toBe("right");
    localStorage.setItem(PERSISTED_STORE_KEY, '{"panelSide":"left"}');
    expect(persistedPanelSide()).toBe("left");
  });

  it("persistedPanelSide falls back to the default when unset or garbage", () => {
    localStorage.setItem(PERSISTED_STORE_KEY, '{"panelSide":"center"}');
    expect(persistedPanelSide()).toBe(DEFAULT_PANEL_SIDE);
    localStorage.setItem(PERSISTED_STORE_KEY, "{oops");
    expect(persistedPanelSide()).toBe(DEFAULT_PANEL_SIDE);
  });

  it("persistPanelSide writes the side without touching the rest", () => {
    localStorage.setItem(PERSISTED_STORE_KEY, '{"activeRoad":"a"}');
    persistPanelSide("right");
    expect(loadPersistedStore()).toEqual({
      activeRoad: "a",
      panelSide: "right",
    });
    expect(persistedPanelSide()).toBe("right");
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
      '{"activeRoad":"a","themeMode":"light"}',
    );
    persistCurrentSemester(4);
    expect(loadPersistedStore()).toEqual({
      activeRoad: "a",
      themeMode: "light",
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
