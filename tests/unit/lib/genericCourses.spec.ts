import { describe, expect, it } from "vitest";
import {
  buildIndex,
  parseGenericCourses,
} from "../../../src/lib/genericCourses";
import { SUBJECTS } from "./fixtures";

describe("parseGenericCourses", () => {
  const generics = parseGenericCourses(SUBJECTS);

  it("creates 8 GIRs + 8 HASS (4 plain + 4 CI-H) + 2 CI", () => {
    expect(generics).toHaveLength(18);
    const ids = generics.map((g) => g.subject_id);
    for (const gir of [
      "PHY1",
      "PHY2",
      "CHEM",
      "BIOL",
      "CAL1",
      "CAL2",
      "LAB",
      "REST",
    ]) {
      expect(ids).toContain(gir);
    }
    for (const hass of ["HASS-A", "HASS-S", "HASS-H", "HASS-E"]) {
      expect(ids).toContain(hass);
      expect(ids).toContain("CI-H " + hass);
    }
    expect(ids).toContain("CI-H");
    expect(ids).toContain("CI-HW");
  });

  it("aggregates offered-terms across matching subjects", () => {
    const phy1 = generics.find((g) => g.subject_id === "PHY1")!;
    // 8.01 in fixtures is offered fall+spring
    expect(phy1.offered_fall).toBe(true);
    expect(phy1.offered_spring).toBe(true);
    expect(phy1.offered_IAP).toBe(false);
  });

  it("averages hours over matching subjects", () => {
    const phy1 = generics.find((g) => g.subject_id === "PHY1")!;
    expect(phy1.in_class_hours).toBe(5);
    expect(phy1.out_of_class_hours).toBe(9);
  });

  it("defaults to 12 units with a helpful description", () => {
    const calc = generics.find((g) => g.subject_id === "CAL1")!;
    expect(calc.total_units).toBe(12);
    expect(calc.description).toContain("generic subject");
    expect(calc.gir_attribute).toBe("CAL1");
  });
});

describe("buildIndex", () => {
  it("maps subject ids to indices", () => {
    const index = buildIndex(SUBJECTS);
    expect(SUBJECTS[index["8.01"]].subject_id).toBe("8.01");
    expect(SUBJECTS[index["6.006"]].subject_id).toBe("6.006");
  });
});
