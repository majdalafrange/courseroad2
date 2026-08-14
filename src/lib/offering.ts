/**
 * Semester arithmetic and subject-offering rules. The road has 16
 * buckets: index 0 is Prior Credit, then 5 years of (Fall, IAP, Spring).
 * `currentSemester` (1-based, FireRoad's set_semester) anchors "now";
 * `userYear` derives from it. Ported exactly from Semester.vue/schedule.js.
 */

import type { Subject } from "./types";

export const NUM_SEMESTERS = 16;

export type SemesterKind = "Prior Credit" | "Fall" | "IAP" | "Spring";

const YEAR_NAMES = ["Freshman", "Sophomore", "Junior", "Senior", "Fifth Year"];

/** "Prior Credit", "Fall", "IAP", or "Spring" for a bucket index. */
export function semesterType(index: number): SemesterKind {
  return index === 0
    ? "Prior Credit"
    : (["Fall", "IAP", "Spring"][(index - 1) % 3] as SemesterKind);
}

/** "f" | "i" | "s" ("" for Prior Credit); used by the Hydrant link. */
export function semesterTypeShort(index: number): string {
  return index === 0 ? "" : ["f", "i", "s"][(index - 1) % 3];
}

/** "Freshman" … "Fifth Year" ("" for Prior Credit). */
export function semesterYearName(index: number): string {
  if (index === 0) {
    return "";
  }
  return YEAR_NAMES[Math.floor((index - 1) / 3)];
}

/** 0-based year-at-MIT derived from the current semester (1-based). */
export function userYearFromSemester(currentSemester: number): number {
  return Math.floor((currentSemester - 1) / 3);
}

/**
 * The calendar year of the student's freshman fall. After May (month >= 5)
 * the upcoming fall counts as the next academic year.
 */
export function baseYear(userYear: number, today: Date = new Date()): number {
  const currentYear = today.getFullYear();
  const base = today.getMonth() >= 5 ? currentYear + 1 : currentYear;
  return base - userYear;
}

/** Calendar year of a semester bucket ("" for Prior Credit). */
export function semesterCalendarYear(
  index: number,
  baseYearValue: number,
): number | "" {
  return index === 0 ? "" : Math.floor((index - 2) / 3) + baseYearValue;
}

/** Two-digit year string for a bucket, e.g. "26". */
export function semesterCalendarYearShort(
  index: number,
  baseYearValue: number,
): string {
  return semesterCalendarYear(index, baseYearValue).toString().substring(2);
}

/** Whether bucket `index` falls in the same academic year as `currentSemester`. */
export function isSameYear(index: number, currentSemester: number): boolean {
  return Math.floor((index - 1) / 3) === Math.floor((currentSemester - 1) / 3);
}

/*
 * Bucket labels. Two fixed formats, one per surface: the canvas headers
 * carry a calendar year, everything else spells the year out. The strings
 * are pinned. Change a format only with its surface.
 */

/** "Prior credit" / "Freshman Fall"; undo labels, detail copy, compare. */
export function bucketName(index: number): string {
  if (index === 0) {
    return "Prior credit";
  }
  return `${semesterYearName(index)} ${semesterType(index)}`;
}

/** "Prior credit" / "Fall ’26"; term headers on the canvas. */
export function termYearLabel(index: number, baseYearValue: number): string {
  if (index === 0) {
    return "Prior credit";
  }
  return `${semesterType(index)} ’${semesterCalendarYearShort(index, baseYearValue)}`;
}

/**
 * The bucket students are registering for next, the one that gets
 * "no schedule published yet" warnings. In May (month 4) registration has
 * moved one semester ahead.
 */
export function scheduledSemester(
  currentSemester: number,
  today: Date = new Date(),
): number {
  return today.getMonth() === 4 ? currentSemester + 1 : currentSemester;
}

/** Default current semester when logged out: Fall (1) May–Nov, Spring (3) otherwise. */
export function defaultCurrentSemester(today: Date = new Date()): number {
  const month = today.getMonth();
  return month >= 4 && month <= 10 ? 1 : 3;
}

/**
 * Whether a historical subject's last offering predates bucket `index`.
 */
export function noLongerOffered(
  course: Subject,
  index: number,
  baseYearValue: number,
): boolean {
  if (course.is_historical && course.source_semester !== undefined) {
    const lastSemester = course.source_semester.split("-");
    const sourceSemester = ["fall", "IAP", "spring"].indexOf(lastSemester[0]);
    // which class year the last year offered corresponds to;
    // +1 if fall because fall semester year is off by 1
    const sourceYear =
      parseInt(lastSemester[1]) -
      baseYearValue +
      (sourceSemester === 0 ? 1 : 0);
    const lastSemesterNumber = sourceYear * 3 + sourceSemester + 1;
    if (index > lastSemesterNumber) {
      return true;
    }
  }
  return false;
}

/**
 * Whether the subject is skipping the school year that bucket `index`
 * falls in (`not_offered_year`, e.g. "2023-2024").
 */
export function notCurrentlyOffered(
  course: Subject,
  index: number,
  baseYearValue: number,
): boolean {
  if (course.not_offered_year) {
    const year = parseInt(course.not_offered_year.slice(0, 4));
    const semYear = semesterCalendarYear(index, baseYearValue);
    const semType = semesterType(index);
    return (
      (semYear === year && semType === "Fall") ||
      (semYear === year + 1 && (semType === "IAP" || semType === "Spring"))
    );
  }
  return false;
}

/** Whether the catalog says the subject runs in bucket `index`'s season. */
export function offeredInSemesterType(course: Subject, index: number): boolean {
  const semType = (index - 1) % 3;
  if (semType < 0) {
    return true; // Prior Credit accepts anything
  }
  return Boolean(
    [course.offered_fall, course.offered_IAP, course.offered_spring][semType],
  );
}

/**
 * Whether a subject still lacks a published schedule dangerously close to
 * (or past) the registration cutoff for the semester being scheduled:
 * "may not be offered". Generic courses are exempt.
 */
export function lateSchedule(
  subj: Subject,
  genericIndex: Record<string, number>,
  compareDate: Date = new Date(),
): boolean {
  if (subj.schedule === undefined && !(subj.subject_id in genericIndex)) {
    const year = compareDate.getFullYear();
    const month = compareDate.getMonth();
    const fallCutoff = new Date(year, 4, 15);
    const springCutoff =
      month === 11 ? new Date(year, 11, 15) : new Date(year - 1, 11, 15);
    const scheduleForFall = month >= 4 && month <= 10;
    const lateForFall =
      scheduleForFall && Boolean(subj.offered_fall) && compareDate > fallCutoff;
    const lateForSpring =
      !scheduleForFall &&
      Boolean(subj.offered_spring) &&
      compareDate > springCutoff;
    return lateForFall || lateForSpring;
  }
  return false;
}

/** Placement eligibility classes used while adding/dragging a subject. */
export type PlacementStatus =
  | { kind: "ok" } // green: offered here (or Prior Credit)
  | { kind: "no-longer-offered" } // yellow
  | { kind: "not-this-year" } // yellow
  | { kind: "unavailable" } // red: same year, definitely not offered
  | { kind: "maybe" }; // yellow: other year, may not be offered

/**
 * Classify how safely `course` can be placed into bucket `index`: the
 * green/yellow/red logic of the legacy add-from-card flow, exactly.
 */
/**
 * Placement eligibility across every bucket, for the drag layer and
 * click-to-place: one status kind per bucket index.
 */
export function placementEligibility(
  course: Subject,
  currentSemester: number,
  baseYearValue: number,
): PlacementStatus["kind"][] {
  const kinds: PlacementStatus["kind"][] = [];
  for (let i = 0; i < NUM_SEMESTERS; i++) {
    kinds.push(placementStatus(course, i, currentSemester, baseYearValue).kind);
  }
  return kinds;
}

/** Season letters for compact offering badges: "F", "I", "S". */
export function offeredSeasonLetters(course: Subject): string[] {
  return [
    course.offered_fall ? "F" : null,
    course.offered_IAP ? "I" : null,
    course.offered_spring ? "S" : null,
  ].filter((letter): letter is string => letter !== null);
}

export function placementStatus(
  course: Subject,
  index: number,
  currentSemester: number,
  baseYearValue: number,
): PlacementStatus {
  const isNoLongerOffered = noLongerOffered(course, index, baseYearValue);
  const isNotThisYear = notCurrentlyOffered(course, index, baseYearValue);
  const offeredNow =
    !isNoLongerOffered &&
    !isNotThisYear &&
    offeredInSemesterType(course, index);
  if (index === 0 || offeredNow) {
    return { kind: "ok" };
  }
  if (isNoLongerOffered) {
    return { kind: "no-longer-offered" };
  }
  if (isNotThisYear) {
    return { kind: "not-this-year" };
  }
  if (isSameYear(index, currentSemester)) {
    return { kind: "unavailable" };
  }
  return { kind: "maybe" };
}

/**
 * Whether a drop into bucket `index` is accepted (anything except a
 * definite "unavailable" in the current academic year), per legacy ondrop.
 */
export function dropAllowed(
  course: Subject,
  index: number,
  currentSemester: number,
  baseYearValue: number,
): boolean {
  return (
    placementStatus(course, index, currentSemester, baseYearValue).kind !==
    "unavailable"
  );
}
