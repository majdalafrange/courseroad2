/**
 * Per-class warning computation for a semester bucket. Ported exactly
 * from Semester.vue's `warnings`, including the quarter-aware
 * prerequisite window (a second-half-term class may use first-half-term
 * classes in the same semester as prereqs).
 *
 * WARNING: these strings render as HTML. They only ever embed FireRoad
 * catalog data. Never user input from custom activities (skipped
 * entirely). Keep it that way to avoid XSS.
 */

import type { CatalogView, SelectedSubject, Subject } from "./types";
import { flatten } from "./types";
import {
  lateSchedule,
  noLongerOffered,
  notCurrentlyOffered,
  semesterType,
} from "./offering";
import {
  cheapestBranch,
  isGroup,
  parseRequirements,
  unionUnmetIds,
  type ParsedLeaf,
  type ParsedRequirement,
} from "./prereqTree";
import { reqsFulfilled } from "./requirements";

/**
 * Escape a value before embedding it in a warning's HTML string. Catalog
 * data is trusted content but a compromised/MITM'd FireRoad response is in
 * scope, so escaping here is defense-in-depth against a hostile field like
 * `not_offered_year: "<img src=x onerror=...>"` reaching ClassCard's v-html.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface WarningContext {
  catalog: CatalogView;
  /** All 16 buckets of the active road. */
  selectedSubjects: SelectedSubject[][];
  /** Bucket index being checked. */
  index: number;
  baseYear: number;
  /** Bucket currently being registered for (see scheduledSemester). */
  scheduledSemesterIndex: number;
  now?: Date;
}

/** Subjects available "concurrently" for coreq checking: this bucket and all before it. */
export function concurrentSubjects(
  selectedSubjects: SelectedSubject[][],
  index: number,
): SelectedSubject[] {
  return flatten(selectedSubjects.slice(0, index + 1));
}

/**
 * Subjects usable as prerequisites for `subj` in bucket `index`: everything
 * in earlier buckets, plus first-half-quarter classes in the same bucket if
 * `subj` runs in the second half.
 */
export function previousSubjects(
  catalog: CatalogView,
  selectedSubjects: SelectedSubject[][],
  index: number,
  subj: Subject,
): SelectedSubject[] {
  const subjInQuarter2 =
    subj.quarter_information !== undefined &&
    subj.quarter_information.split(",")[0] === "1";
  const beforeThisSemester = flatten(selectedSubjects.slice(0, index));
  const previousQuarter = selectedSubjects[index].filter((s) => {
    const subj2 = catalog.subjectsInfo[catalog.subjectsIndex[s.subject_id]];
    let inPreviousQuarter = false;
    if (subj2 !== undefined) {
      inPreviousQuarter =
        s.semester === index &&
        subjInQuarter2 &&
        subj2.quarter_information !== undefined &&
        subj2.quarter_information.split(",")[0] === "0";
    }
    return inPreviousQuarter;
  });
  return beforeThisSemester.concat(previousQuarter);
}

interface UnmetResult {
  /** Unmet requirement tokens, in tree order. */
  ids: string[];
  /** Fulfilled leaves under the node, for the any-branch tie-break. */
  fulfilledLeaves: number;
}

/**
 * The smallest set of unmet requirement tokens under a parsed node:
 * all-groups union their children, any-groups take the cheapest branch.
 * The branch choice and union are shared with connections/readiness.ts
 * (cheapestBranch, unionUnmetIds); this variant names tokens as data,
 * GIR: prefixes and all, without the readiness catalog resolution.
 */
function smallestUnmet(node: ParsedRequirement | ParsedLeaf): UnmetResult {
  if (!isGroup(node)) {
    if (node.fulfilled === true) {
      return { ids: [], fulfilledLeaves: 1 };
    }
    return { ids: [node.subject_id], fulfilledLeaves: 0 };
  }
  const children = node.reqs.map(smallestUnmet);
  if (node.connectionType === "any" && children.length > 1) {
    const cheapest = cheapestBranch(children);
    if (cheapest !== undefined) {
      return cheapest;
    }
  }
  // "all" groups and single-child levels: union the children
  const fulfilledLeaves = children.reduce(
    (total, child) => total + child.fulfilledLeaves,
    0,
  );
  return { ids: unionUnmetIds(children), fulfilledLeaves };
}

/** Compute the warning strings (HTML) for one subject in a bucket. */
export function subjectWarnings(
  classItem: SelectedSubject,
  ctx: WarningContext,
): string[] {
  const warnings: string[] = [];
  if (classItem.public === false) {
    // Suppress warnings for custom subjects
    return warnings;
  }
  const { catalog, selectedSubjects, index } = ctx;
  const subjID = classItem.subject_id;
  let subj: Subject | undefined;
  if (subjID in catalog.subjectsIndex) {
    subj = catalog.subjectsInfo[catalog.subjectsIndex[subjID]];
    const prereqString = subj.prerequisites;
    const coreqString = subj.corequisites;
    let prereqsfulfilled = true;
    let coreqsfulfilled = true;
    let missingPrereqs: string[] = [];
    if (prereqString !== undefined) {
      const prereqWindow =
        index > 0
          ? previousSubjects(catalog, selectedSubjects, index, subj)
          : concurrentSubjects(selectedSubjects, index);
      prereqsfulfilled = reqsFulfilled(catalog, prereqString, prereqWindow);
      if (!prereqsfulfilled) {
        // Same window as the check above, handed to the parser as one
        // bucket, so the named set can never disagree with the flag on
        // quarter placement. (createReadinessEvaluator evaluates against
        // the current semester and is not quarter-aware; do not use it
        // here.)
        const tree = parseRequirements(
          prereqString,
          catalog,
          [prereqWindow],
          1,
        );
        missingPrereqs = smallestUnmet(tree).ids;
      }
    }
    if (coreqString !== undefined) {
      coreqsfulfilled = reqsFulfilled(
        catalog,
        coreqString,
        concurrentSubjects(selectedSubjects, index),
      );
    }
    if (subj.either_prereq_or_coreq) {
      if (!(prereqsfulfilled || coreqsfulfilled)) {
        warnings.push(
          "<b>Unsatisfied corequisite or prerequisite</b>: You must satisfy either the prerequisites or corequisites for this subject.",
        );
      }
    } else {
      if (!prereqsfulfilled) {
        if (missingPrereqs.length > 0) {
          // Up to four ids, then "+ more" (the TermPicker precedent).
          const listed = missingPrereqs.slice(0, 4).map(escapeHtml).join(", ");
          const more = missingPrereqs.length > 4 ? " + more" : "";
          warnings.push(
            `<b>Unsatisfied prerequisite</b>: Missing ${listed}${more}.`,
          );
        } else {
          warnings.push(
            "<b>Unsatisfied prerequisite</b>: One or more prerequisites are not yet fulfilled.",
          );
        }
      }
      if (!coreqsfulfilled) {
        warnings.push(
          "<b>Unsatisfied corequisite</b>: One or more corequisites are not yet fulfilled.",
        );
      }
    }
    if (
      index === ctx.scheduledSemesterIndex &&
      lateSchedule(subj, catalog.genericIndex, ctx.now)
    ) {
      warnings.push(
        "<b>No schedule</b>: Classes that do not yet have a schedule may not be offered.",
      );
    }
  } else if (subjID in catalog.genericIndex) {
    subj = catalog.genericCourses[catalog.genericIndex[subjID]];
  }
  if (subj !== undefined) {
    const semType = (index - 1) % 3;
    // WARNING: warning strings embed catalog info and are rendered as HTML;
    // never inject user input here (see module docstring).
    if (noLongerOffered(subj, index, ctx.baseYear)) {
      const lastSemester = (subj.source_semester ?? "").split("-");
      warnings.push(
        "<b>Not offered</b>: This subject is no longer offered (last offered " +
          escapeHtml(lastSemester.join(" ")) +
          ").",
      );
    } else if (notCurrentlyOffered(subj, index, ctx.baseYear)) {
      warnings.push(
        `<b>Not offered</b>: This subject is not offered for the ${escapeHtml(
          subj.not_offered_year,
        )} school year.`,
      );
    } else if (semType >= 0) {
      const isUsuallyOffered = [
        subj.offered_fall,
        subj.offered_IAP,
        subj.offered_spring,
      ][semType];
      if (!isUsuallyOffered) {
        warnings.push(
          "<b>Not offered</b>: According to the subject catalog, " +
            escapeHtml(subjID) +
            " is not usually offered in " +
            semesterType(index) +
            ".",
        );
      }
    }
  }
  return warnings;
}

/** Warnings for every subject in bucket `index`, in order. */
export function semesterWarnings(ctx: WarningContext): string[][] {
  return ctx.selectedSubjects[ctx.index].map((classItem) =>
    subjectWarnings(classItem, ctx),
  );
}
