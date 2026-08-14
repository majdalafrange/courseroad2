import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Mock the FireRoad client singleton before the auth store imports it.
const mocks = vi.hoisted(() => ({
  getRoads: vi.fn(),
  syncRoad: vi.fn(),
  getRoad: vi.fn(),
  verify: vi.fn(),
  // retrieveRoad → waitAndMigrateOldSubjects lazily loads the catalog; keep it
  // pending so that fire-and-forget path doesn't reject on an unmocked call.
  getFullCatalog: vi.fn(() => new Promise(() => {})),
}));

vi.mock("../../../src/stores/fireroadClient", () => ({
  setFireroadToken: vi.fn(),
  fireroad: {
    getRoads: mocks.getRoads,
    syncRoad: mocks.syncRoad,
    getRoad: mocks.getRoad,
    verify: mocks.verify,
    getFullCatalog: mocks.getFullCatalog,
  },
}));

import { useAuthStore } from "../../../src/stores/auth";
import { useCourseDataStore } from "../../../src/stores/courseData";
import { placed } from "../lib/fixtures";

const cloudFile = () => ({
  name: "Cloud road",
  changed: "2024-01-01T00:00:00",
  agent: "",
  contents: {
    coursesOfStudy: ["girs"],
    selectedSubjects: [] as unknown[],
    progressOverrides: {},
    progressAssertions: {},
  },
});

describe("auth.getUserData: $defaultroad$ deletion (C2 / R3)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.getRoads.mockReset();
    mocks.syncRoad.mockReset();
    mocks.getRoad.mockReset();
    mocks.getRoads.mockResolvedValue({
      status: 200,
      data: { success: true, files: { "100": { name: "Cloud road" } } },
    });
    // A save that is still in flight (never resolves during the test); the
    // exact condition under which the old unconditional delete crashed.
    mocks.syncRoad.mockReturnValue(new Promise(() => {}));
    mocks.getRoad.mockResolvedValue({
      status: 200,
      data: { success: true, file: cloudFile() },
    });
  });

  it("does NOT delete a $defaultroad$ carrying pre-login work (no data loss)", async () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    store.addClass(placed("6.006", 1)); // real pre-login work
    auth.newRoads = ["$defaultroad$"]; // pending cloud migration
    await auth.getUserData();
    expect("$defaultroad$" in store.roads).toBe(true);
    expect(
      store.roads["$defaultroad$"].contents.selectedSubjects[1],
    ).toHaveLength(1);
  });

  it("deletes a pristine $defaultroad$ once cloud roads load", async () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    await auth.getUserData();
    expect("$defaultroad$" in store.roads).toBe(false);
    expect("100" in store.roads).toBe(true);
  });
});
