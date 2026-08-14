import { describe, expect, it } from "vitest";
import { EdgeEngine } from "../../../../src/lib/connections/edges";
import { expandNode, seedGraph } from "../../../../src/lib/connections/graph";
import {
  computeBounds,
  emptyLayout,
  fitViewport,
  reconcileLayout,
  setNodePosition,
  tidyLayout,
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

function dist(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Clockwise angle from the top of the ring, in [0, 2π). */
function angleFromTop(p: { x: number; y: number }): number {
  const a = Math.atan2(p.y, p.x) + Math.PI / 2;
  return a < 0 ? a + 2 * Math.PI : a;
}

describe("reconcileLayout", () => {
  it("places a lone anchor at the origin", () => {
    const g = seedGraph(engine, ["1.001"]);
    const layout = reconcileLayout(emptyLayout(), g);
    expect(layout.positions.get("1.001")).toEqual({ x: 0, y: 0 });
  });

  it("is deterministic: same graph yields identical positions", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    const a = reconcileLayout(emptyLayout(), g);
    const b = reconcileLayout(emptyLayout(), g);
    expect([...a.positions.entries()]).toEqual([...b.positions.entries()]);
  });

  it("places new children near their parent, not on top of it", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001"); // reveals 2.002
    const layout = reconcileLayout(emptyLayout(), g);
    const parent = layout.positions.get("1.001")!;
    const child = layout.positions.get("2.002")!;
    expect(dist(parent, child)).toBeGreaterThan(90);
    expect(dist(parent, child)).toBeLessThan(300);
  });

  it("NEVER moves existing nodes when new ones appear", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001"); // reveals 2.002
    const before = reconcileLayout(emptyLayout(), g);
    g = expandNode(g, engine, "2.002"); // reveals 3.003
    const after = reconcileLayout(before, g);
    expect(after.positions.get("1.001")).toEqual(before.positions.get("1.001"));
    expect(after.positions.get("2.002")).toEqual(before.positions.get("2.002"));
    expect(after.positions.has("3.003")).toBe(true);
  });

  it("places a multi-anchor seed on one circle, departments in arcs", () => {
    // two departments interleaved by plain id order; dept-sorted placement
    // must keep each department a contiguous arc around the ring
    const cat = makeCatalog([
      makeSubject({ subject_id: "18.100" }),
      makeSubject({ subject_id: "6.100" }),
      makeSubject({ subject_id: "18.200" }),
      makeSubject({ subject_id: "6.200" }),
    ]);
    const e = new EdgeEngine(cat);
    const g = seedGraph(e, ["18.100", "6.100", "18.200", "6.200"]);
    const layout = reconcileLayout(emptyLayout(), g);
    const radii = [...layout.positions.values()].map((p) =>
      Math.hypot(p.x, p.y),
    );
    // circular: every anchor the same distance from the origin
    for (const r of radii) {
      expect(r).toBeGreaterThan(0);
      expect(r).toBeCloseTo(radii[0], 6);
    }
    // contiguous arcs: walking the ring from the top, departments never
    // interleave (the first id sits at the top, then clockwise)
    const byAngle = [...layout.positions.entries()]
      .sort(([, p], [, q]) => angleFromTop(p) - angleFromTop(q))
      .map(([id]) => id);
    expect(byAngle).toEqual(["18.100", "18.200", "6.100", "6.200"]);
  });

  it("packs a large seed into rings with card-clearing spacing", () => {
    const ids: string[] = [];
    for (let i = 0; i < 40; i++) {
      ids.push(`${(i % 4) + 5}.${String(100 + i)}`);
    }
    const cat = makeCatalog(ids.map((id) => makeSubject({ subject_id: id })));
    const e = new EdgeEngine(cat);
    const g = seedGraph(e, ids);
    const layout = reconcileLayout(emptyLayout(), g);
    const points = [...layout.positions.values()];
    expect(points).toHaveLength(40);
    // cards are 200 wide, so centers must clear at least a card
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        expect(dist(points[i], points[j])).toBeGreaterThanOrEqual(200);
      }
    }
    // a disc, not a sparse donut: everything within a bounded radius
    for (const p of points) {
      expect(Math.hypot(p.x, p.y)).toBeLessThan(1000);
    }
  });

  it("drops positions for nodes no longer in the graph", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    const full = reconcileLayout(emptyLayout(), g);
    const reseed = seedGraph(engine, ["1.001"]);
    const after = reconcileLayout(full, reseed);
    expect(after.positions.has("2.002")).toBe(false);
  });
});

describe("setNodePosition + tidyLayout", () => {
  it("keeps a fixed (dragged) node exactly put through a tidy pass", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    g = expandNode(g, engine, "2.002");
    let layout = reconcileLayout(emptyLayout(), g);
    layout = setNodePosition(layout, "2.002", { x: 500, y: -200 });
    const tidied = tidyLayout(layout, g, 40);
    expect(tidied.positions.get("2.002")).toEqual({ x: 500, y: -200 });
  });

  it("tidy is deterministic", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    g = expandNode(g, engine, "2.002");
    const layout = reconcileLayout(emptyLayout(), g);
    const a = tidyLayout(layout, g, 30);
    const b = tidyLayout(layout, g, 30);
    expect([...a.positions.entries()]).toEqual([...b.positions.entries()]);
  });
});

describe("fitViewport", () => {
  it("computes a clamped zoom that frames all nodes", () => {
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001");
    const layout = reconcileLayout(emptyLayout(), g);
    const vp = fitViewport(computeBounds(layout), 800, 600);
    expect(vp.zoom).toBeGreaterThanOrEqual(0.35);
    expect(vp.zoom).toBeLessThanOrEqual(1.6);
    expect(Number.isFinite(vp.x)).toBe(true);
    expect(Number.isFinite(vp.y)).toBe(true);
  });
});
