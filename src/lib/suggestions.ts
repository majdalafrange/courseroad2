/**
 * Rule-based class suggestions: connects audit gaps to the catalog using
 * data the app already has (unfulfilled attribute requirements, offered
 * terms, ratings, hours) and per-term load. No external AI. Scope is
 * deliberately narrow: attribute-style requirements (HASS-A/S/H/E,
 * CI-H/HW, GIR:LAB/REST) where "any subject with this attribute" is a
 * meaningful answer. Specific-subject requirements ("take 6.1200")
 * aren't suggestion-shaped; the audit already names them.
 */

import type {
  CatalogView,
  RequirementNode,
  SelectedSubject,
  Subject,
} from "./types";
import { semesterInformation, subjectTotalHours } from "./hours";
import { NUM_SEMESTERS, scheduledSemester, semesterType } from "./offering";

/** An attribute requirement we know how to suggest classes for. */
interface AttributeGap {
  /** The requirement token, e.g. "HASS-A" or "GIR:LAB". */
  attribute: string;
  /** How it reads in a sentence: "HASS-A (arts)", "Lab GIR", no article;
      the headline templates add "a" where the grammar needs it. */
  label: string;
  /** How many more are needed (best-effort from the threshold). */
  remaining: number;
  /** Predicate: does this subject carry the attribute? */
  matches: (subject: Subject) => boolean;
}

const ATTRIBUTE_GAPS: Record<string, Omit<AttributeGap, "remaining">> = {
  "HASS-A": {
    attribute: "HASS-A",
    label: "HASS-A (arts)",
    matches: (s) => (s.hass_attribute ?? "").split(",").includes("HASS-A"),
  },
  "HASS-S": {
    attribute: "HASS-S",
    label: "HASS-S (social science)",
    matches: (s) => (s.hass_attribute ?? "").split(",").includes("HASS-S"),
  },
  "HASS-H": {
    attribute: "HASS-H",
    label: "HASS-H (humanities)",
    matches: (s) => (s.hass_attribute ?? "").split(",").includes("HASS-H"),
  },
  "HASS-E": {
    attribute: "HASS-E",
    label: "HASS-E (elective)",
    matches: (s) => (s.hass_attribute ?? "").split(",").includes("HASS-E"),
  },
  "CI-H": {
    attribute: "CI-H",
    label: "CI-H",
    matches: (s) => s.communication_requirement === "CI-H",
  },
  "CI-HW": {
    attribute: "CI-HW",
    label: "CI-HW",
    matches: (s) => s.communication_requirement === "CI-HW",
  },
  "GIR:LAB": {
    attribute: "GIR:LAB",
    label: "Lab GIR",
    matches: (s) => (s.gir_attribute ?? "").includes("LAB"),
  },
  "GIR:REST": {
    attribute: "GIR:REST",
    label: "REST GIR",
    matches: (s) => (s.gir_attribute ?? "").includes("REST"),
  },
};

export interface SuggestedClass {
  subject: Subject;
  rating?: number;
  hours?: number;
}

export interface Suggestion {
  attribute: string;
  /** "2 more HASS-A still needed" */
  headline: string;
  /** The term we're recommending for, e.g. "spring". */
  term: string;
  termIndex: number;
  classes: SuggestedClass[];
  /** Filter tokens to pre-scope the command palette. */
  tokens: string[];
}

/** Walk a requirement tree collecting unfulfilled attribute leaves. */
function collectGaps(node: RequirementNode, out: Map<string, number>): void {
  if (node.reqs !== undefined) {
    for (const child of node.reqs) {
      collectGaps(child, out);
    }
    return;
  }
  if (node.fulfilled || node.req === undefined) {
    return;
  }
  if (node.req in ATTRIBUTE_GAPS) {
    out.set(node.req, (out.get(node.req) ?? 0) + 1);
  }
}

/** Whether a subject is offered in a given season ("Fall"/"IAP"/"Spring"). */
function offeredInSeason(subject: Subject, season: string): boolean {
  if (season === "Fall") return Boolean(subject.offered_fall);
  if (season === "IAP") return Boolean(subject.offered_IAP);
  if (season === "Spring") return Boolean(subject.offered_spring);
  return false;
}

export interface SuggestionContext {
  catalog: CatalogView;
  reqTrees: Record<string, RequirementNode>;
  selectedSubjects: SelectedSubject[][];
  currentSemester: number;
  hideIAP: boolean;
  now?: Date;
}

const ATTR_TOKENS: Record<string, string> = {
  "HASS-A": "hass-a",
  "HASS-S": "hass-s",
  "HASS-H": "hass-h",
  "HASS-E": "hass-e",
  "CI-H": "ci-h",
  "CI-HW": "ci-hw",
  "GIR:LAB": "lab",
  "GIR:REST": "rest",
};

/**
 * Produce suggestions for the next schedulable term: which audit gaps are
 * open, and the highest-rated subjects that fill them, offered that term,
 * that fit under the term's remaining hour headroom. Sorted by rating.
 */
export function buildSuggestions(ctx: SuggestionContext): Suggestion[] {
  const now = ctx.now ?? new Date();
  // Find the next term that lies after "now" and isn't full of classes.
  const scheduled = scheduledSemester(ctx.currentSemester, now);
  let targetIndex = -1;
  for (let i = scheduled; i < NUM_SEMESTERS; i++) {
    if (ctx.hideIAP && semesterType(i) === "IAP") {
      continue;
    }
    targetIndex = i;
    break;
  }
  if (targetIndex < 0) {
    return [];
  }
  const season = semesterType(targetIndex);

  // Gather unfulfilled attribute gaps across every program.
  const gaps = new Map<string, number>();
  for (const tree of Object.values(ctx.reqTrees)) {
    collectGaps(tree, gaps);
  }
  if (gaps.size === 0) {
    return [];
  }

  // Hours already planned in the target term (don't pile onto a death sem).
  const plannedHours = semesterInformation(
    ctx.selectedSubjects[targetIndex] ?? [],
    ctx.catalog,
  ).totalExpectedHours;
  const headroom = Math.max(12, 54 - plannedHours);

  // Subjects already on the road anywhere (don't suggest duplicates).
  const onRoad = new Set(ctx.selectedSubjects.flat().map((s) => s.subject_id));

  const suggestions: Suggestion[] = [];
  for (const [attribute, remaining] of gaps) {
    const gapDef = ATTRIBUTE_GAPS[attribute];
    if (gapDef === undefined) {
      continue;
    }
    const candidates: SuggestedClass[] = ctx.catalog.subjectsInfo
      .filter(
        (subject) =>
          !subject.is_historical &&
          !onRoad.has(subject.subject_id) &&
          gapDef.matches(subject) &&
          offeredInSeason(subject, season) &&
          subjectTotalHours(subject) <= headroom,
      )
      .map((subject) => ({
        subject,
        rating: subject.rating,
        hours: subjectTotalHours(subject),
      }))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 5);

    if (candidates.length === 0) {
      continue;
    }
    suggestions.push({
      attribute,
      headline:
        remaining > 1
          ? `${remaining} more ${gapDef.label} needed`
          : `Still need a ${gapDef.label}`,
      term: season.toLowerCase(),
      termIndex: targetIndex,
      classes: candidates,
      tokens: [ATTR_TOKENS[attribute]].filter(Boolean),
    });
  }
  // Most-needed first, then alphabetically for stability.
  return suggestions.sort(
    (a, b) =>
      (gaps.get(b.attribute) ?? 0) - (gaps.get(a.attribute) ?? 0) ||
      a.attribute.localeCompare(b.attribute),
  );
}
