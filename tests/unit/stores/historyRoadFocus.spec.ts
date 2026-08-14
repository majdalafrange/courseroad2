import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { DEFAULT_ROAD_ID } from "../../../src/lib/roads";
import { useAuthStore } from "../../../src/stores/auth";
import { useCourseDataStore } from "../../../src/stores/courseData";
import { history } from "../../../src/stores/history";
import { addRoad, createRoad } from "../../../src/stores/roadOps";
import { placed } from "../lib/fixtures";

/**
 * The history stack is global across roads. These pin the two halves of
 * its cross-road contract: an entry replaying on another road switches to
 * that road first (no invisible mutations), and the persisted road map is
 * derived from the roads that exist, so no undo/redo sequence can leave
 * it describing fewer roads than the switcher shows.
 */
describe("history across roads", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    history.clear();
    localStorage.clear();
  });

  it("undo of an edit on another road switches to that road before applying", () => {
    const store = useCourseDataStore();
    const roadB = addRoad("RoadB");
    expect(store.activeRoad).toBe(roadB);
    store.addClass(placed("8.01", 1));
    expect(store.roads[roadB].contents.selectedSubjects[1]).toHaveLength(1);

    // Switch back to the default road, then undo. The edit belongs to
    // RoadB, so the undo must land there in view, not off screen.
    store.setActiveRoad(DEFAULT_ROAD_ID);
    history.undo();
    expect(store.activeRoad).toBe(roadB);
    expect(store.roads[roadB].contents.selectedSubjects[1]).toHaveLength(0);

    // Redo from the other road behaves the same way.
    store.setActiveRoad(DEFAULT_ROAD_ID);
    history.redo();
    expect(store.activeRoad).toBe(roadB);
    expect(store.roads[roadB].contents.selectedSubjects[1]).toHaveLength(1);
  });

  it("focus resolves a temp key renamed by resetID to the live road", () => {
    const store = useCourseDataStore();
    const roadB = addRoad("RoadB");
    store.addClass(placed("8.01", 1));
    store.resetID({ oldid: roadB, newid: "9876" });
    store.setActiveRoad(DEFAULT_ROAD_ID);
    history.undo();
    expect(store.activeRoad).toBe("9876");
    expect(store.roads["9876"].contents.selectedSubjects[1]).toHaveLength(0);
  });

  it("a full undo/redo run never leaves the persisted map smaller than the switcher (defect 2)", () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();

    // Touch the default road so it qualifies for persistence, then build
    // two more roads with an edit between them.
    store.addClass(placed("6.006", 1));
    createRoad();
    store.addClass(placed("8.01", 1));
    createRoad();

    // The long mixed run from the defect report: everything back, then
    // everything forward, twice.
    for (let round = 0; round < 2; round++) {
      while (history.canUndo) {
        history.undo();
      }
      while (history.canRedo) {
        history.redo();
      }
    }

    const persisted = auth.getNewRoadData();
    const localRoads = Object.keys(store.roads).filter((id) =>
      id.includes("$"),
    );
    expect(localRoads.length).toBeGreaterThanOrEqual(3);
    for (const roadID of localRoads) {
      expect(persisted[roadID]).toBeDefined();
    }
  });

  it("a new road never reuses a live temp id after a delete", () => {
    const store = useCourseDataStore();
    const auth = useAuthStore();
    const a = addRoad("A");
    const b = addRoad("B");
    auth.deleteRoad(a);
    const c = addRoad("C");
    expect(c).not.toBe(b);
    expect(store.roads[b].name).toBe("B");
    expect(store.roads[c].name).toBe("C");
  });
});
