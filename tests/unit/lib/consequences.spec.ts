import { describe, expect, it } from "vitest";
import {
  computeConsequences,
  placedKey,
  requirementTokens,
} from "../../../src/lib/consequences";
import { makeCatalog, emptyBuckets, placed } from "./fixtures";

const catalog = makeCatalog();

describe("requirementTokens", () => {
  it("extracts subject ids and attribute tokens", () => {
    expect(requirementTokens("(6.0001/6.00), (6.042/18.062)")).toEqual([
      "6.0001",
      "6.00",
      "6.042",
      "18.062",
    ]);
    expect(requirementTokens("GIR:CAL1, GIR:PHY1")).toEqual([
      "GIR:CAL1",
      "GIR:PHY1",
    ]);
  });

  it("drops quoted free-text requirements", () => {
    expect(requirementTokens(`8.01/''permission of instructor''`)).toEqual([
      "8.01",
    ]);
  });

  it("handles undefined", () => {
    expect(requirementTokens(undefined)).toEqual([]);
  });
});

describe("computeConsequences", () => {
  it("finds prerequisite ancestors on the road", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("6.0001", 1)); // 6.0002's prereq
    buckets[2].push(placed("21M.301", 2)); // unrelated
    const subject = catalog.subjectsInfo[catalog.subjectsIndex["6.0002"]];
    const result = computeConsequences(subject, buckets, catalog);
    expect(result.ancestors).toEqual(new Set([placedKey(1, 0)]));
  });

  it("finds dependents (what this class feeds)", () => {
    const buckets = emptyBuckets();
    buckets[3].push(placed("6.0002", 3)); // requires 6.0001
    buckets[4].push(placed("6.006", 4)); // 6.0001 in its prereq tree
    const subject = catalog.subjectsInfo[catalog.subjectsIndex["6.0001"]];
    const result = computeConsequences(subject, buckets, catalog);
    expect(result.dependents).toContain(placedKey(3, 0));
    expect(result.dependents).toContain(placedKey(4, 0));
  });

  it("matches GIR attribute tokens both ways", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("18.01", 1)); // satisfies GIR:CAL1
    const subject = catalog.subjectsInfo[catalog.subjectsIndex["6.0001"]]; // prereq GIR:CAL1
    const result = computeConsequences(subject, buckets, catalog);
    expect(result.ancestors).toContain(placedKey(1, 0));

    // and the reverse: hovering 18.01 should show 6.0001 as a dependent
    const buckets2 = emptyBuckets();
    buckets2[2].push(placed("6.0001", 2));
    const calc = catalog.subjectsInfo[catalog.subjectsIndex["18.01"]];
    const result2 = computeConsequences(calc, buckets2, catalog);
    expect(result2.dependents).toContain(placedKey(2, 0));
  });

  it("ignores custom activities and self", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("UROP", 1, { public: false }));
    buckets[2].push(placed("6.0002", 2));
    const subject = catalog.subjectsInfo[catalog.subjectsIndex["6.0002"]];
    const result = computeConsequences(subject, buckets, catalog);
    expect(result.ancestors.size).toBe(0);
    expect(result.dependents.size).toBe(0);
  });
});
