// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { EdgeEngine } from "../../../../src/lib/connections/edges";
import {
  expandNode,
  pinNode,
  removeNode,
  seedGraph,
} from "../../../../src/lib/connections/graph";
import {
  InMemoryConnectionsPersistence,
  SessionConnectionsPersistence,
  clearExplorationSnapshot,
  reconcileSnapshot,
  serializeGraph,
} from "../../../../src/lib/connections/persist";
import type { Seed } from "../../../../src/lib/connections/types";
import { makeCatalog } from "../fixtures";

const catalog = makeCatalog();
const engine = new EdgeEngine(catalog);
const seed: Seed = { subjectIds: ["6.0001"], origin: "subject" };

describe("serializeGraph", () => {
  it("stores ONLY ids + viewport, never edges or positions", () => {
    let g = seedGraph(engine, ["6.0001"]);
    g = expandNode(g, engine, "6.0001");
    const snapshot = serializeGraph(g, seed, { x: 10, y: 20, zoom: 1 });
    expect(Object.keys(snapshot).sort()).toEqual([
      "expandedNodeIds",
      "pinnedNodeIds",
      "removedNodeIds",
      "seed",
      "version",
      "viewport",
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("edges");
    expect(JSON.stringify(snapshot)).not.toContain("positions");
  });
});

describe("reconcileSnapshot (round-trip + catalog reconciliation)", () => {
  it("rebuilds expanded / pinned / removed membership from the catalog", () => {
    let g = seedGraph(engine, ["6.0001"]);
    g = expandNode(g, engine, "6.0001"); // reveals 6.0002 and 6.006
    g = pinNode(g, "6.0002");
    g = removeNode(g, "6.006");
    const snapshot = serializeGraph(g, seed, { x: 0, y: 0, zoom: 1 });

    const { state, dropped } = reconcileSnapshot(snapshot, engine);
    expect(dropped).toEqual([]);
    expect(state.expanded.has("6.0001")).toBe(true);
    expect(state.pinned.has("6.0002")).toBe(true);
    expect(state.removed.has("6.006")).toBe(true);
    expect(state.nodes.has("6.006")).toBe(false); // suppressed, not re-added

    // a second round-trip is stable
    const again = serializeGraph(state, seed, { x: 0, y: 0, zoom: 1 });
    expect(again.expandedNodeIds.sort()).toEqual(
      snapshot.expandedNodeIds.sort(),
    );
    expect(again.pinnedNodeIds.sort()).toEqual(snapshot.pinnedNodeIds.sort());
    expect(again.removedNodeIds.sort()).toEqual(snapshot.removedNodeIds.sort());
  });

  it("resolves renumbered seeds via old_id", () => {
    const snapshot = serializeGraph(
      seedGraph(engine, ["6.0001"]),
      { subjectIds: ["6.001"], origin: "subject" }, // old_id of 6.0001
      { x: 0, y: 0, zoom: 1 },
    );
    const { state, dropped } = reconcileSnapshot(snapshot, engine);
    expect(state.nodes.has("6.0001")).toBe(true);
    expect(dropped).toEqual([]);
  });

  it("drops a vanished subject and reports it", () => {
    const snapshot = serializeGraph(
      seedGraph(engine, ["6.0001"]),
      { subjectIds: ["6.0001", "GONE.404"], origin: "road" },
      { x: 0, y: 0, zoom: 1 },
    );
    const { state, dropped } = reconcileSnapshot(snapshot, engine);
    expect(dropped).toContain("GONE.404");
    expect(state.nodes.has("6.0001")).toBe(true);
    expect(state.nodes.has("GONE.404")).toBe(false);
  });
});

describe("SessionConnectionsPersistence (consent-gated per-tab storage)", () => {
  const snapshot = () =>
    serializeGraph(seedGraph(engine, ["6.0001"]), seed, {
      x: 0,
      y: 0,
      zoom: 1,
    });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("keeps the snapshot in memory when consent is withheld", () => {
    const store = new SessionConnectionsPersistence(() => false);
    store.save(snapshot());
    // Nothing reaches the browser, but the visit still works.
    expect(sessionStorage.length).toBe(0);
    expect(store.load()).toEqual(snapshot());
  });

  it("stores the snapshot when consent is granted, surviving a reload", () => {
    new SessionConnectionsPersistence(() => true).save(snapshot());
    expect(sessionStorage.length).toBe(1);
    // A fresh instance is what a reload gets: it reads back from storage.
    const afterReload = new SessionConnectionsPersistence(() => true);
    expect(afterReload.load()).toEqual(snapshot());
  });

  it("treats a corrupt or foreign-shaped snapshot as absent", () => {
    const store = new SessionConnectionsPersistence(() => true);
    sessionStorage.setItem("connectionsExploration", "{oops");
    expect(store.load()).toBeUndefined();
    sessionStorage.setItem(
      "connectionsExploration",
      JSON.stringify({ version: 99, seed: null }),
    );
    expect(store.load()).toBeUndefined();
  });

  it("clearExplorationSnapshot drops it (the opt-out path)", () => {
    new SessionConnectionsPersistence(() => true).save(snapshot());
    expect(sessionStorage.length).toBe(1);
    clearExplorationSnapshot();
    expect(sessionStorage.getItem("connectionsExploration")).toBeNull();
  });
});

describe("InMemoryConnectionsPersistence (the v1 seam)", () => {
  it("round-trips a snapshot and clears", () => {
    const store = new InMemoryConnectionsPersistence();
    expect(store.load()).toBeUndefined();
    const snapshot = serializeGraph(seedGraph(engine, ["6.0001"]), seed, {
      x: 0,
      y: 0,
      zoom: 1,
    });
    store.save(snapshot);
    expect(store.load()).toEqual(snapshot);
    store.clear();
    expect(store.load()).toBeUndefined();
  });
});
