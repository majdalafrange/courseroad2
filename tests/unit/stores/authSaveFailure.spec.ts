import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  syncRoad: vi.fn(),
}));

vi.mock("../../../src/stores/fireroadClient", () => ({
  setFireroadToken: vi.fn(),
  fireroad: {
    syncRoad: mocks.syncRoad,
  },
}));

import { toast } from "../../../src/design/toast";
import { useAuthStore } from "../../../src/stores/auth";
import { useCourseDataStore } from "../../../src/stores/courseData";

function seedRoad() {
  const store = useCourseDataStore();
  store.roads = {
    "42": {
      downloaded: "2026-08-01T00:00:00.000Z",
      changed: "2026-08-01T00:00:00.000Z",
      name: "Course 6",
      agent: "",
      contents: {
        coursesOfStudy: [],
        selectedSubjects: Array.from({ length: 16 }, () => []),
        progressOverrides: {},
      },
    },
  } as unknown as typeof store.roads;
}

/** Let saveRemote's promise chain settle. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("auth: a failed remote save is never silent", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.syncRoad.mockReset();
    while (toast.state.toasts.length > 0) {
      toast.dismiss(toast.state.toasts[0].id);
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    seedRoad();
  });

  it("records a warning and toasts when FireRoad can't be reached", async () => {
    const auth = useAuthStore();
    mocks.syncRoad.mockRejectedValue(new Error("Network Error"));

    auth.saveRemote("42");
    await settle();

    expect(auth.currentlySaving).toBe(false);
    expect(auth.saveWarnings).toHaveLength(1);
    expect(auth.saveWarnings[0].name).toBe("Course 6");
    expect(toast.state.toasts.map((t) => t.message)).toEqual([
      "Couldn't save to FireRoad",
    ]);
  });

  it("toasts the server's reason when FireRoad refuses the save", async () => {
    const auth = useAuthStore();
    mocks.syncRoad.mockResolvedValue({
      status: 200,
      data: { success: false, error_msg: "Road too large" },
    });

    auth.saveRemote("42");
    await settle();

    expect(auth.saveWarnings.map((w) => w.error)).toEqual(["Road too large"]);
    expect(toast.state.toasts[0].detail).toBe("Course 6: Road too large");
  });

  it("shows one toast for a run of failed saves", async () => {
    const auth = useAuthStore();
    mocks.syncRoad.mockRejectedValue(new Error("Network Error"));

    auth.saveRemote("42");
    await settle();
    auth.saveRemote("42");
    await settle();

    expect(toast.state.toasts).toHaveLength(1);
  });
});
