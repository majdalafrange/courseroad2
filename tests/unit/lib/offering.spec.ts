import { describe, expect, it } from "vitest";
import {
  baseYear,
  defaultCurrentSemester,
  dropAllowed,
  isSameYear,
  lateSchedule,
  noLongerOffered,
  notCurrentlyOffered,
  offeredInSemesterType,
  placementStatus,
  scheduledSemester,
  semesterCalendarYear,
  semesterType,
  semesterTypeShort,
  semesterYearName,
  userYearFromSemester,
  offeredSeasonLetters,
  placementEligibility,
} from "../../../src/lib/offering";
import { makeSubject } from "./fixtures";

describe("semester math", () => {
  it("maps bucket indices to types", () => {
    expect(semesterType(0)).toBe("Prior Credit");
    expect(semesterType(1)).toBe("Fall");
    expect(semesterType(2)).toBe("IAP");
    expect(semesterType(3)).toBe("Spring");
    expect(semesterType(4)).toBe("Fall");
    expect(semesterType(15)).toBe("Spring");
  });

  it("maps bucket indices to year names", () => {
    expect(semesterYearName(0)).toBe("");
    expect(semesterYearName(1)).toBe("Freshman");
    expect(semesterYearName(3)).toBe("Freshman");
    expect(semesterYearName(4)).toBe("Sophomore");
    expect(semesterYearName(13)).toBe("Fifth Year");
  });

  it("computes short types for hydrant", () => {
    expect(semesterTypeShort(0)).toBe("");
    expect(semesterTypeShort(1)).toBe("f");
    expect(semesterTypeShort(2)).toBe("i");
    expect(semesterTypeShort(3)).toBe("s");
  });

  it("derives user year from current semester", () => {
    expect(userYearFromSemester(1)).toBe(0);
    expect(userYearFromSemester(3)).toBe(0);
    expect(userYearFromSemester(4)).toBe(1);
    expect(userYearFromSemester(13)).toBe(4);
  });

  it("computes base year with the June rollover", () => {
    // Before June: base year is the current year
    expect(baseYear(0, new Date(2026, 4, 1))).toBe(2026);
    // June onward: next year
    expect(baseYear(0, new Date(2026, 5, 1))).toBe(2027);
    // Subtracts user year
    expect(baseYear(2, new Date(2026, 4, 1))).toBe(2024);
  });

  it("computes calendar years per bucket (baseYear = freshman spring)", () => {
    // Freshman fall is labeled baseYear - 1 ("Fall '25" for base 2026)
    expect(semesterCalendarYear(1, 2026)).toBe(2025);
    // Freshman IAP/Spring and sophomore fall share the base year
    expect(semesterCalendarYear(2, 2026)).toBe(2026);
    expect(semesterCalendarYear(3, 2026)).toBe(2026);
    expect(semesterCalendarYear(4, 2026)).toBe(2026);
    expect(semesterCalendarYear(5, 2026)).toBe(2027);
    expect(semesterCalendarYear(0, 2026)).toBe("");
  });

  it("detects same academic year", () => {
    expect(isSameYear(1, 1)).toBe(true);
    expect(isSameYear(3, 1)).toBe(true);
    expect(isSameYear(4, 1)).toBe(false);
  });

  it("advances the scheduled semester in May", () => {
    expect(scheduledSemester(3, new Date(2026, 4, 1))).toBe(4);
    expect(scheduledSemester(3, new Date(2026, 3, 1))).toBe(3);
  });

  it("defaults the current semester by month", () => {
    expect(defaultCurrentSemester(new Date(2026, 6, 1))).toBe(1); // July → Fall
    expect(defaultCurrentSemester(new Date(2026, 0, 1))).toBe(3); // Jan → Spring
    expect(defaultCurrentSemester(new Date(2026, 11, 1))).toBe(3); // Dec → Spring
  });
});

describe("offering rules", () => {
  it("flags historical subjects after their last offering", () => {
    const subj = makeSubject({
      is_historical: true,
      source_semester: "fall-2024",
    });
    // baseYear 2024 → last semester number = (0+1)*3+0+1 = 4 (sophomore fall)
    expect(noLongerOffered(subj, 5, 2024)).toBe(true);
    expect(noLongerOffered(subj, 4, 2024)).toBe(false);
    expect(noLongerOffered(makeSubject({}), 10, 2024)).toBe(false);
  });

  it("flags not-offered-this-year subjects in the matching buckets", () => {
    const subj = makeSubject({ not_offered_year: "2026-2027" });
    // base year 2027: bucket 1 = Fall '26, buckets 2/3 = IAP/Spring '27
    expect(notCurrentlyOffered(subj, 1, 2027)).toBe(true);
    expect(notCurrentlyOffered(subj, 2, 2027)).toBe(true);
    expect(notCurrentlyOffered(subj, 3, 2027)).toBe(true);
    // bucket 4 = Fall '27 → the next school year
    expect(notCurrentlyOffered(subj, 4, 2027)).toBe(false);
  });

  it("checks seasonal offering", () => {
    const fallOnly = makeSubject({
      offered_fall: true,
      offered_spring: false,
    });
    expect(offeredInSemesterType(fallOnly, 1)).toBe(true);
    expect(offeredInSemesterType(fallOnly, 3)).toBe(false);
    expect(offeredInSemesterType(fallOnly, 0)).toBe(true); // Prior credit
  });

  it("classifies placement eligibility like the legacy color coding", () => {
    const fallOnly = makeSubject({
      offered_fall: true,
      offered_IAP: false,
      offered_spring: false,
    });
    expect(placementStatus(fallOnly, 1, 1, 2026).kind).toBe("ok");
    expect(placementStatus(fallOnly, 0, 1, 2026).kind).toBe("ok");
    // same academic year, not offered → unavailable (red)
    expect(placementStatus(fallOnly, 3, 1, 2026).kind).toBe("unavailable");
    // later year, not offered → maybe (yellow)
    expect(placementStatus(fallOnly, 6, 1, 2026).kind).toBe("maybe");
    const historical = makeSubject({
      is_historical: true,
      source_semester: "spring-2025",
    });
    expect(placementStatus(historical, 10, 1, 2024).kind).toBe(
      "no-longer-offered",
    );
  });

  it("allows drops everywhere except red buckets", () => {
    const fallOnly = makeSubject({
      offered_fall: true,
      offered_IAP: false,
      offered_spring: false,
    });
    expect(dropAllowed(fallOnly, 1, 1, 2026)).toBe(true);
    expect(dropAllowed(fallOnly, 3, 1, 2026)).toBe(false);
    expect(dropAllowed(fallOnly, 6, 1, 2026)).toBe(true);
    expect(dropAllowed(fallOnly, 0, 1, 2026)).toBe(true);
  });

  it("computes late-schedule warnings around cutoffs", () => {
    const noSchedule = makeSubject({ offered_fall: true });
    // June 1: past the May-15 fall cutoff, scheduling fall → late
    expect(lateSchedule(noSchedule, {}, new Date(2026, 5, 1))).toBe(true);
    // May 1: before the cutoff
    expect(lateSchedule(noSchedule, {}, new Date(2026, 4, 1))).toBe(false);
    // has a schedule → never late
    expect(
      lateSchedule(
        makeSubject({ offered_fall: true, schedule: "MWF10" }),
        {},
        new Date(2026, 5, 1),
      ),
    ).toBe(false);
    // generic subjects exempt
    expect(
      lateSchedule(
        noSchedule,
        { [noSchedule.subject_id]: 0 },
        new Date(2026, 5, 1),
      ),
    ).toBe(false);
    // spring scheduling: January 1 is past the Dec-15 cutoff of last year
    const springSubj = makeSubject({ offered_spring: true });
    expect(lateSchedule(springSubj, {}, new Date(2026, 0, 1))).toBe(true);
  });
});

describe("placementEligibility", () => {
  it("returns one status kind per bucket", () => {
    const kinds = placementEligibility(makeSubject({}), 1, 2026);
    expect(kinds).toHaveLength(16);
    // Prior Credit accepts anything; a Fall/Spring subject is unavailable
    // in the IAP buckets.
    expect(kinds[0]).not.toBe("unavailable");
    expect(kinds[2]).toBe("unavailable");
  });
});

describe("offeredSeasonLetters", () => {
  it("maps the offering flags to season letters in term order", () => {
    expect(offeredSeasonLetters(makeSubject({}))).toEqual(["F", "S"]);
    expect(offeredSeasonLetters(makeSubject({ offered_IAP: true }))).toEqual([
      "F",
      "I",
      "S",
    ]);
    expect(
      offeredSeasonLetters(
        makeSubject({ offered_fall: false, offered_spring: false }),
      ),
    ).toEqual([]);
  });
});

describe("summer offerings", () => {
  it("offered_summer never implies IAP availability", () => {
    // The season index reads only [offered_fall, offered_IAP,
    // offered_spring]; summer has no bucket of its own and must not leak
    // into IAP. Bucket 2 is the first IAP.
    const summerOnly = makeSubject({
      subject_id: "SUM.100",
      offered_fall: false,
      offered_IAP: false,
      offered_spring: false,
      offered_summer: true,
    });
    expect(offeredInSemesterType(summerOnly, 2)).toBe(false);
    const iap = makeSubject({
      subject_id: "IAP.100",
      offered_IAP: true,
      offered_summer: false,
    });
    expect(offeredInSemesterType(iap, 2)).toBe(true);
  });
});
