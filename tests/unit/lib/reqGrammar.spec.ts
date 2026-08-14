import { describe, expect, it } from "vitest";
import {
  splitReqLevel,
  splitTopLevel,
  stripOuterParens,
} from "../../../src/lib/reqGrammar";

/**
 * Direct pins for the shared grammar helpers. requirements.ts and
 * prereqTree.ts both split through these, so this file is the single
 * place where MIT's comma/slash precedence is stated as data.
 */

describe("splitTopLevel", () => {
  it("splits on the separator at depth zero", () => {
    expect(splitTopLevel("a,b,c", ",")).toEqual(["a", "b", "c"]);
  });

  it("ignores separators inside parentheses", () => {
    expect(splitTopLevel("a,(b,c),d", ",")).toEqual(["a", "(b,c)", "d"]);
  });

  it("handles nested parentheses", () => {
    expect(splitTopLevel("(a,(b,c)),d", ",")).toEqual(["(a,(b,c))", "d"]);
  });

  it("drops empty parts", () => {
    expect(splitTopLevel("a,,b", ",")).toEqual(["a", "b"]);
    expect(splitTopLevel("", ",")).toEqual([]);
  });

  it("returns the whole string when the separator is absent", () => {
    expect(splitTopLevel("6.0001", ",")).toEqual(["6.0001"]);
  });

  it("preserves whitespace around parts", () => {
    expect(splitTopLevel("18.03, 6.041", ",")).toEqual(["18.03", " 6.041"]);
  });
});

describe("stripOuterParens", () => {
  it("removes parentheses that wrap the whole string, layer by layer", () => {
    expect(stripOuterParens("(a)")).toBe("a");
    expect(stripOuterParens("((a))")).toBe("a");
  });

  it("leaves side-by-side groups alone", () => {
    expect(stripOuterParens("(a),(b)")).toBe("(a),(b)");
    expect(stripOuterParens("(a)(b)")).toBe("(a)(b)");
  });

  it("leaves unbalanced input alone", () => {
    expect(stripOuterParens("(a")).toBe("(a");
    expect(stripOuterParens("a)")).toBe("a)");
  });

  it("reduces the empty group to the empty string", () => {
    expect(stripOuterParens("()")).toBe("");
  });
});

describe("splitReqLevel precedence", () => {
  it("comma binds loose: A,B/C is ALL of A and (B/C)", () => {
    expect(splitReqLevel("18.03, 6.041/6.3700")).toEqual({
      connective: "all",
      parts: ["18.03", " 6.041/6.3700"],
      stripped: "18.03, 6.041/6.3700",
    });
  });

  it("slash binds tight: a slash list with no commas is ANY", () => {
    expect(splitReqLevel("6.041/6.3700")).toEqual({
      connective: "any",
      parts: ["6.041", "6.3700"],
      stripped: "6.041/6.3700",
    });
  });

  it("an atom has no connective", () => {
    expect(splitReqLevel("8.01")).toEqual({
      connective: null,
      parts: ["8.01"],
      stripped: "8.01",
    });
  });

  it("strips whole-string parentheses before splitting", () => {
    expect(splitReqLevel("(6.0001, 6.0002)")).toEqual({
      connective: "all",
      parts: ["6.0001", " 6.0002"],
      stripped: "6.0001, 6.0002",
    });
  });

  it("keeps parenthesized operands atomic at their level", () => {
    expect(splitReqLevel("(6.0001/6.0002), 18.03")).toEqual({
      connective: "all",
      parts: ["(6.0001/6.0002)", " 18.03"],
      stripped: "(6.0001/6.0002), 18.03",
    });
  });

  it("returns no parts for the empty string", () => {
    expect(splitReqLevel("")).toEqual({
      connective: null,
      parts: [],
      stripped: "",
    });
  });
});
