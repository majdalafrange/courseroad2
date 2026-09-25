import { describe, expect, it } from "vitest";
import {
  subjectUses,
  assignListIDs,
  isIgnored,
  isPetitioned,
  manualProgress,
  sortCoursesList,
} from "../../../src/lib/audit";
import type { ReqListEntry } from "../../../src/lib/types";
import { reqTree } from "./fixtures";

function entry(key: string, title: string): ReqListEntry {
  return {
    key,
    "short-title": title,
    "medium-title": title,
    title,
    "title-no-degree": title,
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
    // Non-numeric pairs compare as equal, so their input order is
    // preserved by the stable sort.
    expect(sortCoursesList(list).map((c) => c.key)).toEqual([
      "major18",
      "majorWGS",
      "majorCMS",
    ]);
  });
});

describe("assignListIDs", () => {
  it("strips .reql, assigns hierarchical ids and unique keys", () => {
    const tree = reqTree({
      "list-id": "major6.reql",
      reqs: [{ reqs: [{ req: "6.0001" }], "list-id": "x" }, { req: "8.01" }],
    });
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
    "major6.3": { override: 4 },
  };

  it("detects petitioned requirements", () => {
    expect(isPetitioned(assertions, "major6.0")).toBe(true);
    expect(isPetitioned(assertions, "major6.1")).toBe(false);
    expect(isPetitioned(assertions, "major6.2")).toBe(false);
    expect(isPetitioned(assertions, undefined)).toBe(false);
    // A typed count is not a substitution.
    expect(isPetitioned(assertions, "major6.3")).toBe(false);
  });

  it("reads a typed count from the assertion, then the deprecated map", () => {
    const contents = {
      progressAssertions: assertions,
      progressOverrides: { "major6.3": 1, "major6.4": 2 },
    };
    expect(manualProgress(contents, "major6.3")).toBe(4);
    expect(manualProgress(contents, "major6.4")).toBe(2);
    expect(manualProgress(contents, "major6.5")).toBeUndefined();
  });

  it("detects ignored requirements", () => {
    expect(isIgnored(assertions, "major6.1")).toBe(true);
    expect(isIgnored(assertions, "major6.0")).toBe(false);
    expect(isIgnored(assertions, "nope")).toBe(false);
  });
});

describe("subjectUses", () => {
  // Trimmed from FireRoad's 18 (General) progress for a real road.
  const tree = reqTree({
    title: "18 Major (General)",
    reqs: [
      {
        title: "Required Subjects",
        reqs: [{ req: "18.03", sat_courses: ["18.03"], fulfilled: true }],
      },
      {
        title: "Restricted Electives",
        reqs: [
          {
            reqs: [
              { req: "18.06", sat_courses: ["18.06"], fulfilled: true },
              { req: "18.701", sat_courses: ["18.701"], fulfilled: true },
            ],
          },
          {
            req: "6 subjects (first decimal ≥ 1)",
            "plain-string": true,
            sat_courses: ["18.300"],
          },
        ],
      },
      {
        title: "Communication-Intensive Subjects",
        reqs: [{ req: "18.200", sat_courses: ["18.200", "18.06"] }],
      },
    ],
  });

  it("names the requirement group each subject already counts toward", () => {
    const uses = subjectUses(tree);
    expect(uses.get("18.03")).toEqual(["Required Subjects"]);
    expect(uses.get("18.06")).toEqual([
      "Restricted Electives",
      "Communication-Intensive Subjects",
    ]);
  });

  it("ignores plain-string leaves, whose subjects are only a choice", () => {
    expect(subjectUses(tree).has("18.300")).toBe(false);
  });
});
