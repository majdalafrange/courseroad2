import { describe, expect, it } from "vitest";
import {
  EdgeEngine,
  extractPrereqTokens,
  prereqLeafIds,
  noisyOr,
  resolveSubjectId,
} from "../../../../src/lib/connections/edges";
import {
  departmentOf,
  isCrossing,
} from "../../../../src/lib/connections/types";
import { makeCatalog, makeSubject } from "../fixtures";

const catalog = makeCatalog();

describe("extractPrereqTokens (boolean strings to leaf tokens)", () => {
  it("drops quoted phrases like 'permission of instructor'", () => {
    expect(extractPrereqTokens('8.01, "permission of instructor"')).toEqual([
      "8.01",
    ]);
  });

  it("flattens nested boolean groups to bare tokens", () => {
    expect(
      extractPrereqTokens("(6.0001/6.00/6.01), (6.042/6.1200/18.062)"),
    ).toEqual(["6.0001", "6.00", "6.01", "6.042", "6.1200", "18.062"]);
  });

  it("drops GIR / HASS / CI attribute tokens (not explorable subjects)", () => {
    expect(extractPrereqTokens("GIR:CAL1")).toEqual([]);
    expect(extractPrereqTokens("HASS-H")).toEqual([]);
    expect(extractPrereqTokens("CI-H")).toEqual([]);
  });

  it("handles empty / undefined strings", () => {
    expect(extractPrereqTokens(undefined)).toEqual([]);
    expect(extractPrereqTokens("")).toEqual([]);
    expect(extractPrereqTokens("''")).toEqual([]);
  });
});

describe("prereqLeafIds (resolution + dropping)", () => {
  it("keeps only tokens present in the catalog, dropping the rest silently", () => {
    expect(
      prereqLeafIds("(6.0001/6.00/6.01), (6.042/6.1200/18.062)", catalog),
    ).toEqual(["6.0001", "6.00", "6.042"]);
  });

  it("resolves renumbered ids via old_id", () => {
    // 6.001 is the old_id of 6.0001
    expect(prereqLeafIds("6.001", catalog)).toEqual(["6.0001"]);
  });

  it("returns no leaves for an attribute-only requirement", () => {
    expect(prereqLeafIds("GIR:CAL1", catalog)).toEqual([]);
  });
});

describe("resolveSubjectId", () => {
  it("returns current ids unchanged and resolves old ids", () => {
    expect(resolveSubjectId(catalog, "6.0001")).toBe("6.0001");
    expect(resolveSubjectId(catalog, "6.001")).toBe("6.0001");
    expect(resolveSubjectId(catalog, "NOPE.999")).toBeUndefined();
  });
});

describe("departmentOf / isCrossing (non-numeric, suffixed ids)", () => {
  it("parses the token before the first dot, never assuming numeric", () => {
    expect(departmentOf("21W.021")).toBe("21W");
    expect(departmentOf("CMS.100")).toBe("CMS");
    expect(departmentOf("6.1010")).toBe("6");
    expect(departmentOf("WGS.101")).toBe("WGS");
    expect(departmentOf("21G.701")).toBe("21G");
  });

  it("flags cross-department pairs", () => {
    expect(isCrossing("6.0001", "18.200")).toBe(true);
    expect(isCrossing("6.0001", "6.006")).toBe(false);
  });
});

describe("noisyOr", () => {
  it("is bounded in [0,1) and rewards multiple signals", () => {
    expect(noisyOr([])).toBe(0);
    expect(noisyOr([0.5])).toBeCloseTo(0.5);
    expect(noisyOr([0.5, 0.5])).toBeCloseTo(0.75);
    expect(noisyOr([0.95, 0.7, 0.45])).toBeLessThan(1);
    expect(noisyOr([0.95, 0.7])).toBeGreaterThan(0.95);
  });
});

describe("EdgeEngine.neighbors", () => {
  const engine = new EdgeEngine(catalog);

  it("finds reverse-prereq dependents of a subject", () => {
    const ids = engine.neighbors("6.0001").map((n) => n.id);
    expect(ids).toContain("6.0002");
    expect(ids).toContain("6.006");
    // every reason is a prerequisite link, directed away from 6.0001
    for (const n of engine.neighbors("6.0001")) {
      expect(n.reasons.some((r) => r.type === "prereq")).toBe(true);
      expect(n.arrow).toEqual({ from: "6.0001", to: n.id });
    }
  });

  it("finds every forward prerequisite of a subject", () => {
    const map = engine.neighborMap("6.006");
    // forward: 6.006 requires 6.0001, 6.00, 6.042
    expect(map.get("6.0001")?.reasons.some((r) => r.type === "prereq")).toBe(
      true,
    );
    expect(map.get("6.042")?.reasons.some((r) => r.type === "prereq")).toBe(
      true,
    );
    // a subject that merely shares a prerequisite is not connected
    expect(map.has("6.0002")).toBe(false);
  });

  it("never emits self-edges, generic ids, or unresolvable ghosts", () => {
    for (const id of ["6.0001", "6.006", "6.042", "2.001"]) {
      const ids = engine.neighbors(id).map((n) => n.id);
      expect(ids).not.toContain(id); // no self-edge
      expect(ids).not.toContain("PHY1"); // generic excluded
      expect(ids).not.toContain("HASS-A");
      expect(ids).not.toContain("18.062"); // not in catalog → dropped
    }
  });

  it("drops a custom activity from neighbor extraction", () => {
    const withCustom = makeCatalog([
      ...catalog.subjectsInfo,
      makeSubject({
        subject_id: "CUSTOM.1",
        title: "UROP",
        public: false,
        related_subjects: ["6.0001"],
      }),
    ]);
    const e = new EdgeEngine(withCustom);
    expect(e.neighbors("CUSTOM.1")).toEqual([]); // custom has no graph edges
    expect(e.neighbors("6.0001").map((n) => n.id)).not.toContain("CUSTOM.1");
  });
});

describe("EdgeEngine.edgeBetween (dedupe + merge, never parallel)", () => {
  it("merges both directions of a prerequisite into one edge", () => {
    const cat = makeCatalog([
      makeSubject({ subject_id: "6.100", title: "Intro ML" }),
      makeSubject({
        subject_id: "18.200",
        title: "Optimization",
        prerequisites: "6.100",
      }),
    ]);
    const engine = new EdgeEngine(cat);
    const edge = engine.edgeBetween("6.100", "18.200");
    expect(edge).toBeDefined();
    // 18.200 declares the prerequisite; 6.100 sees it in reverse. One
    // reason survives, never a parallel pair.
    expect(edge!.reasons.map((r) => r.type)).toEqual(["prereq"]);
    expect(edge!.crossing).toBe(true); // 6 vs 18
    expect(edge!.primaryType).toBe("prereq");
    expect(edge!.arrow).toEqual({ from: "6.100", to: "18.200" });
    // identity is order-independent
    expect(engine.edgeBetween("18.200", "6.100")!.id).toBe(edge!.id);
  });

  it("returns undefined for unrelated subjects", () => {
    const engine = new EdgeEngine(catalog);
    expect(engine.edgeBetween("8.01", "21M.301")).toBeUndefined();
  });

  it("finds the edge from either endpoint, though only one declares it", () => {
    const cat = makeCatalog([
      makeSubject({ subject_id: "1.001" }), // says nothing about 2.002
      makeSubject({ subject_id: "2.002", prerequisites: "1.001" }),
    ]);
    const engine = new EdgeEngine(cat);
    expect(engine.edgeBetween("1.001", "2.002")).toBeDefined();
    expect(engine.edgeBetween("2.002", "1.001")).toBeDefined();
  });
});
