// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCESS_INFO_TTL_MS,
  STORAGE_KEYS,
  clearAppStorage,
  hasRawValue,
  hasValue,
  readRawFlag,
  readValue,
  removeValue,
  writeRawFlag,
  writeValue,
} from "../../../src/lib/appStorage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("appStorage round-trip", () => {
  it("stores and reads back structured values", () => {
    writeValue(STORAGE_KEYS.tabs, { ids: [1, 2] });
    expect(readValue(STORAGE_KEYS.tabs)).toEqual({ ids: [1, 2] });
    expect(hasValue(STORAGE_KEYS.tabs)).toBe(true);
  });

  it("reports absent keys as undefined, not null", () => {
    expect(readValue(STORAGE_KEYS.accessInfo)).toBeUndefined();
    expect(hasValue(STORAGE_KEYS.accessInfo)).toBe(false);
  });

  it("treats corrupt or foreign-shaped entries as absent", () => {
    localStorage.setItem(STORAGE_KEYS.hasLoggedIn, "{oops");
    expect(readValue(STORAGE_KEYS.hasLoggedIn)).toBeUndefined();
    // A bare value written by an older build, without the entry envelope.
    localStorage.setItem(STORAGE_KEYS.hasLoggedIn, '"true"');
    expect(readValue(STORAGE_KEYS.hasLoggedIn)).toBeUndefined();
  });

  it("removes a single key", () => {
    writeValue(STORAGE_KEYS.hasOnboarded, "true");
    removeValue(STORAGE_KEYS.hasOnboarded);
    expect(readValue(STORAGE_KEYS.hasOnboarded)).toBeUndefined();
  });

  it("hasRawValue sees bytes readValue treats as absent", () => {
    // The restore path uses the difference to tell "nothing was saved"
    // from "something was saved and is unreadable".
    expect(hasRawValue(STORAGE_KEYS.newRoads)).toBe(false);
    localStorage.setItem(STORAGE_KEYS.newRoads, '{"v":{"$0$"');
    expect(readValue(STORAGE_KEYS.newRoads)).toBeUndefined();
    expect(hasRawValue(STORAGE_KEYS.newRoads)).toBe(true);
  });
});

describe("appStorage expiry", () => {
  it("hides a value once its ttl passes and drops it from storage", () => {
    vi.useFakeTimers();
    writeValue(STORAGE_KEYS.accessInfo, { access_token: "t" }, 1000);
    expect(readValue(STORAGE_KEYS.accessInfo)).toEqual({ access_token: "t" });

    vi.advanceTimersByTime(1001);
    expect(readValue(STORAGE_KEYS.accessInfo)).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEYS.accessInfo)).toBeNull();
  });

  it("keeps values written without a ttl", () => {
    vi.useFakeTimers();
    writeValue(STORAGE_KEYS.hasLoggedIn, "true");
    vi.advanceTimersByTime(ACCESS_INFO_TTL_MS * 10);
    expect(readValue(STORAGE_KEYS.hasLoggedIn)).toBe("true");
  });
});

describe("clearAppStorage", () => {
  it("clears app data but keeps consent, the migration marker, and unsynced roads", () => {
    writeValue(STORAGE_KEYS.accessInfo, { access_token: "t" });
    writeValue(STORAGE_KEYS.newRoads, { r: {} });
    writeValue(STORAGE_KEYS.consent, "true");
    writeValue(STORAGE_KEYS.migrated, true);

    clearAppStorage();

    expect(readValue(STORAGE_KEYS.accessInfo)).toBeUndefined();
    // A logout or version reset must not destroy roads a logged-out user
    // hasn't synced yet, since they're the student's own work.
    expect(readValue(STORAGE_KEYS.newRoads)).toEqual({ r: {} });
    // Clearing the marker would let the legacy cookie import run again,
    // re-reading a cookie this origin cannot delete.
    expect(readValue(STORAGE_KEYS.migrated)).toBe(true);
    expect(readValue(STORAGE_KEYS.consent)).toBe("true");
  });

  it("also wipes unsynced roads when alsoWipeUnsyncedRoads is set (opt-out)", () => {
    writeValue(STORAGE_KEYS.newRoads, { r: {} });

    clearAppStorage({ alsoWipeUnsyncedRoads: true });

    expect(readValue(STORAGE_KEYS.newRoads)).toBeUndefined();
  });

  it("leaves keys owned by other code on the origin alone", () => {
    localStorage.setItem("unrelated", "keep me");
    clearAppStorage();
    expect(localStorage.getItem("unrelated")).toBe("keep me");
  });
});

describe("appStorage when storage is unavailable", () => {
  it("returns undefined and does not throw when reads fail", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => readValue(STORAGE_KEYS.accessInfo)).not.toThrow();
    expect(readValue(STORAGE_KEYS.accessInfo)).toBeUndefined();
  });

  it("swallows write failures (quota, private mode)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => writeValue(STORAGE_KEYS.newRoads, { r: {} })).not.toThrow();
  });
});

describe("raw-string flags (legacy byte format)", () => {
  it("round-trips the bare true/false strings existing browsers hold", () => {
    writeRawFlag(STORAGE_KEYS.hideIAP, true);
    // The stored bytes are the frozen legacy format, not an Entry.
    expect(localStorage.getItem("hideIAP")).toBe("true");
    expect(readRawFlag(STORAGE_KEYS.hideIAP)).toBe(true);
    writeRawFlag(STORAGE_KEYS.hideIAP, false);
    expect(localStorage.getItem("hideIAP")).toBe("false");
    expect(readRawFlag(STORAGE_KEYS.hideIAP)).toBe(false);
  });

  it("reads a legacy value written by the old bare assignment", () => {
    localStorage.showFifthYear = "true";
    expect(readRawFlag(STORAGE_KEYS.showFifthYear)).toBe(true);
  });

  it("treats an absent flag as off", () => {
    expect(readRawFlag(STORAGE_KEYS.showFifthYear)).toBe(false);
  });

  it("never throws when storage access throws (boot-crash guard)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => readRawFlag(STORAGE_KEYS.hideIAP)).not.toThrow();
    expect(readRawFlag(STORAGE_KEYS.hideIAP)).toBe(false);
    expect(() => writeRawFlag(STORAGE_KEYS.hideIAP, true)).not.toThrow();
  });
});
