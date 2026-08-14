import { describe, expect, it } from "vitest";
import {
  firstAppearance,
  isGroup,
  parseRequirements,
  subjectsWithPrereq,
  type ParsedLeaf,
  type ParsedRequirement,
} from "../../../src/lib/prereqTree";
import { makeCatalog, emptyBuckets, placed } from "./fixtures";

const catalog = makeCatalog();

/** Ids of the leaf entries in a reqs list (groups contribute nothing). */
function leafIds(reqs: (ParsedRequirement | ParsedLeaf)[]): string[] {
  return reqs
    .filter((req): req is ParsedLeaf => !isGroup(req))
    .map((req) => req.subject_id);
}

describe("parseRequirements", () => {
  it("parses 6.006-style nested any/all structure", () => {
    const buckets = emptyBuckets();
    const tree = parseRequirements(
      "(6.0001/6.00/6.01), (6.042/6.1200/18.062)",
      catalog,
      buckets,
      -1,
    );
    expect(tree.topLevel).toBe(true);
    expect(tree.connectionType).toBe("all");
    expect(tree.reqs).toHaveLength(2);
    const first = tree.reqs[0] as ParsedRequirement;
    expect(first.connectionType).toBe("any");
    expect(leafIds(first.reqs)).toEqual(["6.0001", "6.00", "6.01"]);
  });

  it("computes leaf fulfillment from buckets before first appearance", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("6.0001", 1));
    buckets[2].push(placed("6.042", 2));
    // class placed in bucket 3
    const tree = parseRequirements(
      "(6.0001/6.00/6.01), (6.042/6.1200/18.062)",
      catalog,
      buckets,
      3,
    );
    expect(tree.fulfilled).toBe(true);
    // without the earlier classes (first appearance = 1), not fulfilled
    const tree2 = parseRequirements(
      "(6.0001/6.00/6.01), (6.042/6.1200/18.062)",
      catalog,
      buckets,
      1,
    );
    expect(tree2.fulfilled).toBe(false);
  });

  it("handles single-req strings", () => {
    const tree = parseRequirements("GIR:CAL1", catalog, emptyBuckets(), -1);
    expect(tree.reqs).toHaveLength(1);
    expect(leafIds(tree.reqs)).toEqual(["GIR:CAL1"]);
  });

  it("types two-element any/all groups", () => {
    const tree = parseRequirements("8.01, 18.01", catalog, emptyBuckets(), -1);
    expect(tree.connectionType).toBe("all");
    const tree2 = parseRequirements("8.01/18.01", catalog, emptyBuckets(), -1);
    expect(tree2.connectionType).toBe("any");
  });

  it("a one-child group inherits its child's fulfillment", () => {
    const buckets = emptyBuckets();
    buckets[1].push(placed("6.0001", 1));
    const met = parseRequirements("6.0001", catalog, buckets, 2);
    expect(met.reqs).toHaveLength(1);
    expect(met.fulfilled).toBe(true);
    const metParen = parseRequirements("(6.0001)", catalog, buckets, 2);
    expect(metParen.fulfilled).toBe(true);
    const unmet = parseRequirements("6.0001", catalog, emptyBuckets(), 2);
    expect(unmet.fulfilled).toBe(false);
  });

  it("strips quotes from quoted requirement strings", () => {
    const tree = parseRequirements(
      "8.01/'permission of instructor'",
      catalog,
      emptyBuckets(),
      -1,
    );
    expect(leafIds(tree.reqs)).toContain("permission of instructor");
  });
});

describe("comma/slash precedence", () => {
  it("parses A,B/C as A AND (B OR C)", () => {
    const tree = parseRequirements(
      "8.01,6.0001/6.0002",
      catalog,
      emptyBuckets(),
      -1,
    );
    expect(tree.connectionType).toBe("all");
    expect(tree.reqs).toHaveLength(2);
    expect(leafIds(tree.reqs)).toEqual(["8.01"]);
    const group = tree.reqs.find(isGroup) as ParsedRequirement;
    expect(group.connectionType).toBe("any");
    expect(leafIds(group.reqs)).toEqual(["6.0001", "6.0002"]);
  });

  it("does not report A,B/C satisfied when only B is on the road", () => {
    const buckets = emptyBuckets();
    buckets[0].push(placed("6.0001", 0));
    const tree = parseRequirements("8.01,6.0001/6.0002", catalog, buckets, 2);
    // The old last-separator parse read this as any-of and said true.
    expect(tree.fulfilled).toBe(false);
    const group = tree.reqs.find(isGroup) as ParsedRequirement;
    expect(group.fulfilled).toBe(true);
  });

  it("parses A/B,C as (A OR B) AND C", () => {
    const buckets = emptyBuckets();
    buckets[0].push(placed("8.01", 0));
    const tree = parseRequirements("8.01/6.0001,6.0002", catalog, buckets, 2);
    expect(tree.connectionType).toBe("all");
    expect(tree.reqs).toHaveLength(2);
    const group = tree.reqs.find(isGroup) as ParsedRequirement;
    expect(group.connectionType).toBe("any");
    expect(leafIds(group.reqs)).toEqual(["8.01", "6.0001"]);
    expect(group.fulfilled).toBe(true);
    expect(tree.fulfilled).toBe(false);
  });

  it("parses A,B/C,D as A AND (B OR C) AND D", () => {
    const buckets = emptyBuckets();
    buckets[0].push(placed("8.01", 0), placed("6.0002", 0), placed("18.01", 0));
    const tree = parseRequirements(
      "8.01,6.0001/6.0002,18.01",
      catalog,
      buckets,
      2,
    );
    expect(tree.connectionType).toBe("all");
    expect(tree.reqs).toHaveLength(3);
    const group = tree.reqs.find(isGroup) as ParsedRequirement;
    expect(group.connectionType).toBe("any");
    expect(leafIds(group.reqs)).toEqual(["6.0001", "6.0002"]);
    expect(tree.fulfilled).toBe(true);
  });

  it("keeps parenthesized groups atomic under either separator", () => {
    const buckets = emptyBuckets();
    buckets[0].push(placed("6.0001", 0));

    const anyTree = parseRequirements(
      "(8.01,18.01)/6.0001",
      catalog,
      buckets,
      2,
    );
    expect(anyTree.connectionType).toBe("any");
    const allGroup = anyTree.reqs.find(isGroup) as ParsedRequirement;
    expect(allGroup.connectionType).toBe("all");
    expect(leafIds(allGroup.reqs)).toEqual(["8.01", "18.01"]);
    expect(anyTree.fulfilled).toBe(true);

    const nested = parseRequirements(
      "8.01,(6.0001/6.0002,18.01)",
      catalog,
      buckets,
      2,
    );
    expect(nested.connectionType).toBe("all");
    const inner = nested.reqs.find(isGroup) as ParsedRequirement;
    expect(inner.connectionType).toBe("all");
    const innerAny = inner.reqs.find(isGroup) as ParsedRequirement;
    expect(innerAny.connectionType).toBe("any");
    expect(leafIds(innerAny.reqs)).toEqual(["6.0001", "6.0002"]);
    expect(nested.fulfilled).toBe(false);
  });
});

describe("firstAppearance", () => {
  it("finds the first bucket containing the subject", () => {
    const buckets = emptyBuckets();
    buckets[4].push(placed("6.006", 4));
    expect(firstAppearance(buckets, "6.006")).toBe(4);
    expect(firstAppearance(buckets, "8.01")).toBe(-1);
  });
});

describe("subjectsWithPrereq", () => {
  it("finds reverse dependencies, same department first", () => {
    const subj = catalog.subjectsInfo[catalog.subjectsIndex["6.0001"]];
    const results = subjectsWithPrereq(subj, catalog.subjectsInfo);
    expect(results.map((s) => s.subject_id)).toContain("6.0002");
    expect(results.map((s) => s.subject_id)).toContain("6.006");
  });

  it("matches GIR-attribute prereqs for GIR subjects", () => {
    const phys = catalog.subjectsInfo[catalog.subjectsIndex["8.01"]];
    const results = subjectsWithPrereq(phys, catalog.subjectsInfo);
    // 2.001 requires 8.01 directly
    expect(results.map((s) => s.subject_id)).toContain("2.001");
  });

  it("orders same-department results first regardless of input order", () => {
    // The legacy comparator returned only -1 or 0, so the documented
    // "same department first" order held only when the catalog happened
    // to arrive in a favorable order.
    const extended = makeCatalog([
      ...catalog.subjectsInfo,
      {
        subject_id: "16.405",
        title: "x",
        prerequisites: "6.0001",
      },
    ]);
    const subj = extended.subjectsInfo[extended.subjectsIndex["6.0001"]];
    for (const infos of [
      extended.subjectsInfo,
      [...extended.subjectsInfo].reverse(),
    ]) {
      const ids = subjectsWithPrereq(subj, infos).map((s) => s.subject_id);
      const lastSameDept = ids
        .map((id) => id.startsWith("6."))
        .lastIndexOf(true);
      const firstOtherDept = ids
        .map((id) => id.startsWith("6."))
        .indexOf(false);
      expect(ids).toContain("16.405");
      expect(lastSameDept).toBeLessThan(firstOtherDept);
    }
  });

  it("does not match substrings of longer ids", () => {
    const six = makeCatalog([
      ...catalog.subjectsInfo,
      {
        subject_id: "1.001",
        title: "x",
        prerequisites: "16.0001",
      },
    ]);
    const subj = six.subjectsInfo[six.subjectsIndex["6.0001"]];
    const results = subjectsWithPrereq(subj, six.subjectsInfo);
    expect(results.map((s) => s.subject_id)).not.toContain("1.001");
  });
});
