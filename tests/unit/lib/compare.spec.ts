import { describe, expect, it } from "vitest";
import {
  diffClasses,
  diffPrograms,
  diffTermLoads,
  totalUnits,
} from "../../../src/lib/compare";
import { newRoad } from "../../../src/lib/roads";
import { makeCatalog, placed } from "./fixtures";

const catalog = makeCatalog();

function roadWith(programs: string[], classes: { id: string; sem: number }[]) {
  const road = newRoad("test", programs);
  for (const { id, sem } of classes) {
    road.contents.selectedSubjects[sem].push(placed(id, sem));
  }
  return road.contents;
}

describe("diffClasses", () => {
  it("finds classes unique to each road and shared", () => {
    const a = roadWith(
      [],
      [
        { id: "8.01", sem: 1 },
        { id: "18.01", sem: 1 },
      ],
    );
    const b = roadWith(
      [],
      [
        { id: "8.01", sem: 1 },
        { id: "6.006", sem: 4 },
      ],
    );
    const diff = diffClasses(a, b);
    expect(diff.onlyInA.map((s) => s.subject_id)).toEqual(["18.01"]);
    expect(diff.onlyInB.map((s) => s.subject_id)).toEqual(["6.006"]);
    expect(diff.shared).toEqual(["8.01"]);
  });

  it("dedupes repeated subjects", () => {
    const a = roadWith(
      [],
      [
        { id: "8.01", sem: 1 },
        { id: "8.01", sem: 2 },
      ],
    );
    const b = roadWith([], []);
    expect(diffClasses(a, b).onlyInA.map((s) => s.subject_id)).toEqual([
      "8.01",
    ]);
  });
});

describe("diffTermLoads + totalUnits", () => {
  it("computes per-term units for both roads", () => {
    const a = roadWith([], [{ id: "8.01", sem: 1 }]); // 12 units
    const b = roadWith(
      [],
      [
        { id: "8.01", sem: 1 },
        { id: "18.01", sem: 1 },
      ],
    ); // 24 units
    const deltas = diffTermLoads(a, b, catalog);
    expect(deltas[1].unitsA).toBe(12);
    expect(deltas[1].unitsB).toBe(24);
    expect(totalUnits(a, catalog)).toBe(12);
    expect(totalUnits(b, catalog)).toBe(24);
  });
});

describe("diffPrograms", () => {
  it("splits programs by membership", () => {
    const a = roadWith(["girs", "major6-3"], []);
    const b = roadWith(["girs", "minor18"], []);
    const diff = diffPrograms(a, b);
    expect(diff.shared).toEqual(["girs"]);
    expect(diff.onlyInA).toEqual(["major6-3"]);
    expect(diff.onlyInB).toEqual(["minor18"]);
  });
});
