/**
 * Degree fit: ordering every major and minor by how far the active road
 * already carries a student toward it.
 *
 * This module never re-derives fulfillment. The audit is FireRoad's, and
 * the ranking reads the same `/requirements/progress/` tree the audit panel
 * renders, ordering programs by FireRoad's own top-level
 * `percent_fulfilled` (the number `ProgramSection` shows as "N% complete").
 * There is no scoring model and no inference here.
 *
 * Why percent, and not a count of subjects left: a program's top-level
 * `max` is FireRoad's normalized progress scale, not a subject count.
 * 16-ENG has a 72-unit child requirement and still reports a top-level max
 * of 16, so raw counts are not comparable across programs. Percent is that
 * same ratio expressed on each program's own scale.
 *
 * For the same reason majors and minors are ranked in separate groups: a
 * minor scored out of 6 and a major scored out of 16 are not one list.
 */

import type { ReqListEntry, RequirementNode } from "./types";

export type ProgramCategory = "major" | "minor";

/** Why a program holds no ranking position. */
export type UnrankedReason =
  /** FireRoad answered, but reported no usable percentage. */
  | "no-percent"
  /** The request failed, so this program's standing is unknown. */
  | "fetch-failed";

/** One program measured against the road. */
export interface ProgramFit {
  key: string;
  title: string;
  category: ProgramCategory;
  /** FireRoad's top-level percent, 0 to 100. Absent when unranked. */
  percent?: number;
  /** FireRoad's own progress counter, on the program's own scale. */
  progress?: number;
  max?: number;
  /** `max - progress`, on the program's own scale. Absent when unranked. */
  remaining?: number;
  /** FireRoad reports every requirement satisfied. */
  complete: boolean;
  /** Already among the road's coursesOfStudy. */
  onRoad: boolean;
  unranked?: UnrankedReason;
  /** Failure detail, shown in the "could not be checked" group. */
  error?: string;
}

/** The outcome of one `/requirements/progress/` call. */
export type ProgramProbe =
  | { ok: true; tree: RequirementNode }
  | { ok: false; error: string };

export interface FitGroups {
  majors: ProgramFit[];
  minors: ProgramFit[];
  /** Programs FireRoad answered for but could not be ranked. */
  unranked: ProgramFit[];
  /** Programs whose request failed. Never silently dropped. */
  failed: ProgramFit[];
}

/**
 * Category from the program key rather than its `medium-title`.
 *
 * The key is an API identifier that is persisted inside saved roads, so it
 * cannot be reworded upstream; the title is display copy that can. Both
 * agree across all 148 entries FireRoad currently lists.
 */
export function classifyProgram(key: string): ProgramCategory | undefined {
  if (key.startsWith("major")) {
    return "major";
  }
  if (key.startsWith("minor")) {
    return "minor";
  }
  return undefined;
}

/**
 * The majors and minors worth scanning, in a stable order. Masters, GIRs,
 * NEET threads and pre-health are not degree programs a student picks here,
 * so they are left out.
 */
export function scannablePrograms(reqList: ReqListEntry[]): ReqListEntry[] {
  return reqList
    .filter((entry) => classifyProgram(entry.key) !== undefined)
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** A finite number, or undefined. Guards `"N/A"`, null, NaN and Infinity. */
function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * Fold one program's probe into a ranked (or explicitly unranked) fit.
 *
 * A program is never dropped and never defaulted to 0%: a missing or
 * unusable percentage is reported as such, because an omitted program reads
 * as an answer the scan did not actually give.
 */
export function toFit(
  entry: ReqListEntry,
  probe: ProgramProbe,
  onRoad: boolean,
): ProgramFit {
  const category = classifyProgram(entry.key);
  const base = {
    key: entry.key,
    title: entry["medium-title"] || entry.key,
    // scannablePrograms is the only caller path, so this is always set;
    // default keeps the type total rather than throwing on a stray key.
    category: category ?? "major",
    complete: false,
    onRoad,
  } satisfies ProgramFit;

  if (!probe.ok) {
    return { ...base, unranked: "fetch-failed", error: probe.error };
  }

  const tree = probe.tree;
  if (tree === null || typeof tree !== "object") {
    return {
      ...base,
      unranked: "fetch-failed",
      error: "FireRoad returned an unreadable response",
    };
  }

  const percent = finite(tree.percent_fulfilled);
  const progress = finite(tree.progress);
  const max = finite(tree.max);
  const complete = tree.fulfilled === true;

  if (percent === undefined) {
    // A finished program with no percentage still ranks: it is complete.
    if (complete) {
      return {
        ...base,
        complete: true,
        percent: 100,
        progress,
        max,
        remaining: 0,
      };
    }
    return { ...base, unranked: "no-percent" };
  }

  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const remaining =
    progress !== undefined && max !== undefined
      ? Math.max(0, max - progress)
      : undefined;

  return {
    ...base,
    complete,
    percent: clamped,
    progress,
    max,
    remaining,
  };
}

/**
 * Order one category, most nearly finished first.
 *
 * Every comparison ends in a key comparison, so an empty road (where every
 * program ties at 0%) still produces one fixed order rather than reshuffling
 * between scans.
 */
export function rankFits(fits: ProgramFit[]): ProgramFit[] {
  return fits.slice().sort((a, b) => {
    if (a.complete !== b.complete) {
      return a.complete ? -1 : 1;
    }
    const percentDiff = (b.percent ?? 0) - (a.percent ?? 0);
    if (percentDiff !== 0) {
      return percentDiff;
    }
    const aLeft = a.remaining ?? Number.POSITIVE_INFINITY;
    const bLeft = b.remaining ?? Number.POSITIVE_INFINITY;
    if (aLeft !== bLeft) {
      return aLeft - bLeft;
    }
    return a.key.localeCompare(b.key);
  });
}

/** Split measured programs into the four groups the panel renders. */
export function groupFits(fits: ProgramFit[]): FitGroups {
  const majors: ProgramFit[] = [];
  const minors: ProgramFit[] = [];
  const unranked: ProgramFit[] = [];
  const failed: ProgramFit[] = [];

  for (const fit of fits) {
    if (fit.unranked === "fetch-failed") {
      failed.push(fit);
    } else if (fit.unranked === "no-percent") {
      unranked.push(fit);
    } else if (fit.category === "minor") {
      minors.push(fit);
    } else {
      majors.push(fit);
    }
  }

  const byKey = (a: ProgramFit, b: ProgramFit) => a.key.localeCompare(b.key);
  return {
    majors: rankFits(majors),
    minors: rankFits(minors),
    unranked: unranked.sort(byKey),
    failed: failed.sort(byKey),
  };
}

/**
 * Identity of the road inputs a scan depends on, so an unchanged road can
 * reuse its results instead of re-running 133 requests.
 *
 * Covers exactly what `/requirements/progress/` reads: the placed subjects
 * (id and semester), and the petition state that overrides them.
 */
export function roadFingerprint(contents: {
  selectedSubjects: { subject_id: string; semester: number }[];
  progressOverrides: Record<string, number> | never[];
  progressAssertions: Record<string, unknown>;
}): string {
  const subjects = contents.selectedSubjects
    .map((s) => `${s.subject_id}@${s.semester}`)
    .sort()
    .join(",");
  const overrides = Array.isArray(contents.progressOverrides)
    ? ""
    : Object.keys(contents.progressOverrides)
        .sort()
        .map(
          (k) =>
            `${k}=${(contents.progressOverrides as Record<string, number>)[k]}`,
        )
        .join(",");
  const assertions = Object.keys(contents.progressAssertions)
    .sort()
    .map((k) => `${k}=${JSON.stringify(contents.progressAssertions[k])}`)
    .join(",");
  return `${subjects}|${overrides}|${assertions}`;
}
