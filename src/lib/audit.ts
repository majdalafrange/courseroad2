/**
 * Degree-audit helpers: smart ordering of the program picker,
 * client-side list-id assignment on requirement trees, petition/ignore
 * state. Ported from Audit.vue.
 */

import type { ProgressAssertion, ReqListEntry, RequirementNode } from "./types";

/**
 * Sort programs for the picker: majors first (numeric course order), then
 * minors, then everything else alphabetically. Brute force, as before.
 */
/** Whether Number() reads the whole string as a number ("" counts as 0). */
function isNumericHead(head: string): boolean {
  return !Number.isNaN(Number(head));
}

/**
 * Course-number key of a lowercased program title: the first word up to a
 * dash, with one trailing letter dropped when that makes it numeric
 * ("21m" reads as 21). Kept as a string so "6" and "06" stay distinct
 * for the tie-break, exactly as the legacy comparator behaved.
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
      // Two non-numeric keys: the legacy comparator subtracted strings
      // and yielded NaN, which sorts treated as equal. Stated plainly.
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
 * returns the tree (top-level ".reql" suffix stripped, as before).
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

/** Whether a requirement is petitioned (has a substitution, not ignored). */
export function isPetitioned(
  progressAssertions: Record<string, ProgressAssertion>,
  listID: string | undefined,
): boolean {
  if (listID !== undefined && listID in progressAssertions) {
    return progressAssertions[listID].ignore !== true;
  }
  return false;
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
