import { describe, expect, it } from "vitest";
import { EdgeEngine } from "../../../../src/lib/connections/edges";
import {
  rankNeighbors,
  type RankContext,
} from "../../../../src/lib/connections/rank";
import type { Subject } from "../../../../src/lib/types";
import { makeCatalog, makeSubject } from "../fixtures";

const catalog = makeCatalog([
  makeSubject({ subject_id: "6.000" }),
  makeSubject({
    subject_id: "6.001",
    prerequisites: "6.000",
    rating: 6.5,
    enrollment_number: 200,
    in_class_hours: 5,
    out_of_class_hours: 7,
  }),
  makeSubject({ subject_id: "6.002", prerequisites: "6.000", rating: 5.0 }),
  makeSubject({
    subject_id: "6.900",
    prerequisites: "6.000",
    rating: 7.0, // high rating, but no longer offered → must be demoted
    is_historical: true,
    source_semester: "fall-2020",
  }),
]);

const engine = new EdgeEngine(catalog);

function ctx(overrides: Partial<RankContext> = {}): RankContext {
  return {
    catalog,
    roadStatus: new Map(),
    requirementBadge: () => undefined,
    onCanvas: () => false,
    ...overrides,
  };
}

describe("rankNeighbors", () => {
  it("phrases prerequisite reasons relative to the selected node", () => {
    const ranked = rankNeighbors(engine, "6.000", ctx());
    const unlocked = ranked.find((r) => r.id === "6.001");
    expect(unlocked?.reason).toBe("Unlocked by 6.000");
    // and from the dependent's perspective the same edge reads the other way
    const back = rankNeighbors(engine, "6.001", ctx());
    expect(back.find((r) => r.id === "6.000")?.reason).toBe(
      "Prerequisite for 6.001",
    );
  });

  it("demotes a no-longer-offered subject below live ones despite a high rating", () => {
    const ranked = rankNeighbors(engine, "6.000", ctx());
    const ids = ranked.map((r) => r.id);
    expect(ids.indexOf("6.900")).toBe(ids.length - 1); // last
    expect(ranked.find((r) => r.id === "6.900")?.offered).toBe(false);
  });

  it("passes through road status and requirement badges", () => {
    const ranked = rankNeighbors(
      engine,
      "6.000",
      ctx({
        roadStatus: new Map([["6.001", "taken"]]),
        requirementBadge: (s: Subject) =>
          s.subject_id === "6.002" ? "Fills HASS-A" : undefined,
        onCanvas: (id) => id === "6.001",
      }),
    );
    expect(ranked.find((r) => r.id === "6.001")?.status).toBe("taken");
    expect(ranked.find((r) => r.id === "6.001")?.onCanvas).toBe(true);
    expect(ranked.find((r) => r.id === "6.002")?.requirementBadge).toBe(
      "Fills HASS-A",
    );
  });

  it("returns an empty list for a node with no neighbors", () => {
    const lone = makeCatalog([makeSubject({ subject_id: "99.999" })]);
    const e = new EdgeEngine(lone);
    expect(rankNeighbors(e, "99.999", ctx())).toEqual([]);
  });

  it("computes weekly hours when available", () => {
    const ranked = rankNeighbors(engine, "6.000", ctx());
    expect(ranked.find((r) => r.id === "6.001")?.hours).toBe(12);
  });

  it("raises ready subjects and never evaluates readiness for on-road ones", () => {
    const base = rankNeighbors(engine, "6.000", ctx());
    const boosted = rankNeighbors(
      engine,
      "6.000",
      ctx({
        roadStatus: new Map([["6.002", "planned"]]),
        readiness: (s: Subject) =>
          s.subject_id === "6.001" ? { kind: "ready" } : { kind: "unknown" },
      }),
    );
    const before = base.find((r) => r.id === "6.001");
    const after = boosted.find((r) => r.id === "6.001");
    expect(after?.readiness).toEqual({ kind: "ready" });
    expect(after?.score).toBeCloseTo((before?.score ?? 0) + 0.05, 5);
    // on-road subjects report status instead of readiness
    expect(boosted.find((r) => r.id === "6.002")?.readiness).toBeUndefined();
  });
});
