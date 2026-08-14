import { describe, expect, it } from "vitest";
import { semesterInformation } from "../../../src/lib/hours";
import { SUBJECTS, makeCatalog, makeSubject, placed } from "./fixtures";

const catalog = makeCatalog();

describe("semesterInformation", () => {
  it("sums units and uses in+out hours when available", () => {
    const info = semesterInformation(
      [placed("8.01", 1), placed("18.01", 1)],
      catalog,
    );
    expect(info.totalUnits).toBe(24);
    // 8.01: 5 + 9 = 14h; 18.01: no hours → falls back to 12 units
    expect(info.totalExpectedHours).toBeCloseTo(26);
    expect(info.anyClassInSingleQuarter).toBe(false);
  });

  it("buckets half-term classes into quarters and takes the max", () => {
    // 6.0001 is quarter 0 (6 units), 6.0002 quarter 1 (6 units),
    // 8.01 spans both (14h)
    const info = semesterInformation(
      [placed("6.0001", 1), placed("6.0002", 1), placed("8.01", 1)],
      catalog,
    );
    expect(info.anyClassInSingleQuarter).toBe(true);
    expect(info.totalExpectedHoursQuarter1).toBeCloseTo(6 + 14);
    expect(info.totalExpectedHoursQuarter2).toBeCloseTo(6 + 14);
    expect(info.totalExpectedHours).toBeCloseTo(20);
    expect(info.expectedHoursQuarter1.map((s) => s.subject_id)).toEqual([
      "6.0001",
      "8.01",
    ]);
    expect(info.expectedHoursQuarter2.map((s) => s.subject_id)).toEqual([
      "6.0002",
      "8.01",
    ]);
  });

  it("uses custom activity units/hours and skips unknown ids", () => {
    const custom = placed("MYJOB", 1, {
      public: false,
      units: 0,
      in_class_hours: 10,
      out_of_class_hours: 2,
    });
    const info = semesterInformation([custom, placed("NOPE.999", 1)], catalog);
    expect(info.totalUnits).toBe(0);
    expect(info.totalExpectedHours).toBeCloseTo(12);
  });

  it("returns zeros for an empty semester", () => {
    const info = semesterInformation([], catalog);
    expect(info.totalUnits).toBe(0);
    expect(info.totalExpectedHours).toBe(0);
  });

  it("falls back to units when either hours half is missing", () => {
    // One missing half makes in+out NaN, so the units estimate covers the
    // whole subject. Pinned as deliberate estimator behavior; the display
    // path (subjectHoursLabel) treats a lone half differently on purpose.
    const halfOnly = makeSubject({
      subject_id: "HALF.1",
      total_units: 9,
      in_class_hours: 3,
    });
    const info = semesterInformation(
      [placed("HALF.1", 1, { units: 9 })],
      makeCatalog([...SUBJECTS, halfOnly]),
    );
    expect(info.totalExpectedHours).toBeCloseTo(9);
  });
});
