/**
 * Road comparison: the real question is "which version of my life is
 * better?" so we surface class differences, per-term load deltas, and
 * requirement-coverage deltas between two roads.
 */

import type { CatalogView, RoadContents, SelectedSubject } from "./types";
import { semesterInformation } from "./hours";
import { NUM_SEMESTERS } from "./offering";

export interface ClassDiff {
  /** subject_id present in road A but not B. */
  onlyInA: SelectedSubject[];
  /** subject_id present in road B but not A. */
  onlyInB: SelectedSubject[];
  /** in both (by subject_id). */
  shared: string[];
}

/** Set difference of two roads by subject_id (flattened across terms). */
export function diffClasses(a: RoadContents, b: RoadContents): ClassDiff {
  const flatA = a.selectedSubjects.flat();
  const flatB = b.selectedSubjects.flat();
  const idsA = new Set(flatA.map((s) => s.subject_id));
  const idsB = new Set(flatB.map((s) => s.subject_id));
  return {
    onlyInA: dedupe(flatA.filter((s) => !idsB.has(s.subject_id))),
    onlyInB: dedupe(flatB.filter((s) => !idsA.has(s.subject_id))),
    shared: [...idsA].filter((id) => idsB.has(id)).sort(),
  };
}

function dedupe(subjects: SelectedSubject[]): SelectedSubject[] {
  const seen = new Set<string>();
  return subjects.filter((s) => {
    if (seen.has(s.subject_id)) {
      return false;
    }
    seen.add(s.subject_id);
    return true;
  });
}

export interface TermLoadDelta {
  index: number;
  unitsA: number;
  unitsB: number;
  hoursA: number;
  hoursB: number;
}

/** Per-term units and hours for both roads, term by term. */
export function diffTermLoads(
  a: RoadContents,
  b: RoadContents,
  catalog: CatalogView,
): TermLoadDelta[] {
  const deltas: TermLoadDelta[] = [];
  for (let i = 0; i < NUM_SEMESTERS; i++) {
    const infoA = semesterInformation(a.selectedSubjects[i] ?? [], catalog);
    const infoB = semesterInformation(b.selectedSubjects[i] ?? [], catalog);
    deltas.push({
      index: i,
      unitsA: infoA.totalUnits,
      unitsB: infoB.totalUnits,
      hoursA: infoA.totalExpectedHours,
      hoursB: infoB.totalExpectedHours,
    });
  }
  return deltas;
}

/** Total units across all terms for a road. */
export function totalUnits(
  contents: RoadContents,
  catalog: CatalogView,
): number {
  return contents.selectedSubjects.reduce(
    (sum, bucket) => sum + semesterInformation(bucket, catalog).totalUnits,
    0,
  );
}

/** Programs in one road but not the other. */
export function diffPrograms(
  a: RoadContents,
  b: RoadContents,
): { onlyInA: string[]; onlyInB: string[]; shared: string[] } {
  const setA = new Set(a.coursesOfStudy);
  const setB = new Set(b.coursesOfStudy);
  return {
    onlyInA: a.coursesOfStudy.filter((p) => !setB.has(p)),
    onlyInB: b.coursesOfStudy.filter((p) => !setA.has(p)),
    shared: a.coursesOfStudy.filter((p) => setB.has(p)),
  };
}
