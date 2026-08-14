/**
 * Parses FireRoad prerequisite/corequisite strings (e.g.
 * "6.0001/(6.01, 6.02)") into a recursive any/all tree with live
 * fulfilled-state, for the class-detail view. Ported exactly from
 * ClassInfo.vue's parseRequirements, including the legacy quirk that
 * `firstAppearance === -1` (class not on the road) evaluates against
 * `selectedSubjects.slice(0, -1)`: all buckets but the last. Pinned in
 * tests.
 */

import type { CatalogView, SelectedSubject, Subject } from "./types";
import { flatten } from "./types";
import { reqsFulfilled } from "./requirements";
import { splitReqLevel } from "./reqGrammar";

export interface ParsedRequirement {
  reqs: (ParsedRequirement | ParsedLeaf)[];
  connectionType: "any" | "all" | "";
  topLevel: boolean;
  fulfilled: boolean;
}

export interface ParsedLeaf extends Partial<Subject> {
  subject_id: string;
  title: string;
  fulfilled?: boolean;
}

/** Branch/leaf discriminator for parsed requirement trees. */
export function isGroup(
  node: ParsedRequirement | ParsedLeaf,
): node is ParsedRequirement {
  return (node as ParsedRequirement).reqs !== undefined;
}

/**
 * Shared tie-break for choosing among the branches of an any-group:
 * fewest unmet ids, then most fulfilled leaves, then lexicographic id
 * join. warnings.ts and connections/readiness.ts both rank with this,
 * so a warning and the connections graph name the same cheapest branch.
 */
export function cheapestBranch<
  T extends { ids: string[]; fulfilledLeaves: number },
>(branches: T[]): T | undefined {
  return [...branches].sort(
    (p, q) =>
      p.ids.length - q.ids.length ||
      q.fulfilledLeaves - p.fulfilledLeaves ||
      (p.ids.join() < q.ids.join() ? -1 : 1),
  )[0];
}

/** Order-preserving union of children's unmet ids, deduplicated. */
export function unionUnmetIds(
  children: { ids?: string[] | undefined }[],
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const child of children) {
    for (const id of child.ids ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** Resolve a subject id for the tree (GIR: prefix handled by caller). */
function leafInfo(catalog: CatalogView, subjectID: string): ParsedLeaf {
  const subj = catalog.subjectsInfo[catalog.subjectsIndex[subjectID]];
  return subj !== undefined ? subj : { subject_id: subjectID, title: "" };
}

/** Index of the first semester bucket containing `subjectID`, else -1. */
export function firstAppearance(
  selectedSubjects: SelectedSubject[][],
  subjectID: string,
): number {
  const subjectInSemesters = selectedSubjects.map(
    (semesterSubjects) =>
      semesterSubjects.map((subj) => subj.subject_id).indexOf(subjectID) >= 0,
  );
  return subjectInSemesters.indexOf(true);
}

function isBaseReq(req: string): boolean {
  return /[/(),]/g.exec(req) === null;
}

/**
 * Parse a requirement string into a tree, computing per-leaf fulfillment
 * from the road (subjects in buckets before the class's first appearance).
 */
export function parseRequirements(
  requirements: string,
  catalog: CatalogView,
  selectedSubjects: SelectedSubject[][],
  classFirstAppearance: number,
): ParsedRequirement {
  // remove spaces after commas and slashes
  requirements = requirements.replace(/([,/])\s+/g, "$1");

  const parseReqs = (reqString: string): ParsedRequirement => {
    const parsedReq: ParsedRequirement = {
      reqs: [],
      connectionType: "",
      topLevel: false,
      fulfilled: false,
    };
    const parseLeaf = (token: string): ParsedLeaf => {
      let subRequirement: ParsedLeaf;
      if (token.indexOf("'") >= 0) {
        subRequirement = {
          subject_id: token.replace(/'/g, ""),
          title: "",
        };
      } else {
        subRequirement = Object.assign({}, leafInfo(catalog, token));
      }
      // Legacy quirk preserved: -1 (class not on the road) yields
      // slice(0, -1), evaluating against all buckets but the last.
      const allPreviousSubjects = flatten(
        selectedSubjects.slice(0, classFirstAppearance),
      );
      subRequirement.fulfilled = reqsFulfilled(
        catalog,
        token,
        allPreviousSubjects,
      );
      return subRequirement;
    };

    // MIT's grammar is comma-loose, slash-tight: "18.03, 6.041/6.3700"
    // means 18.03 AND (6.041 OR 6.3700). splitReqLevel holds that
    // precedence and is shared with reqsFulfilled.
    const level = splitReqLevel(reqString);
    if (level.connective !== null) {
      parsedReq.connectionType = level.connective;
    }
    for (const part of level.parts) {
      if (isBaseReq(part)) {
        parsedReq.reqs.push(parseLeaf(part));
      } else if (part !== level.stripped) {
        parsedReq.reqs.push(parseReqs(part));
      } else {
        // Unbalanced parentheses: keep the token as an opaque leaf
        // instead of recursing on the same string.
        parsedReq.reqs.push(parseLeaf(part));
      }
    }

    if (parsedReq.connectionType === "any") {
      parsedReq.fulfilled = parsedReq.reqs.some((req) => req.fulfilled);
    } else if (parsedReq.connectionType === "all") {
      parsedReq.fulfilled = parsedReq.reqs.every((req) => req.fulfilled);
    } else if (parsedReq.reqs.length === 1) {
      // No separator at this level: a single prerequisite (or one
      // parenthesized group) carries its child's state.
      parsedReq.fulfilled = Boolean(parsedReq.reqs[0].fulfilled);
    }

    function sortOrder(req: ParsedRequirement | ParsedLeaf): number {
      if ((req as ParsedRequirement).reqs !== undefined) {
        return 0;
      } else if ((req as ParsedLeaf).total_units !== undefined) {
        return -1;
      } else {
        return 1;
      }
    }

    parsedReq.reqs.sort((a, b) => sortOrder(a) - sortOrder(b));

    return parsedReq;
  };

  const rList = parseReqs(requirements);
  rList.topLevel = true;
  return rList;
}

/**
 * Reverse-prereq search: all catalog subjects that list `subject` (or its
 * GIR attribute) in their prerequisites, same-department subjects first.
 * Ported from ClassInfo.vue's subjectsWithPrereq.
 */
export function subjectsWithPrereq(
  subject: Subject,
  subjectsInfo: Subject[],
): Subject[] {
  const currentID = subject.subject_id;
  const currentDept = currentID.substring(0, currentID.indexOf("."));
  const thisGIRAttr = subject.gir_attribute;
  let IDMatcher: RegExp;
  if (thisGIRAttr === undefined) {
    IDMatcher = new RegExp(
      "(^|[^\\da-zA-Z])" +
        currentID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "(?![\\da-zA-Z])",
    );
  } else {
    const filteredCurrentID = currentID.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    IDMatcher = new RegExp(
      "(^|[^\\da-zA-Z])" +
        "(" +
        "GIR:" +
        thisGIRAttr +
        "|" +
        filteredCurrentID +
        ")" +
        "(?![\\da-zA-Z])",
    );
  }
  return subjectsInfo
    .filter(
      (s) => s.prerequisites !== undefined && IDMatcher.test(s.prerequisites),
    )
    .sort((s1, s2) => {
      // Same-department subjects first. The comparator must answer both
      // orderings of a mixed pair, or the order is left to the sort
      // implementation instead of this rule.
      const dept1 = s1.subject_id.substring(0, s1.subject_id.indexOf("."));
      const dept2 = s2.subject_id.substring(0, s2.subject_id.indexOf("."));
      if (dept1 === currentDept && dept2 !== currentDept) {
        return -1;
      }
      if (dept2 === currentDept && dept1 !== currentDept) {
        return 1;
      }
      return 0;
    });
}
