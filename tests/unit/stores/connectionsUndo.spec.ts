import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { toast } from "../../../src/design/toast";
import { useConnectionsStore } from "../../../src/stores/connections";
import { useCourseDataStore } from "../../../src/stores/courseData";
import { makeCatalog, makeSubject, placed } from "../lib/fixtures";

/**
 * Reset and re-seed both drop discovered work, so each owes the student a
 * way back. These cover the snapshot contract the toasts depend on: an
 * exact restore of what was replaced, and no undo offered for a no-op.
 */
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

/** A manual exploration seeded from 1.001. */
function seeded() {
  loadCatalog();
  const store = useConnectionsStore();
  store.seedFrom("1.001");
  return store;
}

/** The Undo the toast puts in front of the student. */
function undoFromToast(): void {
  const entry = toast.state.toasts.find((t) => t.action !== undefined);
  expect(entry, "the action should offer an undo toast").toBeDefined();
  entry?.action?.handler();
}

function undoOffered(): boolean {
  return toast.state.toasts.some((t) => t.action !== undefined);
}

function freshPinia(): void {
  setActivePinia(createPinia());
  for (const t of [...toast.state.toasts]) {
    toast.dismiss(t.id);
  }
}

describe("connections store: undoing a reset", () => {
  beforeEach(freshPinia);

  it("restores the exact graph the reset replaced", () => {
    const store = seeded();
    store.expand("1.001");
    store.expand("2.002");

    const before = [...store.graph.nodes.keys()].sort();
    const edgesBefore = [...store.graph.edges.keys()].sort();
    expect(before.length).toBeGreaterThan(1);

    store.reset();
    expect([...store.graph.nodes.keys()]).toEqual(["1.001"]);

    undoFromToast();
    expect([...store.graph.nodes.keys()].sort()).toEqual(before);
    expect([...store.graph.edges.keys()].sort()).toEqual(edgesBefore);
  });

  it("brings back node positions, not just the nodes", () => {
    const store = seeded();
    store.expand("1.001");
    store.dragNode("2.002", { x: 321, y: 654 });
    const moved = store.layout.positions.get("2.002");

    store.reset();
    expect(store.layout.positions.has("2.002")).toBe(false);

    undoFromToast();
    expect(store.layout.positions.get("2.002")).toEqual(moved);
  });

  it("keeps the restore point intact when the reset graph is edited after", () => {
    const store = seeded();
    store.expand("1.001");
    const before = [...store.graph.nodes.keys()].sort();

    store.reset();
    // the student keeps working before deciding to take the reset back
    store.expand("1.001");
    store.dragNode("1.001", { x: 10, y: 20 });

    undoFromToast();
    expect([...store.graph.nodes.keys()].sort()).toEqual(before);
  });

  it("offers no undo when the reset changed nothing", () => {
    const store = seeded();
    expect([...store.graph.nodes.keys()]).toEqual(["1.001"]);

    store.reset();
    expect(undoOffered()).toBe(false);
  });
});

describe("connections store: undoing a re-seed", () => {
  beforeEach(freshPinia);

  /** A road carrying 3.003, so re-seeding lands somewhere different. */
  function seededWithRoad() {
    const courseData = loadCatalog();
    courseData.addClass(placed("3.003", 1));
    const store = useConnectionsStore();
    store.seedFrom("1.001");
    return store;
  }

  it("restores the exploration the re-seed threw away", () => {
    const store = seededWithRoad();
    store.expand("1.001");
    const before = [...store.graph.nodes.keys()].sort();
    expect(before).toEqual(["1.001", "2.002"]);

    store.reseedFromRoad();
    expect([...store.graph.nodes.keys()]).toEqual(["3.003"]);

    undoFromToast();
    expect([...store.graph.nodes.keys()].sort()).toEqual(before);
  });

  it("restores the seed itself, not just the nodes", () => {
    const store = seededWithRoad();
    expect(store.seed.origin).toBe("manual");

    store.reseedFromRoad();
    expect(store.seed.origin).toBe("road");

    undoFromToast();
    expect(store.seed.origin).toBe("manual");
    expect(store.seed.subjectIds).toEqual(["1.001"]);
  });

  it("offers no undo when there was nothing on the canvas", () => {
    loadCatalog();
    const courseData = useCourseDataStore();
    courseData.addClass(placed("3.003", 1));
    const store = useConnectionsStore();

    store.reseedFromRoad();
    expect(undoOffered()).toBe(false);
  });
});
