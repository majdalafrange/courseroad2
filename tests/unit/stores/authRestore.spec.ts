import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { toast } from "../../../src/design/toast";
import { STORAGE_KEYS } from "../../../src/lib/appStorage";
import { newRoad } from "../../../src/lib/roads";
import { useAuthStore } from "../../../src/stores/auth";
import { useCourseDataStore } from "../../../src/stores/courseData";

/**
 * restoreFromStorage against damaged storage. Recovering to a fresh road
 * is the right behavior; doing it without a word was the defect (N8).
 */
describe("auth.restoreFromStorage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    while (toast.state.toasts.length > 0) {
      toast.dismiss(toast.state.toasts[0].id);
    }
  });

  function entry(v: unknown): string {
    return JSON.stringify({ v, e: 0 });
  }

  it("restores a valid stored road map without comment", () => {
    const store = useCourseDataStore();
    localStorage.setItem(
      STORAGE_KEYS.newRoads,
      entry({ $0$: newRoad("Saved") }),
    );
    useAuthStore().restoreFromStorage();
    expect(store.roads["$0$"].name).toBe("Saved");
    expect(store.activeRoad).toBe("$0$");
    expect(toast.state.toasts).toHaveLength(0);
  });

  it("says so when the stored roads are unreadable (N8)", () => {
    localStorage.setItem(STORAGE_KEYS.newRoads, '{"v":{"$0$"');
    useAuthStore().restoreFromStorage();
    const messages = toast.state.toasts.map((t) => t.message);
    expect(messages).toContain("Saved roads couldn't be read");
  });

  it("says so when some stored roads are dropped by sanitization (N8)", () => {
    const store = useCourseDataStore();
    localStorage.setItem(
      STORAGE_KEYS.newRoads,
      entry({ $0$: newRoad("Saved"), $1$: "not a road" }),
    );
    useAuthStore().restoreFromStorage();
    expect(store.roads["$0$"].name).toBe("Saved");
    const messages = toast.state.toasts.map((t) => t.message);
    expect(messages).toContain("A saved road couldn't be read");
  });
});
