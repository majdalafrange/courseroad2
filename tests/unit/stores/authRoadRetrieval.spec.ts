import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Mock the FireRoad client singleton before the auth store imports it.
const mocks = vi.hoisted(() => ({
  getRoads: vi.fn(),
  syncRoad: vi.fn(),
  getRoad: vi.fn(),
  // retrieveRoad → waitAndMigrateOldSubjects lazily loads the catalog; keep
  // it pending so that fire-and-forget path doesn't reject on an unmocked
  // call.
  getFullCatalog: vi.fn(() => new Promise(() => {})),
}));

vi.mock("../../../src/stores/fireroadClient", () => ({
  setFireroadToken: vi.fn(),
  fireroad: {
    getRoads: mocks.getRoads,
    syncRoad: mocks.syncRoad,
    getRoad: mocks.getRoad,
    getFullCatalog: mocks.getFullCatalog,
  },
}));

import { useAuthStore } from "../../../src/stores/auth";
import { useCourseDataStore } from "../../../src/stores/courseData";

const cloudFile = (name: string) => ({
  name,
  changed: "2024-01-01T00:00:00",
  agent: "",
  contents: {
    coursesOfStudy: ["girs"],
    selectedSubjects: [] as unknown[],
    progressOverrides: {},
    progressAssertions: {},
  },
});

describe("auth.retrieveRoad", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.getRoads.mockReset();
    mocks.syncRoad.mockReset();
    mocks.getRoad.mockReset();
  });

  it("resets gettingUserData and leaves the road unretrieved on a network error", async () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    store.setUnretrieved(["100"]);
    mocks.getRoad.mockRejectedValue(new Error("Network Error"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await auth.retrieveRoad("100");

    expect(auth.gettingUserData).toBe(false);
    expect(store.unretrieved).toContain("100");
  });

  it("shares one fetch across concurrent calls for the same road", async () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    store.setUnretrieved(["100"]);
    mocks.getRoad.mockResolvedValue({
      status: 200,
      data: { success: true, file: cloudFile("Cloud road") },
    });

    const [a, b] = await Promise.all([
      auth.retrieveRoad("100"),
      auth.retrieveRoad("100"),
    ]);

    expect(mocks.getRoad).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(store.unretrieved).not.toContain("100");
  });

  it("a background retrieval does not toggle gettingUserData", async () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    store.setUnretrieved(["100"]);
    mocks.getRoad.mockResolvedValue({
      status: 200,
      data: { success: true, file: cloudFile("Cloud road") },
    });

    await auth.retrieveRoad("100", { background: true });

    expect(auth.gettingUserData).toBe(false);
    expect(store.unretrieved).not.toContain("100");
    expect("100" in store.roads).toBe(true);
  });
});

describe("auth.getUserData: background prefetch", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.getRoads.mockReset();
    mocks.syncRoad.mockReset();
    mocks.getRoad.mockReset();
    mocks.getRoads.mockResolvedValue({
      status: 200,
      data: {
        success: true,
        files: { "100": { name: "First" }, "200": { name: "Second" } },
      },
    });
    mocks.getRoad.mockImplementation((id: string) =>
      Promise.resolve({
        status: 200,
        data: {
          success: true,
          file: cloudFile(id === "100" ? "First" : "Second"),
        },
      }),
    );
  });

  it("warms every road, not just the one made active", async () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();

    await auth.getUserData();
    // The prefetch loop is fire-and-forget; let its microtasks settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(store.unretrieved).toEqual([]);
    expect(store.roads["200"].contents.selectedSubjects).toBeDefined();
  });
});
