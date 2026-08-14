import { describe, expect, it } from "vitest";
import {
  assignListIDs,
  isIgnored,
  isPetitioned,
  sortCoursesList,
} from "../../../src/lib/audit";
import type { ReqListEntry, RequirementNode } from "../../../src/lib/types";

function entry(key: string, title: string): ReqListEntry {
  return {
    key,
    "list-id": key,
    "short-title": title,
    "medium-title": title,
  };
}

describe("sortCoursesList", () => {
  it("orders majors numerically first, then minors, then others", () => {
    const list = [
      entry("girs", "GIRs"),
      entry("minor21M", "21M Minor"),
      entry("major18", "18 Major"),
      entry("major6-3", "6-3 Major"),
      entry("major2", "2 Major"),
    ];
    const sorted = sortCoursesList(list).map((c) => c.key);
    expect(sorted).toEqual([
      "major2",
      "major6-3",
      "major18",
      "minor21M",
      "girs",
    ]);
  });

  it("reads a trailing letter as part of the course number", () => {
    const list = [
      entry("major21M", "21M Major"),
      entry("major6", "6 Major"),
      entry("major18", "18 Major"),
    ];
    expect(sortCoursesList(list).map((c) => c.key)).toEqual([
      "major6",
      "major18",
      "major21M",
    ]);
  });

  it("breaks a numeric tie by the full title", () => {
    const list = [
      entry("major6-2", "6-2 Major"),
      entry("major6-1", "6-1 Major"),
    ];
    expect(sortCoursesList(list).map((c) => c.key)).toEqual([
      "major6-1",
      "major6-2",
    ]);
  });

  it("keeps non-numeric majors after numeric ones, in input order", () => {
    const list = [
      entry("majorWGS", "wgs Major"),
      entry("majorCMS", "cms Major"),
      entry("major18", "18 Major"),
    ];
    // Non-numeric pairs compare as equal (legacy comparator), so their
    // input order is preserved by the stable sort.
    expect(sortCoursesList(list).map((c) => c.key)).toEqual([
      "major18",
      "majorWGS",
      "majorCMS",
    ]);
  });
});

describe("assignListIDs", () => {
  it("strips .reql, assigns hierarchical ids and unique keys", () => {
    const tree: RequirementNode = {
      "list-id": "major6.reql",
      reqs: [{ reqs: [{ req: "6.0001" }], "list-id": "x" }, { req: "8.01" }],
    };
    assignListIDs(tree, 0);
    expect(tree["list-id"]).toBe("major6");
    expect(tree.uniqueKey).toBe("0-major6");
    expect(tree.reqs![0]["list-id"]).toBe("major6.0");
    expect(tree.reqs![0].reqs![0]["list-id"]).toBe("major6.0.0");
    expect(tree.reqs![1]["list-id"]).toBe("major6.1");
  });
});

describe("petition state", () => {
  const assertions = {
    "major6.0": { substitutions: ["8.01"] },
    "major6.1": { ignore: true },
  };

  it("detects petitioned requirements", () => {
    expect(isPetitioned(assertions, "major6.0")).toBe(true);
    expect(isPetitioned(assertions, "major6.1")).toBe(false);
    expect(isPetitioned(assertions, "major6.2")).toBe(false);
    expect(isPetitioned(assertions, undefined)).toBe(false);
  });

  it("detects ignored requirements", () => {
    expect(isIgnored(assertions, "major6.1")).toBe(true);
    expect(isIgnored(assertions, "major6.0")).toBe(false);
    expect(isIgnored(assertions, "nope")).toBe(false);
  });
});
