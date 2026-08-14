import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { STORAGE_KEYS } from "../../../src/lib/appStorage";
import { newRoad } from "../../../src/lib/roads";
import { useAuthStore } from "../../../src/stores/auth";
import { useCourseDataStore } from "../../../src/stores/courseData";

/**
 * The unload flush (F8). Saves debounce for 600ms and the timer dies
 * with the page, so a logged-out edit made just before closing the tab
 * was lost. Local saves are synchronous writes; at unload they run
 * immediately.
 */
describe("auth.flushPendingSaves", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function storedNames(): string[] {
    const raw = localStorage.getItem(STORAGE_KEYS.newRoads);
    if (raw === null) {
      return [];
    }
    return Object.keys(JSON.parse(raw).v as Record<string, unknown>);
  }

  it("writes a pending logged-out save immediately (F8)", () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    store.allowCookies();
    store.setRoad({ id: "$0$", road: newRoad("Late edit"), ignoreSet: true });
    auth.newRoads = ["$0$"];

    auth.queueSave("$0$");
    expect(storedNames()).toEqual([]);

    auth.flushPendingSaves();

    expect(storedNames()).toEqual(["$0$"]);
    expect(Object.keys(auth.pendingSaves)).toEqual([]);
    // The cancelled timer must not fire a second save.
    vi.runAllTimers();
    expect(auth.currentlySaving).toBe(false);
  });

  it("does nothing without a pending save", () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    store.allowCookies();
    store.setRoad({ id: "$0$", road: newRoad("Idle"), ignoreSet: true });
    auth.newRoads = ["$0$"];

    auth.flushPendingSaves();

    expect(storedNames()).toEqual([]);
  });

  it("leaves logged-in pending saves to their debounce", () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    store.allowCookies();
    auth.setLoggedIn(true);
    store.setRoad({ id: "$0$", road: newRoad("Cloud"), ignoreSet: true });

    auth.queueSave("$0$");
    auth.flushPendingSaves();

    expect(storedNames()).toEqual([]);
    expect(Object.keys(auth.pendingSaves)).toEqual(["$0$"]);
  });
});
