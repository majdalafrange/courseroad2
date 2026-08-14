import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { STORAGE_KEYS } from "../../../src/lib/appStorage";
import { newRoad } from "../../../src/lib/roads";
import { useAuthStore } from "../../../src/stores/auth";
import { useCourseDataStore } from "../../../src/stores/courseData";

/**
 * Logged-out deletion must reach localStorage (F2). deleteRoad spliced
 * the in-memory state and relied on "the server delete is a separate
 * call", which exists only when logged in. Logged out, the stored map
 * kept the road, so it came back on the next load unless some later
 * edit happened to rewrite the map.
 */
describe("auth.deleteRoad while logged out", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  function storedRoads(): Record<string, { name: string }> | undefined {
    const raw = localStorage.getItem(STORAGE_KEYS.newRoads);
    if (raw === null) {
      return undefined;
    }
    return JSON.parse(raw).v as Record<string, { name: string }>;
  }

  function seedTwoRoads(): ReturnType<typeof useAuthStore> {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    store.allowCookies();
    store.setRoad({ id: "$0$", road: newRoad("Keep"), ignoreSet: true });
    store.setRoad({ id: "$1$", road: newRoad("Drop"), ignoreSet: true });
    auth.newRoads = ["$0$", "$1$"];
    auth.saveLocal();
    expect(Object.keys(storedRoads() ?? {})).toEqual(["$0$", "$1$"]);
    return auth;
  }

  it("removes the deleted road from the stored map (F2)", () => {
    const auth = seedTwoRoads();

    auth.deleteRoad("$1$");

    const saved = storedRoads();
    expect(saved).toBeDefined();
    expect(saved?.["$1$"]).toBeUndefined();
    expect(saved?.["$0$"]?.name).toBe("Keep");
  });

  it("keeps the stored map untouched before consent", () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    store.setRoad({ id: "$0$", road: newRoad("Keep"), ignoreSet: true });
    store.setRoad({ id: "$1$", road: newRoad("Drop"), ignoreSet: true });
    auth.newRoads = ["$0$", "$1$"];

    auth.deleteRoad("$1$");

    expect(storedRoads()).toBeUndefined();
  });
});
