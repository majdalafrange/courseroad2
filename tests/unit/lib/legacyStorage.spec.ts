// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  APP_VERSION,
  STORAGE_KEYS,
  readValue,
} from "../../../src/lib/appStorage";
import { cookies } from "../../../src/lib/cookies";
import {
  LEGACY_STORE_KEY,
  migrateLegacyCookies,
  separateStoreSnapshot,
} from "../../../src/lib/legacyStorage";

function clearCookies() {
  for (const key of cookies.keys()) {
    cookies.remove(key);
  }
}

afterEach(() => {
  localStorage.clear();
  clearCookies();
});

const road = {
  downloaded: "2026-08-01T00:00:00.000Z",
  changed: "2026-08-01T00:00:00.000Z",
  name: "Cookie road",
  agent: "",
  contents: {
    coursesOfStudy: ["girs"],
    selectedSubjects: [
      {
        subject_id: "8.01",
        title: "Physics I",
        semester: 1,
        overrideWarnings: false,
      },
    ],
    progressOverrides: {},
    progressAssertions: {},
  },
};

describe("migrateLegacyCookies", () => {
  it("moves the student's roads and cosmetic flags across", () => {
    cookies.set("hasOnboarded", "true");
    cookies.set("newRoads", { $0$: road });

    migrateLegacyCookies();

    expect(readValue(STORAGE_KEYS.hasOnboarded)).toBe("true");
    const roads = readValue<Record<string, typeof road>>(STORAGE_KEYS.newRoads);
    expect(Object.keys(roads ?? {})).toEqual(["$0$"]);
    // Roads arrive through the same validator the cookie path used.
    expect(roads?.$0$.contents.selectedSubjects).toHaveLength(16);
  });

  it("does NOT migrate accessInfo, so a planted token cannot cross over", () => {
    cookies.set("accessInfo", { access_token: "attacker-token" });

    migrateLegacyCookies();

    expect(readValue(STORAGE_KEYS.accessInfo)).toBeUndefined();
  });

  it("ignores a planted versionNumber, writing the real one instead", () => {
    // Honoring this would fire the version-change branch and wipe local
    // state on the next boot.
    cookies.set("versionNumber", "9.9.9-wipe");

    migrateLegacyCookies();

    expect(readValue(STORAGE_KEYS.versionNumber)).toBe(APP_VERSION);
  });

  it("does not carry over login or consent decisions", () => {
    cookies.set("hasLoggedIn", "true");
    cookies.set("dismissedCookies", "true");

    migrateLegacyCookies();

    expect(readValue(STORAGE_KEYS.hasLoggedIn)).toBeUndefined();
    expect(readValue(STORAGE_KEYS.consent)).toBeUndefined();
  });

  it("leaves legacy cookies in place for the old app on the same origin", () => {
    // The old app at courseroad.mit.edu/ shares these path=/ cookies.
    cookies.set("newRoads", { $0$: road });
    cookies.set("accessInfo", { access_token: "t" });
    cookies.set("versionNumber", "1.0.0");

    migrateLegacyCookies();

    expect(cookies.isKey("newRoads")).toBe(true);
    expect(cookies.isKey("accessInfo")).toBe(true);
    expect(cookies.isKey("versionNumber")).toBe(true);
  });

  it("runs once: a cookie planted afterwards is never imported", () => {
    migrateLegacyCookies();
    expect(readValue(STORAGE_KEYS.migrated)).toBe(true);

    // A domain-scoped cookie from another *.mit.edu host cannot be deleted
    // from this origin, so the guarantee is that it is never read again.
    cookies.set("newRoads", { evil: road });
    cookies.set("hasLoggedIn", "true");
    migrateLegacyCookies();

    expect(readValue(STORAGE_KEYS.newRoads)).toBeUndefined();
    expect(readValue(STORAGE_KEYS.hasLoggedIn)).toBeUndefined();
  });

  it("skips malformed legacy values without throwing", () => {
    cookies.set("newRoads", "not-a-map");

    expect(() => migrateLegacyCookies()).not.toThrow();

    expect(readValue(STORAGE_KEYS.newRoads)).toBeUndefined();
  });
});

describe("separateStoreSnapshot", () => {
  const oldAppSnapshot = {
    loggedIn: true,
    cookiesAllowed: true,
    roads: { abc: road },
    subjectsInfo: [],
  };

  it("adopts the old app's snapshot without touching it", () => {
    const raw = JSON.stringify(oldAppSnapshot);
    localStorage.setItem(LEGACY_STORE_KEY, raw);

    separateStoreSnapshot();

    expect(localStorage.getItem(STORAGE_KEYS.store)).toBe(raw);
    expect(localStorage.getItem(LEGACY_STORE_KEY)).toBe(raw);
  });

  it("moves a snapshot this app wrote out of the old app's key", () => {
    // A partial settings write the old app would load as its whole state.
    const raw = JSON.stringify({ currentSemester: 1, themeMode: "dark" });
    localStorage.setItem(LEGACY_STORE_KEY, raw);

    separateStoreSnapshot();

    expect(localStorage.getItem(STORAGE_KEYS.store)).toBe(raw);
    expect(localStorage.getItem(LEGACY_STORE_KEY)).toBeNull();
  });

  it("never overwrites this app's own snapshot", () => {
    localStorage.setItem(
      STORAGE_KEYS.store,
      JSON.stringify({ themeMode: "light" }),
    );
    localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(oldAppSnapshot));

    separateStoreSnapshot();

    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.store)!)).toEqual({
      themeMode: "light",
    });
    expect(localStorage.getItem(LEGACY_STORE_KEY)).not.toBeNull();
  });

  it("ignores an unparseable legacy value", () => {
    localStorage.setItem(LEGACY_STORE_KEY, "{not json");

    expect(() => separateStoreSnapshot()).not.toThrow();

    expect(localStorage.getItem(STORAGE_KEYS.store)).toBeNull();
    expect(localStorage.getItem(LEGACY_STORE_KEY)).toBe("{not json");
  });
});

describe("storage keys", () => {
  it("keeps this app's snapshot off the key the old app reads", () => {
    expect(STORAGE_KEYS.store).not.toBe(LEGACY_STORE_KEY);
  });
});
