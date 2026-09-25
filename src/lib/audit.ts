/**
 * Degree-audit helpers: smart ordering of the program picker,
 * client-side list-id assignment on requirement trees, petition/ignore
 * state.
 */

import type { ProgressAssertion, ReqListEntry, RequirementNode } from "./types";

/**
 * Sort programs for the picker: majors first (numeric course order), then
 * minors, then everything else alphabetically.
 */
/** Whether Number() reads the whole string as a number ("" counts as 0). */
function isNumericHead(head: string): boolean {
  return !Number.isNaN(Number(head));
}

/**
 * Course-number key of a lowercased program title: the first word up to a
 * dash, with one trailing letter dropped when that makes it numeric
 * ("21m" reads as 21). Kept as a string so "6" and "06" stay distinct
 * for the tie-break.
 */
function programNumberKey(title: string): string {
  const head = title.split(" ")[0].split("-")[0];
  if (!isNumericHead(head) && isNumericHead(head.slice(0, -1))) {
    return head.slice(0, -1);
  }
  return head;
}

export function sortCoursesList(reqList: ReqListEntry[]): ReqListEntry[] {
  const courses = reqList.slice(0);
  const sortKey = "medium-title";
  courses.sort(function (c1, c2) {
    const a = c1[sortKey].toLowerCase();
    const b = c2[sortKey].toLowerCase();
    if (
      (a.includes("major") && b.includes("major")) ||
      (a.includes("minor") && b.includes("minor"))
    ) {
      const k1 = programNumberKey(a);
      const k2 = programNumberKey(b);
      if (k1 === k2) return a.localeCompare(b);
      const numeric1 = isNumericHead(k1);
      const numeric2 = isNumericHead(k2);
      if (numeric1 && numeric2) return Number(k1) - Number(k2);
      if (numeric1 !== numeric2) return numeric1 ? -1 : 1;
      // Two non-numeric keys compare equal.
      return 0;
    } else if (a.includes("major") && b.includes("minor")) return -1;
    else if (b.includes("major") && a.includes("minor")) return 1;
    else if (a.includes("major") || a.includes("minor")) return -1;
    else if (b.includes("major") || b.includes("minor")) return 1;
    else return a.localeCompare(b);
  });
  return courses;
}

/**
 * Give each requirement node a list-id ("major6.0.2") and uniqueKey.
 * Progress overrides and assertions are keyed by these ids. Mutates and
 * returns the tree (top-level ".reql" suffix stripped).
 */
export function assignListIDs(
  req: RequirementNode,
  index: number,
): RequirementNode {
  if ("reqs" in req && req.reqs !== undefined && "list-id" in req) {
    let currentListID = req["list-id"] as string;
    if (currentListID.indexOf(".reql") >= 0) {
      // top-level lists have .reql at the end; remove it
      req["list-id"] = currentListID.substring(
        0,
        currentListID.indexOf(".reql"),
      );
      currentListID = req["list-id"];
    }
    req.uniqueKey = index + "-" + req["list-id"];
    for (let r = 0; r < req.reqs.length; r++) {
      // each sub-requirement gets [parent list id].[index]
      Object.assign(req.reqs[r], { "list-id": currentListID + "." + r });
      req.reqs[r] = assignListIDs(req.reqs[r], index);
    }
  }
  return req;
}

/**
 * Each subject a program counts, mapped to the sections that count it.
 * Plain-string leaves are skipped: their subjects are only a choice.
 */
export function subjectUses(tree: RequirementNode): Map<string, string[]> {
  const uses = new Map<string, string[]>();
  const walk = (node: RequirementNode, group: string | undefined) => {
    if (node.reqs !== undefined) {
      for (const child of node.reqs) {
        walk(child, child.reqs !== undefined ? (child.title ?? group) : group);
      }
      return;
    }
    if (node["plain-string"]) {
      return;
    }
    const name = group ?? node.req ?? node.title;
    if (name === undefined) {
      return;
    }
    for (const subject of node.sat_courses ?? []) {
      const names = uses.get(subject) ?? [];
      if (!names.includes(name)) {
        names.push(name);
      }
      uses.set(subject, names);
    }
  };
  // The root's title is the program itself, not a section of it.
  walk(tree, undefined);
  return uses;
}

/** Whether a requirement is petitioned (has a substitution, not ignored). */
export function isPetitioned(
  progressAssertions: Record<string, ProgressAssertion>,
  listID: string | undefined,
): boolean {
  if (listID !== undefined && listID in progressAssertions) {
    const assertion = progressAssertions[listID];
    return assertion.substitutions !== undefined && assertion.ignore !== true;
  }
  return false;
}

/** A typed count: the assertion's override, else a deprecated
 *  progressOverrides value. */
export function manualProgress(
  contents: {
    progressAssertions: Record<string, ProgressAssertion>;
    progressOverrides: Record<string, number>;
  },
  listID: string,
): number | undefined {
  return (
    contents.progressAssertions[listID]?.override ??
    contents.progressOverrides[listID]
  );
}

/** Whether a requirement is ignored via a progress assertion. */
export function isIgnored(
  progressAssertions: Record<string, ProgressAssertion>,
  listID: string | undefined,
): boolean {
  if (listID !== undefined && listID in progressAssertions) {
    return progressAssertions[listID].ignore === true;
  }
  return false;
}

/** A program's display title from the requirements list, or its raw key. */
export function programTitle(reqList: ReqListEntry[], key: string): string {
  return reqList.find((e) => e.key === key)?.["medium-title"] ?? key;
}
