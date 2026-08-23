import { describe, expect, it } from "vitest";
import { EdgeEngine } from "../../../../src/lib/connections/edges";
import { expandNode, seedGraph } from "../../../../src/lib/connections/graph";
import {
  COL_WIDTH,
  ROW_HEIGHT,
  UNSCHEDULED_ROW,
  computeBounds,
  emptyLayout,
  fitViewport,
  gridRows,
  reconcileLayout,
  setNodePosition,
  tidyLayout,
  type Point,
} from "../../../../src/lib/connections/layout";
import { makeCatalog, makeSubject } from "../fixtures";

function chainCatalog() {
  return makeCatalog([
    makeSubject({ subject_id: "1.001" }),
    makeSubject({ subject_id: "2.002", prerequisites: "1.001" }),
    makeSubject({ subject_id: "3.003", prerequisites: "2.002" }),
  ]);
}

const engine = new EdgeEngine(chainCatalog());

/** column/row a position resolves to, inverting the grid pitch. */
function cell(p: Point): { col: number; row: number } {
  return {
    col: Math.round(p.x / COL_WIDTH),
    row: Math.round(p.y / ROW_HEIGHT),
  };
}

describe("gridRows", () => {
  it("compacts: only buckets a current node actually uses get a row, in bucket order", () => {
    const g = seedGraph(engine, ["1.001"]);
    const termOf = new Map([["1.001", 5]]);
    // 5 is the only bucket in play, so it compacts to row 0 no matter its
    // raw value: an empty semester (0-4) never reserves a gap above it.
    expect(gridRows(g, termOf)).toEqual([{ bucket: 5, row: 0 }]);
  });

  it("orders rows by bucket ascending regardless of discovery order", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    const termOf = new Map([
      ["1.001", 6],
      ["2.002", 1],
    ]);
    expect(gridRows(g, termOf)).toEqual([
      { bucket: 1, row: 0 },
      { bucket: 6, row: 1 },
    ]);
  });

  it("puts Unscheduled last even though its sentinel value is largest by construction", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    const termOf = new Map([["1.001", 3]]); // 2.002 has no entry: Unscheduled
    expect(gridRows(g, termOf)).toEqual([
      { bucket: 3, row: 0 },
      { bucket: UNSCHEDULED_ROW, row: 1 },
    ]);
  });
});

describe("reconcileLayout", () => {
  it("places a lone anchor at row 0 regardless of its raw bucket number", () => {
    const g = seedGraph(engine, ["1.001"]);
    const termOf = new Map([["1.001", 3]]);
    const layout = reconcileLayout(emptyLayout(), g, termOf);
    // bucket 3 is the only populated bucket, so it compacts to row 0
    expect(layout.positions.get("1.001")).toEqual({ x: 0, y: 0 });
  });

  it("sends a node with no known term to the Unscheduled row", () => {
    const g = seedGraph(engine, ["1.001"]);
    const layout = reconcileLayout(emptyLayout(), g, new Map());
    // the only node present, so its (Unscheduled) row still compacts to 0
    expect(layout.positions.get("1.001")).toEqual({ x: 0, y: 0 });
  });

  it("is deterministic: same graph and termOf yield identical positions", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    const termOf = new Map([
      ["1.001", 1],
      ["2.002", 2],
    ]);
    const a = reconcileLayout(emptyLayout(), g, termOf);
    const b = reconcileLayout(emptyLayout(), g, termOf);
    expect([...a.positions.entries()]).toEqual([...b.positions.entries()]);
  });

  it("places a node by its own term's compacted row, not by its revealer's row", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001"); // reveals 2.002
    const termOf = new Map([
      ["1.001", 0],
      ["2.002", 5],
    ]);
    const layout = reconcileLayout(emptyLayout(), g, termOf);
    // two populated buckets (0, 5): they compact to adjacent rows 0 and 1,
    // not 0 and 5: no gap for the four empty semesters between them
    expect(cell(layout.positions.get("1.001")!).row).toBe(0);
    expect(cell(layout.positions.get("2.002")!).row).toBe(1);
  });

  it("does not reserve a gap for an empty semester between two populated ones", () => {
    const cat = makeCatalog([
      makeSubject({ subject_id: "1.001" }),
      makeSubject({ subject_id: "1.002" }),
    ]);
    const e = new EdgeEngine(cat);
    const g = seedGraph(e, ["1.001", "1.002"]);
    // buckets 0 and 4: three empty semesters (1, 2, 3) between them
    const termOf = new Map([
      ["1.001", 0],
      ["1.002", 4],
    ]);
    const layout = reconcileLayout(emptyLayout(), g, termOf);
    const rows = [
      cell(layout.positions.get("1.001")!).row,
      cell(layout.positions.get("1.002")!).row,
    ].sort((a, b) => a - b);
    expect(rows).toEqual([0, 1]);
  });

  it("keeps a node's column stable across a pass where its row doesn't change", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001"); // reveals 2.002
    const termOf = new Map([
      ["1.001", 0],
      ["2.002", 1],
      ["3.003", 2],
    ]);
    const before = reconcileLayout(emptyLayout(), g, termOf);
    g = expandNode(g, engine, "2.002"); // reveals 3.003
    const after = reconcileLayout(before, g, termOf);
    expect(after.positions.get("1.001")).toEqual(before.positions.get("1.001"));
    expect(after.positions.get("2.002")).toEqual(before.positions.get("2.002"));
    expect(after.positions.has("3.003")).toBe(true);
  });

  it("relocates a node whose term changed between passes (e.g. placed onto the road)", () => {
    const cat = makeCatalog([
      makeSubject({ subject_id: "1.001" }),
      makeSubject({ subject_id: "1.002" }),
    ]);
    const e = new EdgeEngine(cat);
    const g = seedGraph(e, ["1.001", "1.002"]);
    const before = reconcileLayout(emptyLayout(), g, new Map([["1.002", 0]]));
    // 1.001 unscheduled: sorts after 1.002 (bucket 0 < Unscheduled)
    expect(cell(before.positions.get("1.001")!).row).toBe(1);
    expect(cell(before.positions.get("1.002")!).row).toBe(0);

    // 1.001 now placed in term 0 too, so it must move up alongside 1.002,
    // not stay stuck at its old (now-stale) row
    const after = reconcileLayout(
      before,
      g,
      new Map([
        ["1.002", 0],
        ["1.001", 0],
      ]),
    );
    expect(cell(after.positions.get("1.001")!).row).toBe(0);
    expect(cell(after.positions.get("1.002")!).row).toBe(0);
  });

  it("packs a row's nodes contiguously, department-sorted left to right", () => {
    // two departments interleaved by plain id order; dept-sorted placement
    // must keep each department's nodes contiguous within the row.
    const cat = makeCatalog([
      makeSubject({ subject_id: "18.100" }),
      makeSubject({ subject_id: "6.100" }),
      makeSubject({ subject_id: "18.200" }),
      makeSubject({ subject_id: "6.200" }),
    ]);
    const e = new EdgeEngine(cat);
    const g = seedGraph(e, ["18.100", "6.100", "18.200", "6.200"]);
    const termOf = new Map([
      ["18.100", 4],
      ["6.100", 4],
      ["18.200", 4],
      ["6.200", 4],
    ]);
    const layout = reconcileLayout(emptyLayout(), g, termOf);
    const byColumn = [...layout.positions.entries()]
      .sort(([, p], [, q]) => p.x - q.x)
      .map(([id]) => id);
    // department is a string sort ("18" < "6" lexicographically), matching
    // compareIds/departmentOf everywhere else this ordering is used
    expect(byColumn).toEqual(["18.100", "18.200", "6.100", "6.200"]);
    // contiguous, zero-based columns, all in the same (compacted) row
    const cols = byColumn.map((id) => cell(layout.positions.get(id)!).col);
    expect(cols).toEqual([0, 1, 2, 3]);
    for (const id of byColumn) {
      expect(cell(layout.positions.get(id)!).row).toBe(0);
    }
  });

  it("packs many nodes into one row without overlap, extending columns as needed", () => {
    const ids: string[] = [];
    for (let i = 0; i < 40; i++) {
      ids.push(`${(i % 4) + 5}.${String(100 + i)}`);
    }
    const cat = makeCatalog(ids.map((id) => makeSubject({ subject_id: id })));
    const e = new EdgeEngine(cat);
    const g = seedGraph(e, ids);
    const termOf = new Map(ids.map((id) => [id, 7]));
    const layout = reconcileLayout(emptyLayout(), g, termOf);
    const points = [...layout.positions.values()];
    expect(points).toHaveLength(40);
    for (const p of points) {
      expect(cell(p).row).toBe(0); // sole populated bucket compacts to row 0
    }
    const cols = new Set(points.map((p) => cell(p).col));
    expect(cols.size).toBe(40); // every node got its own column, no overlap
  });

  it("a later single addition takes the nearest free column to its sorted rank", () => {
    const cat = makeCatalog([
      makeSubject({ subject_id: "6.100" }),
      makeSubject({ subject_id: "6.300" }),
      makeSubject({ subject_id: "6.200" }),
    ]);
    const e = new EdgeEngine(cat);
    const g = seedGraph(e, ["6.100", "6.300"]);
    const termOf = new Map([
      ["6.100", 2],
      ["6.300", 2],
      ["6.200", 2],
    ]);
    const before = reconcileLayout(emptyLayout(), g, termOf);
    // 6.100 and 6.300 sort into columns 0 and 1; 6.200 sorts between them
    expect(cell(before.positions.get("6.100")!).col).toBe(0);
    expect(cell(before.positions.get("6.300")!).col).toBe(1);

    // 6.200 discovered afterward, without disturbing the other two
    const graphWith200 = seedGraph(e, ["6.100", "6.300", "6.200"]);
    const after = reconcileLayout(before, graphWith200, termOf);
    // existing nodes never move
    expect(after.positions.get("6.100")).toEqual(before.positions.get("6.100"));
    expect(after.positions.get("6.300")).toEqual(before.positions.get("6.300"));
    // 6.200's ideal column (1, between 6.100 and 6.300) is taken, so it
    // searches outward and lands in the nearest free column instead
    const col200 = cell(after.positions.get("6.200")!).col;
    expect(col200).not.toBe(0);
    expect(col200).not.toBe(1);
  });

  it("a discovered node never lands on top of a dragged node in the same row", () => {
    const cat = makeCatalog([
      makeSubject({ subject_id: "6.100" }),
      makeSubject({ subject_id: "6.200" }),
    ]);
    const e = new EdgeEngine(cat);
    const g = seedGraph(e, ["6.100"]);
    const termOf = new Map([
      ["6.100", 0],
      ["6.200", 0],
    ]);
    let layout = reconcileLayout(emptyLayout(), g, termOf);
    // drag 6.100 to an off-grid point (not exactly on a grid line) that
    // still reads as "row 0, column 0"; an exact-equality occupancy check
    // would miss this entirely and let a new node land right on it
    layout = setNodePosition(layout, "6.100", { x: 6, y: 3 });
    const g2 = seedGraph(e, ["6.100", "6.200"]);
    const after = reconcileLayout(layout, g2, termOf);
    expect(after.positions.get("6.100")).toEqual({ x: 6, y: 3 }); // untouched
    const p200 = after.positions.get("6.200")!;
    // must land in a different column than the dragged card occupies
    expect(cell(p200).col).not.toBe(0);
  });

  it("drops positions for nodes no longer in the graph", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    const termOf = new Map([
      ["1.001", 0],
      ["2.002", 1],
    ]);
    const full = reconcileLayout(emptyLayout(), g, termOf);
    const reseed = seedGraph(engine, ["1.001"]);
    const after = reconcileLayout(full, reseed, termOf);
    expect(after.positions.has("2.002")).toBe(false);
  });
});

describe("setNodePosition + tidyLayout", () => {
  it("keeps a fixed (dragged) node exactly put through a tidy pass", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    g = expandNode(g, engine, "2.002");
    const termOf = new Map([
      ["1.001", 0],
      ["2.002", 0],
      ["3.003", 0],
    ]);
    let layout = reconcileLayout(emptyLayout(), g, termOf);
    layout = setNodePosition(layout, "2.002", { x: 500, y: -200 });
    const tidied = tidyLayout(layout, g);
    expect(tidied.positions.get("2.002")).toEqual({ x: 500, y: -200 });
  });

  it("tidy is deterministic", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    g = expandNode(g, engine, "2.002");
    const termOf = new Map([
      ["1.001", 0],
      ["2.002", 0],
      ["3.003", 0],
    ]);
    const layout = reconcileLayout(emptyLayout(), g, termOf);
    const a = tidyLayout(layout, g);
    const b = tidyLayout(layout, g);
    expect([...a.positions.entries()]).toEqual([...b.positions.entries()]);
  });

  it("re-packs a row: closes the gap a manual move left, restoring department order", () => {
    const cat = makeCatalog([
      makeSubject({ subject_id: "6.100" }),
      makeSubject({ subject_id: "6.200" }),
      makeSubject({ subject_id: "6.300" }),
    ]);
    const e = new EdgeEngine(cat);
    const g = seedGraph(e, ["6.100", "6.200", "6.300"]);
    const termOf = new Map([
      ["6.100", 1],
      ["6.200", 1],
      ["6.300", 1],
    ]);
    let layout = reconcileLayout(emptyLayout(), g, termOf);
    // drag 6.200 far away, leaving a gap in its row
    layout = setNodePosition(layout, "6.200", { x: 9000, y: 9000 });
    const tidied = tidyLayout(layout, g);
    // the dragged (fixed) node stays exactly put
    expect(tidied.positions.get("6.200")).toEqual({ x: 9000, y: 9000 });
    // the other two close up at the front of their row, in dept order
    expect(cell(tidied.positions.get("6.100")!)).toEqual({ col: 0, row: 0 });
    expect(cell(tidied.positions.get("6.300")!)).toEqual({ col: 1, row: 0 });
  });
});

describe("fitViewport", () => {
  it("computes a clamped zoom that frames all nodes", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    const termOf = new Map([
      ["1.001", 0],
      ["2.002", 1],
    ]);
    const layout = reconcileLayout(emptyLayout(), g, termOf);
    const vp = fitViewport(computeBounds(layout), 800, 600);
    expect(vp.zoom).toBeGreaterThanOrEqual(0.35);
    expect(vp.zoom).toBeLessThanOrEqual(1.6);
    expect(Number.isFinite(vp.x)).toBe(true);
    expect(Number.isFinite(vp.y)).toBe(true);
  });

  it("an extra left margin shrinks the fit to make room, leaving the plain case unchanged", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    const termOf = new Map([
      ["1.001", 0],
      ["2.002", 1],
    ]);
    const layout = reconcileLayout(emptyLayout(), g, termOf);
    const bounds = computeBounds(layout);
    const plain = fitViewport(bounds, 800, 600, 80, 0.35, 1);
    const withMargin = fitViewport(bounds, 800, 600, 80, 0.35, 1, 300);
    // more content to fit horizontally (bounds widened by the margin) can
    // only tighten the zoom, never loosen it
    expect(withMargin.zoom).toBeLessThanOrEqual(plain.zoom);
    // the original content's left edge (bounds.minX) now lands further
    // from the frame's own left edge than in the plain fit, i.e. the
    // reserved margin actually shows up on screen
    const plainScreenX = bounds.minX * plain.zoom + plain.x;
    const marginScreenX = bounds.minX * withMargin.zoom + withMargin.x;
    expect(marginScreenX).toBeGreaterThan(plainScreenX);
  });
});
