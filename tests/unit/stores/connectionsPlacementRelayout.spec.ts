import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { toast } from "../../../src/design/toast";
import { useConnectionsStore } from "../../../src/stores/connections";
import { useCourseDataStore } from "../../../src/stores/courseData";
import { makeCatalog, makeSubject, placed } from "../lib/fixtures";

/** 1.001 ↔ 2.002 ↔ 3.003, so expanding grows the graph past its seed. */
function loadCatalog() {
  const courseData = useCourseDataStore();
  const catalog = makeCatalog([
    makeSubject({ subject_id: "1.001" }),
    makeSubject({ subject_id: "2.002", prerequisites: "1.001" }),
    makeSubject({ subject_id: "3.003", prerequisites: "2.002" }),
  ]);
  courseData.subjectsInfo = catalog.subjectsInfo;
  courseData.subjectsIndex = catalog.subjectsIndex;
  return courseData;
}

function freshPinia(): void {
  setActivePinia(createPinia());
  for (const t of [...toast.state.toasts]) {
    toast.dismiss(t.id);
  }
}

describe("connections store: placing a node onto the road relayouts it", () => {
  beforeEach(freshPinia);

  it("moves a placed node out of Unscheduled and into its new term's row", () => {
    const courseData = loadCatalog();
    courseData.addClass(placed("3.003", 0)); // anchors the road at term 0
    const store = useConnectionsStore();
    store.reseedFromRoad(); // graph anchor: 3.003, at its real road bucket
    store.expand("3.003"); // reveals 2.002 (missing 1.001 → Unscheduled)
    store.expand("2.002"); // reveals 1.001 (ready, off-road → Unscheduled)

    // 1.001 and 2.002 share the Unscheduled row; 3.003 sits in its own,
    // separate (real-term) row
    expect(store.layout.positions.get("1.001")?.y).toEqual(
      store.layout.positions.get("2.002")?.y,
    );
    expect(store.layout.positions.get("1.001")?.y).not.toEqual(
      store.layout.positions.get("3.003")?.y,
    );

    store.requestPlacement("1.001");
    store.confirmPlacement(0); // the same term 3.003 already occupies

    // now on the road: shares 3.003's row, not 2.002's Unscheduled one
    expect(store.layout.positions.get("1.001")?.y).toEqual(
      store.layout.positions.get("3.003")?.y,
    );
    expect(store.layout.positions.get("1.001")?.y).not.toEqual(
      store.layout.positions.get("2.002")?.y,
    );
    // 2.002 was never involved in the placement and never moved
    const row2002Before = store.rows.find(
      (r) => r.y === store.layout.positions.get("2.002")?.y,
    );
    expect(row2002Before?.label).toBe("Unscheduled");
  });
});
