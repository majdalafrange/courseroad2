import { describe, expect, it } from "vitest";
import { EdgeEngine } from "../../../../src/lib/connections/edges";
import {
  collapseNode,
  expandNode,
  hasMoreNeighbors,
  pinNode,
  removeNode,
  resetGraph,
  revealNeighbor,
  seedGraph,
} from "../../../../src/lib/connections/graph";
import { makeCatalog, makeSubject } from "../fixtures";

/** A-N-M prerequisite chain (each link is one undirected edge). */
function chainCatalog() {
  return makeCatalog([
    makeSubject({ subject_id: "1.001" }),
    makeSubject({ subject_id: "2.002", prerequisites: "1.001" }),
    makeSubject({ subject_id: "3.003", prerequisites: "2.002" }),
  ]);
}

describe("collapse never orphans", () => {
  it("collects an introducer CYCLE, the case ref-counting strands", () => {
    const engine = new EdgeEngine(chainCatalog());
    let g = seedGraph(engine, ["1.001"]); // A is the only anchor
    g = expandNode(g, engine, "1.001"); // A reveals N (2.002)
    g = expandNode(g, engine, "2.002"); // N reveals M (3.003)
    g = expandNode(g, engine, "3.003"); // M re-introduces N (3.003↔2.002)

    expect([...g.nodes.keys()].sort()).toEqual(["1.001", "2.002", "3.003"]);
    // introducer cycle now exists: 2.002←{1.001,3.003}, 3.003←{2.002}
    expect([...(g.introducedBy.get("2.002") ?? [])].sort()).toEqual([
      "1.001",
      "3.003",
    ]);
    expect([...(g.introducedBy.get("3.003") ?? [])]).toEqual(["2.002"]);

    g = collapseNode(g, "1.001"); // collapse the only anchor's expansion
    // N and M are reachable ONLY through each other now → both swept.
    expect([...g.nodes.keys()]).toEqual(["1.001"]);
    expect(g.edges.size).toBe(0);
  });

  it("keeps a node still reachable from another expanded node", () => {
    const engine = new EdgeEngine(
      makeCatalog([
        makeSubject({ subject_id: "1.001" }),
        makeSubject({ subject_id: "2.002" }),
        makeSubject({ subject_id: "3.003", prerequisites: "1.001/2.002" }),
      ]),
    );
    let g = seedGraph(engine, ["1.001", "2.002"]);
    g = expandNode(g, engine, "1.001"); // 1.001 introduces 3.003
    g = expandNode(g, engine, "2.002"); // 2.002 also introduces 3.003
    g = collapseNode(g, "1.001"); // 2.002 still justifies 3.003
    expect(g.nodes.has("3.003")).toBe(true);
  });

  it("never sweeps an anchor or a pinned node", () => {
    const engine = new EdgeEngine(chainCatalog());
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001"); // reveals 2.002
    g = expandNode(g, engine, "2.002"); // reveals 3.003
    g = pinNode(g, "3.003"); // pin the leaf
    g = collapseNode(g, "1.001"); // would otherwise sweep 2.002 and 3.003
    expect(g.nodes.has("1.001")).toBe(true); // anchor stays
    expect(g.nodes.has("3.003")).toBe(true); // pinned stays
    // 2.002 is reachable as a side effect? No, and it is not pinned/anchor either, so
    // its only live justification is gone, yet 3.003 (pinned) does not expand,
    // so 2.002 is swept. Pinned nodes are roots, not bridges.
    expect(g.nodes.has("2.002")).toBe(false);
  });
});

describe("seed", () => {
  it("builds anchors and interconnects related ones immediately", () => {
    const engine = new EdgeEngine(chainCatalog());
    const g = seedGraph(engine, ["1.001", "2.002"]);
    expect([...g.anchors].sort()).toEqual(["1.001", "2.002"]);
    expect(g.edges.size).toBe(1); // 2.002 requires 1.001
  });

  it("dedupes repeats and drops generic / unresolvable seeds", () => {
    const engine = new EdgeEngine(makeCatalog());
    const g = seedGraph(engine, [
      "6.0001",
      "6.0001", // duplicate
      "PHY1", // generic → dropped
      "NOPE.1", // unresolvable → dropped
      "6.001", // old_id of 6.0001 → resolves but is a duplicate
    ]);
    expect([...g.anchors]).toEqual(["6.0001"]);
  });
});

describe("expand cap + show more", () => {
  function hubEngine() {
    // Twelve dependents of one hub subject: the fan-out the cap bounds.
    const dependents = Array.from({ length: 12 }, (_, i) => `9.0${i + 10}`);
    const subjects = [
      makeSubject({ subject_id: "6.000" }),
      ...dependents.map((id) =>
        makeSubject({ subject_id: id, prerequisites: "6.000" }),
      ),
    ];
    return new EdgeEngine(makeCatalog(subjects));
  }

  it("reveals at most the cap, then offers more", () => {
    const engine = hubEngine();
    let g = seedGraph(engine, ["6.000"]);
    g = expandNode(g, engine, "6.000", 8);
    expect(g.nodes.size).toBe(1 + 8);
    expect(hasMoreNeighbors(g, engine, "6.000")).toBe(true);
    g = expandNode(g, engine, "6.000", 8); // show more
    expect(g.nodes.size).toBe(1 + 12);
    expect(hasMoreNeighbors(g, engine, "6.000")).toBe(false);
  });

  it("expanding a fully-expanded node is a no-op (idempotency)", () => {
    const engine = hubEngine();
    let g = seedGraph(engine, ["6.000"]);
    g = expandNode(g, engine, "6.000", 99); // reveal all
    const before = g.nodes.size;
    g = expandNode(g, engine, "6.000");
    expect(g.nodes.size).toBe(before);
    expect(hasMoreNeighbors(g, engine, "6.000")).toBe(false);
  });

  it("collapsing an unexpanded / leaf node is a no-op", () => {
    const engine = hubEngine();
    const g = seedGraph(engine, ["6.000"]);
    expect(collapseNode(g, "6.000")).toBe(g); // not expanded yet
  });

  it("does not duplicate an already-present neighbor", () => {
    const engine = new EdgeEngine(chainCatalog());
    let g = seedGraph(engine, ["1.001", "2.002"]); // both anchors, connected
    g = expandNode(g, engine, "1.001"); // 2.002 already present
    expect(g.nodes.size).toBe(2); // no duplicate node created
  });
});

describe("remove + reset", () => {
  it("removes a node, sweeps its orphans, and suppresses re-adding it", () => {
    const engine = new EdgeEngine(chainCatalog());
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001"); // reveals 2.002
    g = expandNode(g, engine, "2.002"); // reveals 3.003
    g = removeNode(g, "2.002"); // removing the bridge orphans 3.003
    expect(g.nodes.has("2.002")).toBe(false);
    expect(g.nodes.has("3.003")).toBe(false); // swept
    expect(g.removed.has("2.002")).toBe(true);
    // expanding 1.001 again must not bring 2.002 back
    g = expandNode(g, engine, "1.001");
    expect(g.nodes.has("2.002")).toBe(false);
  });

  it("reset drops discovered nodes but preserves anchors and pins", () => {
    const engine = new EdgeEngine(chainCatalog());
    let g = seedGraph(engine, ["1.001"]);
    g = expandNode(g, engine, "1.001"); // reveals 2.002
    g = expandNode(g, engine, "2.002"); // reveals 3.003
    g = pinNode(g, "3.003");
    g = resetGraph(g, engine);
    expect(g.nodes.has("1.001")).toBe(true); // anchor
    expect(g.nodes.has("3.003")).toBe(true); // pinned
    expect(g.nodes.has("2.002")).toBe(false); // discovered, dropped
    expect(g.expanded.size).toBe(0);
    expect(g.removed.size).toBe(0);
  });

  it("reset restores an anchor that was itself removed", () => {
    // Anchors are documented as permanent roots; removing one from view
    // must not revoke that, or Reset can no longer bring it back.
    const engine = new EdgeEngine(chainCatalog());
    let g = seedGraph(engine, ["1.001", "2.002"]);
    g = removeNode(g, "2.002");
    expect(g.nodes.has("2.002")).toBe(false);
    expect(g.anchors.has("2.002")).toBe(true);
    g = resetGraph(g, engine);
    expect(g.nodes.has("2.002")).toBe(true);
    expect(g.anchors.has("2.002")).toBe(true);
  });
});

describe("revealNeighbor (side-panel 'show on graph')", () => {
  it("adds a single connected neighbor and marks the parent expanded", () => {
    const engine = new EdgeEngine(chainCatalog());
    let g = seedGraph(engine, ["1.001"]);
    g = revealNeighbor(g, engine, "1.001", "2.002");
    expect(g.nodes.has("2.002")).toBe(true);
    expect(g.expanded.has("1.001")).toBe(true);
    // and it participates in collapse like any introduced node
    g = collapseNode(g, "1.001");
    expect(g.nodes.has("2.002")).toBe(false);
  });

  it("is a no-op for two unconnected subjects", () => {
    const engine = new EdgeEngine(makeCatalog());
    const g = seedGraph(engine, ["6.0001"]);
    expect(revealNeighbor(g, engine, "6.0001", "21M.301")).toBe(g);
  });
});

describe("purity", () => {
  it("never mutates the input state", () => {
    const engine = new EdgeEngine(chainCatalog());
    const g0 = seedGraph(engine, ["1.001"]);
    const snapshotNodes = [...g0.nodes.keys()];
    const g1 = expandNode(g0, engine, "1.001");
    expect([...g0.nodes.keys()]).toEqual(snapshotNodes); // g0 untouched
    expect(g1).not.toBe(g0);
  });
});
