import { describe, expect, it } from "vitest";
import {
  seedCoursesOfStudy,
  seedSelectedSubjects,
} from "../../../src/lib/onboarding";
import type { CatalogView } from "../../../src/lib/types";

function makeCatalog(): CatalogView {
  const subjectsInfo = [
    { subject_id: "18.01", title: "Calculus I", total_units: 12 },
    { subject_id: "8.01", title: "Physics I", total_units: 12 },
    { subject_id: "18.02", title: "Calculus II", total_units: 12 },
    { subject_id: "8.02", title: "Physics II", total_units: 12 },
    {
      subject_id: "5.111",
      title: "Principles of Chemical Science",
      total_units: 12,
    },
  ];
  return {
    subjectsInfo,
    subjectsIndex: Object.fromEntries(
      subjectsInfo.map((s, i) => [s.subject_id, i]),
    ),
    genericCourses: [],
    genericIndex: {},
  } as unknown as CatalogView;
}

describe("seedSelectedSubjects", () => {
  it("scaffolds real freshman GIRs (not placeholders) for first-years", () => {
    const grid = seedSelectedSubjects(0, makeCatalog());
    expect(grid).toHaveLength(16);
    const fall = grid[1].map((s) => s.subject_id);
    const spring = grid[3].map((s) => s.subject_id);
    expect(fall).toContain("18.01");
    expect(fall).toContain("8.01");
    expect(spring).toContain("18.02");
    expect(spring).toContain("8.02");
    expect(spring).toContain("5.111");
    // real subjects carry their catalog title, never an invented "Generic …"
    expect(grid[1][0].title).toBe("Calculus I");
    expect(grid.flat().every((s) => !s.title.includes("Generic"))).toBe(true);
    expect(grid[1][0].overrideWarnings).toBe(false);
  });

  it("skips seed subjects that are absent from the catalog", () => {
    const empty = {
      subjectsInfo: [],
      subjectsIndex: {},
      genericCourses: [],
      genericIndex: {},
    } as unknown as CatalogView;
    const grid = seedSelectedSubjects(0, empty);
    expect(grid.every((bucket) => bucket.length === 0)).toBe(true);
  });

  it("leaves later years with an empty grid", () => {
    const grid = seedSelectedSubjects(2, makeCatalog());
    expect(grid.every((bucket) => bucket.length === 0)).toBe(true);
  });
});

describe("seedCoursesOfStudy", () => {
  it("always includes girs and the chosen programs, deduped", () => {
    expect(seedCoursesOfStudy(["major6-3"])).toEqual(["girs", "major6-3"]);
    expect(seedCoursesOfStudy(["girs", "minor18"])).toEqual([
      "girs",
      "minor18",
    ]);
    expect(seedCoursesOfStudy([])).toEqual(["girs"]);
  });
});
