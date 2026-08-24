import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// Mock the FireRoad client singleton before the audit store imports it.
const mocks = vi.hoisted(() => ({
  getProgress: vi.fn(),
}));

vi.mock("../../../src/stores/fireroadClient", () => ({
  setFireroadToken: vi.fn(),
  fireroad: {
    getProgress: mocks.getProgress,
  },
}));

import { newRoad } from "../../../src/lib/roads";
import { useAuditStore } from "../../../src/stores/audit";
import { useCourseDataStore } from "../../../src/stores/courseData";

/**
 * updateFulfillment before hydration and after failure. The first case is
 * the page-load defect: the boot-time recompute ran against a store whose
 * roads had not been restored yet, scored the empty default road, and
 * nothing ever retried.
 */
describe("audit fulfillment", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.getProgress.mockReset();
  });

  it("holds a recompute that arrives before the roads are hydrated and replays it on flush", () => {
    const store = useCourseDataStore();
    const audit = useAuditStore();

    // Pre-hydration: the active road id names a road the store does not
    // hold yet (the restore has not run).
    store.activeRoad = "$0$";
    audit.updateFulfillment("all");
    expect(mocks.getProgress).not.toHaveBeenCalled();
    expect(audit.pendingFulfillment).toBe("all");

    // Hydration arrives; the flush issues one request per program.
    mocks.getProgress.mockResolvedValue({ data: { fulfilled: false } });
    store.roads = { $0$: newRoad("Mine", ["girs", "major6-3"]) };
    audit.flushPendingFulfillment();
    const requested = mocks.getProgress.mock.calls.map((call) => call[0]);
    expect(requested).toEqual(["girs", "major6-3"]);
    expect(audit.pendingFulfillment).toBeNull();
  });

  it("issues a progress request for every program on the active road", () => {
    const store = useCourseDataStore();
    const audit = useAuditStore();
    mocks.getProgress.mockResolvedValue({ data: { fulfilled: false } });
    store.roads = {
      $0$: newRoad("Mine", ["girs", "major6-3", "minor18"]),
    };
    store.activeRoad = "$0$";
    audit.updateFulfillment("all");
    const requested = mocks.getProgress.mock.calls.map((call) => call[0]);
    expect(requested).toEqual(["girs", "major6-3", "minor18"]);
  });

  it("sends the hydrated road's contents, not an empty road", () => {
    const store = useCourseDataStore();
    const audit = useAuditStore();
    mocks.getProgress.mockResolvedValue({ data: { fulfilled: false } });
    const road = newRoad("Mine", ["girs"]);
    road.contents.selectedSubjects[1].push({
      subject_id: "8.01",
      title: "8.01",
      semester: 1,
      units: 12,
      overrideWarnings: false,
    });
    store.roads = { $0$: road };
    store.activeRoad = "$0$";
    audit.updateFulfillment("all");
    const sentContents = mocks.getProgress.mock.calls[0][1];
    expect(
      sentContents.selectedSubjects.map(
        (s: { subject_id: string }) => s.subject_id,
      ),
    ).toEqual(["8.01"]);
  });

  it("a failed progress request lands in failedPrograms and a retry clears it (N9)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = useCourseDataStore();
    const audit = useAuditStore();
    store.roads = { $0$: newRoad("Mine", ["girs", "major18"]) };
    store.activeRoad = "$0$";

    mocks.getProgress.mockImplementation((key: string) =>
      key === "major18"
        ? Promise.reject(new Error("404"))
        : Promise.resolve({ data: { fulfilled: false } }),
    );
    audit.updateFulfillment("all");
    await vi.waitFor(() => {
      expect(audit.failedPrograms["major18"]).toBe(true);
    });
    // The sibling that resolved is not marked.
    expect(audit.failedPrograms["girs"]).toBeUndefined();
    expect(audit.reqTrees["girs"]).toBeDefined();

    // Retry succeeds and the failure state clears.
    mocks.getProgress.mockResolvedValue({ data: { fulfilled: false } });
    audit.updateFulfillment("major18");
    await vi.waitFor(() => {
      expect(audit.failedPrograms["major18"]).toBeUndefined();
      expect(audit.reqTrees["major18"]).toBeDefined();
    });
  });

  it("does not let a stale out-of-order response overwrite a fresher one", async () => {
    const store = useCourseDataStore();
    const audit = useAuditStore();
    store.roads = { $0$: newRoad("Mine", ["girs"]) };
    store.activeRoad = "$0$";

    let resolveFirst: (value: { data: unknown }) => void = () => {};
    let resolveSecond: (value: { data: unknown }) => void = () => {};
    const first = new Promise<{ data: unknown }>((resolve) => {
      resolveFirst = resolve;
    });
    const second = new Promise<{ data: unknown }>((resolve) => {
      resolveSecond = resolve;
    });
    mocks.getProgress
      .mockImplementationOnce(() => first)
      .mockImplementationOnce(() => second);

    // Two rapid edits, each its own recompute batch (updatingFulfillment
    // only blocks re-entrancy within the same microtask).
    audit.updateFulfillment("all");
    await Promise.resolve();
    audit.updateFulfillment("all");

    // The network reorders: the fresher, second request resolves first...
    resolveSecond({ data: { fulfilled: true, tag: "fresh" } });
    await vi.waitFor(() => {
      expect(audit.reqTrees["girs"]).toEqual({ fulfilled: true, tag: "fresh" });
    });

    // ...then the stale first response arrives late and must not clobber it.
    resolveFirst({ data: { fulfilled: false, tag: "stale" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(audit.reqTrees["girs"]).toEqual({ fulfilled: true, tag: "fresh" });
  });
});
