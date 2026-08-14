import { describe, expect, it } from "vitest";
import {
  classSatisfies,
  convertReqToID,
  evaluateBooleanExpression,
  reqsFulfilled,
} from "../../../src/lib/requirements";
import { parseRequirements } from "../../../src/lib/prereqTree";
import { emptyBuckets, makeCatalog, placed } from "./fixtures";

const catalog = makeCatalog();

describe("evaluateBooleanExpression", () => {
  it("agrees with eval() on random boolean expressions (seeded)", () => {
    // mulberry32: a failure reproduces from the constant seed instead of
    // vanishing on the next run.
    function mulberry32(seed: number): () => number {
      return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const random = mulberry32(0x524f4144);
    function randomExpr(depth: number): string {
      if (depth === 0 || random() < 0.4) {
        return random() < 0.5 ? "true" : "false";
      }
      const a = randomExpr(depth - 1);
      const b = randomExpr(depth - 1);
      const op = random() < 0.5 ? "&&" : "||";
      return random() < 0.3 ? `(${a}${op}${b})` : `${a}${op}${b}`;
    }
    for (let i = 0; i < 500; i++) {
      const expr = randomExpr(5);

      expect(evaluateBooleanExpression(expr), expr).toBe(eval(expr));
    }
  });

  it("respects && over || precedence like JS", () => {
    expect(evaluateBooleanExpression("true||false&&false")).toBe(true);
    expect(evaluateBooleanExpression("false&&false||true")).toBe(true);
    expect(evaluateBooleanExpression("(true||false)&&false")).toBe(false);
  });

  it("treats an unparseable token as unfulfilled", () => {
    // The random harness only ever emits the parser's alphabet, so these
    // branches need their own cases.
    expect(evaluateBooleanExpression("mystery")).toBe(false);
    expect(evaluateBooleanExpression("true&&mystery")).toBe(false);
    expect(evaluateBooleanExpression("false||mystery")).toBe(false);
  });

  it("tolerates a missing closing parenthesis", () => {
    expect(evaluateBooleanExpression("(true")).toBe(true);
    expect(evaluateBooleanExpression("(true&&false")).toBe(false);
  });
});

describe("classSatisfies", () => {
  it("matches exact ids", () => {
    expect(classSatisfies(catalog, "8.01", "8.01", ["8.01"])).toBe(true);
  });

  it("matches equivalent subjects", () => {
    expect(classSatisfies(catalog, "18.062", "6.042", ["6.042"])).toBe(true);
  });

  it("lets a parent satisfy a child requirement (6.00 → 6.0001)", () => {
    expect(classSatisfies(catalog, "6.0001", "6.00", ["6.00"])).toBe(true);
  });

  it("lets both children together satisfy the parent requirement", () => {
    expect(
      classSatisfies(catalog, "6.00", "6.0001", ["6.0001", "6.0002"]),
    ).toBe(true);
    expect(classSatisfies(catalog, "6.00", "6.0001", ["6.0001"])).toBe(false);
  });

  it("matches GIR attributes", () => {
    expect(classSatisfies(catalog, "GIR:PHY1", "8.01", ["8.01"])).toBe(true);
    expect(classSatisfies(catalog, "GIR:CAL1", "8.01", ["8.01"])).toBe(false);
  });

  it("matches HASS and CI attributes", () => {
    expect(classSatisfies(catalog, "HASS-A", "21M.301", ["21M.301"])).toBe(
      true,
    );
    expect(classSatisfies(catalog, "CI-HW", "21W.022", ["21W.022"])).toBe(true);
  });

  it("returns false for unknown subjects", () => {
    expect(classSatisfies(catalog, "X.999", "Y.888", [])).toBe(false);
  });
});

describe("reqsFulfilled", () => {
  it("evaluates simple AND requirements", () => {
    expect(
      reqsFulfilled(catalog, "6.0001, 18.01", [
        placed("6.0001", 1),
        placed("18.01", 1),
      ]),
    ).toBe(true);
    expect(reqsFulfilled(catalog, "6.0001, 18.01", [placed("6.0001", 1)])).toBe(
      false,
    );
  });

  it("evaluates nested OR/AND like 6.006's prereq", () => {
    const req = "(6.0001/6.00/6.01), (6.042/6.1200/18.062)";
    expect(
      reqsFulfilled(catalog, req, [placed("6.0001", 1), placed("6.042", 2)]),
    ).toBe(true);
    expect(reqsFulfilled(catalog, req, [placed("6.0001", 1)])).toBe(false);
  });

  it("treats unknown quoted strings as false", () => {
    expect(
      reqsFulfilled(catalog, `8.01, ''permission of instructor''`, [
        placed("8.01", 1),
      ]),
    ).toBe(false);
    // but as an alternative they don't block fulfillment
    expect(
      reqsFulfilled(catalog, `8.01/''permission of instructor''`, [
        placed("8.01", 1),
      ]),
    ).toBe(true);
  });

  it('handles "one subject in" category strings', () => {
    expect(
      reqsFulfilled(catalog, `''One subject in History''`, [
        placed("21H.001", 2),
      ]),
    ).toBe(true);
    expect(
      reqsFulfilled(catalog, `''One subject in History''`, [placed("8.01", 2)]),
    ).toBe(false);
  });

  it('handles "two subjects in" with counting', () => {
    expect(
      reqsFulfilled(catalog, `''Two subjects in Anthropology''`, [
        placed("21A.101", 1),
        placed("21A.102", 2),
      ]),
    ).toBe(true);
    expect(
      reqsFulfilled(catalog, `''Two subjects in Anthropology''`, [
        placed("21A.101", 1),
      ]),
    ).toBe(false);
  });

  it("handles the CMS / History or-check special case", () => {
    expect(
      reqsFulfilled(catalog, `''One subject in CMS''/''History''`, [
        placed("21H.001", 1),
      ]),
    ).toBe(true);
    expect(
      reqsFulfilled(catalog, `''One subject in CMS''/''History''`, [
        placed("CMS.100", 1),
      ]),
    ).toBe(true);
  });

  it("matches GIR requirements through placed subjects", () => {
    expect(reqsFulfilled(catalog, "GIR:CAL1", [placed("18.01", 1)])).toBe(true);
  });
});

describe("comma/slash grammar, in agreement with parseRequirements", () => {
  /** Run the same input through the flag and the tree. */
  function bothPaths(req: string, onRoad: string[]) {
    const subjects = onRoad.map((id) => placed(id, 0));
    const buckets = emptyBuckets();
    buckets[0].push(...subjects);
    return {
      flag: reqsFulfilled(catalog, req, subjects),
      tree: parseRequirements(req, catalog, buckets, 1).fulfilled,
    };
  }

  it("evaluates A,B/C as A AND (B OR C)", () => {
    const met = bothPaths("8.01,6.0001/6.0002", ["8.01", "6.0002"]);
    expect(met.flag).toBe(true);
    expect(met.tree).toBe(met.flag);
    // Only the OR branch on the road. The old assembly read this as
    // (A AND B) OR C and returned true.
    const unmet = bothPaths("8.01,6.0001/6.0002", ["6.0002"]);
    expect(unmet.flag).toBe(false);
    expect(unmet.tree).toBe(unmet.flag);
  });

  it("evaluates A/B,C as (A OR B) AND C", () => {
    const met = bothPaths("8.01/6.0001,6.0002", ["8.01", "6.0002"]);
    expect(met.flag).toBe(true);
    expect(met.tree).toBe(met.flag);
    const unmet = bothPaths("8.01/6.0001,6.0002", ["8.01"]);
    expect(unmet.flag).toBe(false);
    expect(unmet.tree).toBe(unmet.flag);
  });

  it("evaluates A,B/C,D as A AND (B OR C) AND D", () => {
    const met = bothPaths("8.01,6.0001/6.0002,18.01", [
      "8.01",
      "6.0002",
      "18.01",
    ]);
    expect(met.flag).toBe(true);
    expect(met.tree).toBe(met.flag);
    const unmet = bothPaths("8.01,6.0001/6.0002,18.01", ["8.01", "6.0002"]);
    expect(unmet.flag).toBe(false);
    expect(unmet.tree).toBe(unmet.flag);
  });

  it("keeps parenthesized groups atomic under either separator", () => {
    const anyOf = bothPaths("(8.01,18.01)/6.0001", ["6.0001"]);
    expect(anyOf.flag).toBe(true);
    expect(anyOf.tree).toBe(anyOf.flag);
    const nested = bothPaths("8.01,(6.0001/6.0002,18.01)", ["8.01", "6.0002"]);
    expect(nested.flag).toBe(false);
    expect(nested.tree).toBe(nested.flag);
    const nestedMet = bothPaths("8.01,(6.0001/6.0002,18.01)", [
      "8.01",
      "6.0002",
      "18.01",
    ]);
    expect(nestedMet.flag).toBe(true);
    expect(nestedMet.tree).toBe(nestedMet.flag);
  });
});

describe("convertReqToID", () => {
  it("maps known categories", () => {
    expect(convertReqToID('"CMS"').toString()).toBe("/CMS/");
    expect(convertReqToID('"philosophy"').toString()).toBe("/24\\.[0-8]/");
    expect(convertReqToID('"History"').toString()).toBe("/21H/");
    expect(convertReqToID('"Brain"').toString()).toBe("/^9\\./");
  });

  it("returns a non-matching sentinel for unknown categories", () => {
    expect(convertReqToID('"Basketweaving"')).toBe("do not match anything");
  });
});
