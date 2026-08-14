/**
 * First-run seeding: a newcomer picks a class year and intended
 * program(s), and lands on a road with the obvious starting structure:
 * the canonical first-year science/math GIRs as real MIT subjects, and
 * their programs already in the audit.
 *
 * We deliberately seed *real* subjects (8.01, 18.01, …), not generic
 * placeholders: a freshman year's science/math GIRs have well-known
 * default subjects, and one real card reads far more clearly than an
 * invented "Generic Physics 1". HASS/CI requirements have no single
 * default subject, so they are left for the student to choose rather than
 * guessed at.
 */

import type { CatalogView, SelectedSubject } from "./types";
import { getSubject } from "./types";
import { emptySelectedSubjects } from "./roads";

/**
 * A conventional freshman GIR layout using real MIT subjects.
 * Bucket indices: 1 = Freshman Fall, 3 = Freshman Spring (IAP skipped).
 */
const FRESHMAN_SEED: { id: string; semester: number }[] = [
  // Freshman Fall
  { id: "18.01", semester: 1 }, // Calculus I
  { id: "8.01", semester: 1 }, // Physics I
  // Freshman Spring
  { id: "18.02", semester: 3 }, // Calculus II
  { id: "8.02", semester: 3 }, // Physics II
  { id: "5.111", semester: 3 }, // Principles of Chemical Science
];

/** Resolve a real catalog subject into a selected-subject, or skip it. */
function realSubject(
  id: string,
  semester: number,
  catalog: CatalogView,
): SelectedSubject | undefined {
  const subject = getSubject(catalog, id);
  if (subject === undefined) {
    return undefined;
  }
  return {
    overrideWarnings: false,
    semester,
    subject_id: subject.subject_id,
    title: subject.title,
    units: subject.total_units ?? 12,
  };
}

/**
 * Build the seeded selected-subjects grid for a newcomer.
 *
 * Only first-years get the GIR scaffold dropped in; later years start
 * clean (a wrong guess is more annoying than an empty grid). `userYear`
 * is 0-based. Any seed subject missing from the catalog is skipped, so a
 * partial catalog can never produce a broken card.
 */
export function seedSelectedSubjects(
  userYear: number,
  catalog: CatalogView,
): SelectedSubject[][] {
  const grid = emptySelectedSubjects();
  if (userYear !== 0) {
    return grid;
  }
  for (const { id, semester } of FRESHMAN_SEED) {
    const subject = realSubject(id, semester, catalog);
    if (subject !== undefined) {
      grid[semester].push(subject);
    }
  }
  return grid;
}

/** Courses-of-study for a newcomer: GIRs are always implied, plus picks. */
export function seedCoursesOfStudy(programs: string[]): string[] {
  const unique = new Set<string>(["girs", ...programs]);
  return [...unique];
}
