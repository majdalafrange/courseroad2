import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Mock the FireRoad client singleton before the favorites store imports it.
const mocks = vi.hoisted(() => ({
  getFavorites: vi.fn(),
  setFavorites: vi.fn(),
}));

vi.mock("../../../src/stores/fireroadClient", () => ({
  setFireroadToken: vi.fn(),
  fireroad: {
    getFavorites: mocks.getFavorites,
    setFavorites: mocks.setFavorites,
  },
}));

import {
  STORAGE_KEYS,
  readValue,
  writeValue,
} from "../../../src/lib/appStorage";
import { useCourseDataStore } from "../../../src/stores/courseData";
import { useFavoritesStore } from "../../../src/stores/favorites";

/**
 * Favorite subjects: FireRoad's /prefs/favorites/ when logged in
 * (set_favorites replaces the whole list), this browser when logged out,
 * merged on login.
 */

function cloudReturns(favorites: string[]) {
  mocks.getFavorites.mockResolvedValue({
    status: 200,
    data: { success: true, favorites },
  });
}

function lastSavedList(): string[] {
  const calls = mocks.setFavorites.mock.calls;
  return calls[calls.length - 1][0] as string[];
}

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  mocks.getFavorites.mockReset();
  mocks.setFavorites.mockReset();
  mocks.setFavorites.mockResolvedValue({
    status: 200,
    data: { success: true },
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("logged out", () => {
  it("keeps favorites in this browser, in the order added, with consent", () => {
    useCourseDataStore().allowCookies();
    const favorites = useFavoritesStore();

    favorites.toggleFavorite("6.1210");
    favorites.toggleFavorite("18.06");
    favorites.setFavorite("6.1210", true); // already one: no change

    expect(favorites.ids).toEqual(["6.1210", "18.06"]);
    expect(readValue(STORAGE_KEYS.favorites)).toEqual(["6.1210", "18.06"]);
    expect(mocks.setFavorites).not.toHaveBeenCalled();

    favorites.toggleFavorite("6.1210");
    expect(favorites.ids).toEqual(["18.06"]);
    expect(favorites.isFavorite("6.1210")).toBe(false);
  });

  it("writes nothing to storage without consent", () => {
    useCourseDataStore().disallowCookies();
    useFavoritesStore().toggleFavorite("6.1210");

    expect(readValue(STORAGE_KEYS.favorites)).toBeUndefined();
  });

  it("reads back what an earlier visit saved, ignoring junk", () => {
    writeValue(STORAGE_KEYS.favorites, ["8.01", 42, null, "18.01"]);
    expect(useFavoritesStore().ids).toEqual(["8.01", "18.01"]);
  });
});

describe("logged in", () => {
  beforeEach(() => {
    const store = useCourseDataStore();
    store.allowCookies();
    store.setLoggedIn(true);
  });

  it("loads the cloud list and saves the whole list, debounced", async () => {
    cloudReturns(["18.01"]);
    const favorites = useFavoritesStore();
    await favorites.loadFromCloud();
    expect(favorites.ids).toEqual(["18.01"]);
    // Nothing of ours to add: no save on load.
    expect(mocks.setFavorites).not.toHaveBeenCalled();

    favorites.toggleFavorite("6.1210");
    favorites.toggleFavorite("8.01");
    expect(mocks.setFavorites).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();

    expect(mocks.setFavorites).toHaveBeenCalledTimes(1);
    expect(lastSavedList()).toEqual(["18.01", "6.1210", "8.01"]);
  });

  it("merges logged-out favorites in after the cloud's, once each", async () => {
    writeValue(STORAGE_KEYS.favorites, ["6.1210", "18.01"]);
    cloudReturns(["18.01", "8.01"]);
    const favorites = useFavoritesStore();

    await favorites.loadFromCloud();

    expect(favorites.ids).toEqual(["18.01", "8.01", "6.1210"]);
    expect(lastSavedList()).toEqual(favorites.ids);
    // Handed over: the browser copy is gone.
    expect(readValue(STORAGE_KEYS.favorites)).toBeUndefined();
  });

  it("never saves before the cloud list is in; an early toggle wins", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getFavorites.mockReturnValue(new Promise((r) => (resolve = r)));
    const favorites = useFavoritesStore();
    const load = favorites.loadFromCloud();

    favorites.toggleFavorite("6.1210"); // add, while loading
    // A save now would replace the cloud list with this one subject.
    await vi.runAllTimersAsync();
    expect(mocks.setFavorites).not.toHaveBeenCalled();

    resolve({
      status: 200,
      data: { success: true, favorites: ["8.01", "6.1210"] },
    });
    await load;

    // Re-added last, as it was the latest toggle.
    expect(favorites.ids).toEqual(["8.01", "6.1210"]);
  });

  it("an early removal wins over the cloud copy", async () => {
    let resolve!: (value: unknown) => void;
    mocks.getFavorites.mockReturnValue(new Promise((r) => (resolve = r)));
    const favorites = useFavoritesStore();
    favorites.ids = ["8.01"]; // what this tab showed before the load
    const load = favorites.loadFromCloud();

    favorites.toggleFavorite("8.01"); // remove, while loading

    resolve({ status: 200, data: { success: true, favorites: ["8.01"] } });
    await load;

    expect(favorites.ids).toEqual([]);
    expect(lastSavedList()).toEqual([]);
  });

  it("after a failed load, holds toggles and retries the load, not a save", async () => {
    mocks.getFavorites.mockRejectedValueOnce(new Error("offline"));
    const favorites = useFavoritesStore();
    await favorites.loadFromCloud();
    expect(favorites.cloudLoaded).toBe(false);

    cloudReturns(["8.01"]);
    favorites.toggleFavorite("6.1210");
    await vi.runAllTimersAsync();

    expect(mocks.getFavorites).toHaveBeenCalledTimes(2);
    expect(lastSavedList()).toEqual(["8.01", "6.1210"]);
  });

  it("tells the student when a save fails, and keeps the list", async () => {
    cloudReturns([]);
    mocks.setFavorites.mockRejectedValue(new Error("500"));
    const favorites = useFavoritesStore();
    await favorites.loadFromCloud();

    favorites.toggleFavorite("6.1210");
    await vi.runAllTimersAsync();

    expect(favorites.ids).toEqual(["6.1210"]);
  });
});
