/**
 * Units and expected-hours math for a semester bucket.
 *
 * Ported exactly from Semester.vue's `semesterInformation` computed
 * property: expected hours are in-class + out-of-class, falling back to
 * total units when hours are unknown; half-term (quartered) classes are
 * bucketed into quarter 1/2 and the semester total is the max of the two
 * quarter totals.
 */

import type { CatalogView, SelectedSubject, Subject } from "./types";
import { getSubject } from "./types";

export interface SubjectHours {
  subject_id: string;
  hours: number;
}

export interface SemesterInformation {
  totalUnits: number;
  totalExpectedHours: number;
  anyClassInSingleQuarter: boolean;
  expectedHoursQuarter1: SubjectHours[];
  expectedHoursQuarter2: SubjectHours[];
  totalExpectedHoursQuarter1: number;
  totalExpectedHoursQuarter2: number;
}

/**
 * Resolve the catalog entry (or custom-activity stand-in) used for
 * units/hours math for each selected subject; unknown ids are dropped.
 */
function resolveClassesInfo(
  semesterSubjects: SelectedSubject[],
  catalog: CatalogView,
): Subject[] {
  return semesterSubjects
    .map((subj) => {
      if (subj.public === false) {
        return { ...subj, total_units: subj.units } as Subject;
      }
      return getSubject(catalog, subj.subject_id);
    })
    .filter((subj): subj is Subject => subj !== undefined);
}

/**
 * Total weekly hours: in-class + out-of-class, falling back to units when
 * the catalog has no hours data, then to 0. A subject carrying only one
 * of the two halves also takes the units fallback (NaN sum), pinned in
 * hours.spec.ts. For display, where a guessed number would mislead, use
 * subjectHoursLabel.
 */
export function subjectTotalHours(subject: Subject): number {
  const hours =
    (subject.in_class_hours ?? NaN) + (subject.out_of_class_hours ?? NaN);
  if (!Number.isNaN(hours)) {
    return hours;
  }
  const units = subject.total_units ?? NaN;
  return Number.isNaN(units) ? 0 : units;
}

/**
 * Hours as display copy: the rounded total, or null when the catalog has
 * no hours data (no fallback; a units-based guess is not shown).
 */
export function subjectHoursLabel(subject: Subject): string | null {
  if (
    subject.in_class_hours === undefined &&
    subject.out_of_class_hours === undefined
  ) {
    return null;
  }
  const total =
    (subject.in_class_hours ?? 0) + (subject.out_of_class_hours ?? 0);
  return total > 0 ? total.toFixed(0) : null;
}

function expectedHours(subj: Subject): SubjectHours {
  return { hours: subjectTotalHours(subj), subject_id: subj.subject_id };
}

function isInQuarter(subj: Subject, quarter: number): boolean {
  return (
    subj.quarter_information === undefined ||
    parseInt(subj.quarter_information.split(",")[0]) === quarter
  );
}

/** Compute units and quarter-aware expected hours for one bucket. */
export function semesterInformation(
  semesterSubjects: SelectedSubject[],
  catalog: CatalogView,
): SemesterInformation {
  const classesInfo = resolveClassesInfo(semesterSubjects, catalog);
  const totalUnits = classesInfo.reduce((units, subj) => {
    const tu = subj.total_units ?? 0;
    return units + (Number.isNaN(tu) ? 0 : tu);
  }, 0);
  const sumExpectedHours = (hours: number, subj: SubjectHours) =>
    hours + subj.hours;
  const expectedHoursQuarter1 = classesInfo
    .filter((s) => isInQuarter(s, 0))
    .map(expectedHours);
  const totalExpectedHoursQuarter1 = expectedHoursQuarter1.reduce(
    sumExpectedHours,
    0,
  );
  const expectedHoursQuarter2 = classesInfo
    .filter((s) => isInQuarter(s, 1))
    .map(expectedHours);
  const totalExpectedHoursQuarter2 = expectedHoursQuarter2.reduce(
    sumExpectedHours,
    0,
  );
  const totalExpectedHours = Math.max(
    totalExpectedHoursQuarter1,
    totalExpectedHoursQuarter2,
  );
  const anyClassInSingleQuarter = classesInfo.some(
    (s) => s.quarter_information !== undefined,
  );

  return {
    totalUnits,
    totalExpectedHours,
    anyClassInSingleQuarter,
    expectedHoursQuarter1,
    expectedHoursQuarter2,
    totalExpectedHoursQuarter1,
    totalExpectedHoursQuarter2,
  };
}
