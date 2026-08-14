/**
 * Prerequisite/corequisite fulfillment engine.
 *
 * Ported verbatim from the legacy `reqFulfillment` mixin. Years of student
 * bug reports are baked into these edge cases (CMS/History "one subject in"
 * strings, the Brain-and-Cognitive-Sciences comma quirk, film matching by
 * title). Do not "clean up" behavior here without pinned tests.
 *
 * Two intentional changes from legacy:
 * - The final boolean expression is evaluated by a tiny recursive-descent
 *   parser instead of `eval()`. Equivalence with `eval` is property-tested
 *   in tests/unit/lib/requirements.spec.ts.
 * - The final assembly parenthesizes under the shared requirement grammar
 *   (comma binds loose, slash binds tight; see reqGrammar.ts) instead of
 *   inheriting JS operator precedence, so this flag agrees with the
 *   prereq tree in prereqTree.ts on strings like "A,B/C".
 */

import type { CatalogView, SelectedSubject } from "./types";
import { getSubject } from "./types";
import { splitReqLevel } from "./reqGrammar";

/**
 * Whether having taken `id` satisfies the requirement token `req`
 * (exact id, equivalent subject, parent/child grouping, or GIR/HASS/CI
 * attribute requirements like "GIR:PHY1").
 */
export function classSatisfies(
  catalog: CatalogView,
  req: string,
  id: string,
  allSubjects: string[],
): boolean {
  if (req === id) {
    return true;
  }

  const subj = getSubject(catalog, id);
  if (subj === undefined) {
    // subj not found in known courses
    return false;
  }

  if (
    subj.equivalent_subjects !== undefined &&
    subj.equivalent_subjects.indexOf(req) >= 0
  ) {
    return true;
  }

  // ex: 6.00 satisfies the 6.0001 requirement
  if (subj.children !== undefined && subj.children.indexOf(req) >= 0) {
    return true;
  }

  // ex: 6.0001 and 6.0002 together satisfy the 6.00 requirement
  if (subj.parent !== undefined && req === subj.parent) {
    const parentCourse =
      catalog.subjectsInfo[catalog.subjectsIndex[subj.parent]];
    if (parentCourse !== undefined && parentCourse.children !== undefined) {
      if (parentCourse.children.every((sid) => allSubjects.indexOf(sid) >= 0)) {
        return true;
      }
    }
  }

  if (req.indexOf(".") === -1) {
    if (req.indexOf("GIR:") >= 0) {
      req = req.substring(4);
      return subj.gir_attribute === req;
    } else if (req.indexOf("HASS") >= 0) {
      return (
        subj.hass_attribute !== undefined &&
        subj.hass_attribute.split(",").indexOf(req) >= 0
      );
    } else if (req.indexOf("CI") >= 0) {
      return subj.communication_requirement === req;
    }
  }
  return false;
}

/**
 * Converts a category string like "Comparative Media Studies" or
 * "philosophy" into a matcher for subject ids (e.g. /CMS/ or /24\.[0-8]/).
 */
export function convertReqToID(category: string): RegExp | string {
  // Quote stripping, verbatim from legacy: the second test asks whether
  // the FIRST quote sits at the end, not endsWith, so an interior quote
  // suppresses the strip. Real category tokens never carry interior
  // quotes; the shape is pinned in requirements.spec.ts.
  if (category.indexOf('"') === 0) {
    category = category.slice(1);
  }
  if (category.indexOf('"') === category.length - 1) {
    category = category.slice(0, -1);
  }
  let idCategory: RegExp | string = "";
  if (
    category === "Comparative" ||
    category === "CMS" ||
    category === "Comparative Media Studies"
  ) {
    idCategory = /CMS/;
  } else if (category === "Literature") {
    idCategory = /21L/;
  } else if (/film/i.test(category)) {
    idCategory = /film/i;
  } else if (category === "philosophy") {
    // below 900 is Linguistics
    idCategory = /24\.[0-8]/;
  } else if (category === "Anthropology") {
    idCategory = /21A/;
  } else if (
    category === "Brain" ||
    category === "Cognitive Sciences" ||
    category === "Cognitive"
  ) {
    idCategory = /^9\./;
  } else if (category === "History") {
    idCategory = /21H/;
  } else {
    idCategory = "do not match anything";
    // maybe this should create a message asking us to add it
  }
  return idCategory;
}

/** Whether `allIDs` contains at least `numRequired` matches of `idCategory`. */
function checkForNumRequired(
  allIDs: string[],
  idCategory: RegExp | string,
  numRequired: number,
): "true" | "false" {
  let numMatches = 0;
  for (let i = 0; i < allIDs.length; i++) {
    // A string idCategory (the never-matches sentinel) is compiled by
    // search() as a pattern; its words match no subject id.
    if (allIDs[i].search(idCategory) >= 0) {
      numMatches += 1;
    }
  }
  return numMatches >= numRequired ? "true" : "false";
}

/**
 * Evaluate a boolean expression containing only `true`, `false`, `&&`,
 * `||`, and parentheses: the alphabet `reqsFulfilled` produces. Replaces
 * the legacy `eval()` call with identical semantics (JS operator
 * precedence: `&&` binds tighter than `||`).
 */
export function evaluateBooleanExpression(expression: string): boolean {
  let pos = 0;

  function parseOr(): boolean {
    let value = parseAnd();
    while (expression.startsWith("||", pos)) {
      pos += 2;
      const rhs = parseAnd();
      value = value || rhs;
    }
    return value;
  }

  function parseAnd(): boolean {
    let value = parseAtom();
    while (expression.startsWith("&&", pos)) {
      pos += 2;
      const rhs = parseAtom();
      value = value && rhs;
    }
    return value;
  }

  function parseAtom(): boolean {
    if (expression.startsWith("(", pos)) {
      pos += 1;
      const value = parseOr();
      if (expression.startsWith(")", pos)) {
        pos += 1;
      }
      return value;
    }
    if (expression.startsWith("true", pos)) {
      pos += 4;
      return true;
    }
    if (expression.startsWith("false", pos)) {
      pos += 5;
      return false;
    }
    // Unparseable token: treat as unfulfilled, matching eval's tendency to
    // throw (legacy callers never hit this branch).
    pos = expression.length;
    return false;
  }

  return parseOr();
}

/**
 * Rebuild a substituted token stream ("true", "false", parentheses, commas,
 * slashes) as an explicitly parenthesized boolean expression under the
 * shared requirement grammar: comma binds loose, slash binds tight, so
 * "A,B/C" means A AND (B OR C). Full parenthesization keeps the result
 * independent of evaluateBooleanExpression's operator precedence. A token
 * outside that alphabet passes through unchanged.
 */
function toBooleanExpression(expression: string): string {
  const level = splitReqLevel(expression);
  if (level.connective === "all") {
    return "(" + level.parts.map(toBooleanExpression).join("&&") + ")";
  }
  if (level.connective === "any") {
    return "(" + level.parts.map(toBooleanExpression).join("||") + ")";
  }
  return level.parts.length === 1 ? level.parts[0] : expression;
}

/**
 * Whether a FireRoad requirement string (e.g. "6.0001/(6.01, 6.02)") is
 * fulfilled by the given subjects.
 *
 * Quirks preserved from the legacy implementation, verbatim:
 * - '"One/Two subject(s) in X"' strings are matched against subject ids
 *   (or titles, for film) using `convertReqToID`.
 * - "one subject in CMS / History" is treated as (one in CMS)||(one in
 *   History), and FireRoad's "Brain and Cognitive Sciences" comma split is
 *   special-cased.
 * - Any other quoted string (e.g. "permission of instructor") is false.
 */
export function reqsFulfilled(
  catalog: CatalogView,
  reqString: string,
  subjects: Pick<SelectedSubject, "subject_id" | "title">[],
): boolean {
  const allIDs = subjects.map((s) => s.subject_id);
  reqString = reqString.replace(/''/g, '"').replace(/,[\s]+/g, ",");
  const splitReq: string[] = reqString.split(/(,|\(|\)|\/)/);
  let skipNumber: number | undefined;
  for (let i = 0; i < splitReq.length; i++) {
    if (splitReq[i].indexOf('"') >= 0 && i !== skipNumber) {
      // if the requirement is a string instead of a class ID:
      // If the string is "One subject in X", check for any subject with X
      // in their ID. Other strings (like "permission of instructor") are
      // automatically false. (Known-imperfect cases, 21M.283, 24.280,
      // 21L.709/.715/.S96/.S97; preserved as-is from legacy.)
      const req = splitReq[i];
      let idCategory: RegExp | string;
      let numRequired: number;
      const lowercaseReq = req.toLowerCase();
      if (
        lowercaseReq.indexOf("one subject in") >= 0 ||
        lowercaseReq.indexOf("two subjects in") >= 0
      ) {
        if (lowercaseReq.indexOf("one subject in") >= 0) {
          numRequired = 1;
        } else {
          numRequired = 2;
        }
        // because "one subject in CMS / History" should be
        // (one subject in CMS || one subject in History),
        // not (one subject in CMS) || History
        const orcheck =
          splitReq[i + 1] === "/" &&
          (splitReq[i + 2] === '"Comparative Media Studies"' ||
            splitReq[i + 2] === '"History"');
        // because FireRoad treats "Brain and Cognitive Sciences" as
        // (Brain) && (Cognitive Sciences) instead of (Brain and Cognitive Sciences)
        const andcheck =
          splitReq[i + 1] === "," && splitReq[i + 2] === '"Cognitive Sciences"';
        if (splitReq.length > i + 2 && (orcheck || andcheck)) {
          skipNumber = i + 2;
          idCategory = convertReqToID(splitReq[i + 2]);
          splitReq[i + 2] = checkForNumRequired(
            allIDs,
            idCategory,
            numRequired,
          );
        }
        // sometimes the string is 'two subjects in X' and sometimes it is
        // 'any other two subjects in X'
        const parts = req.split(" ");
        const inIndex = parts.indexOf("in");
        // The containment checks above are case-insensitive, so a string
        // like '"One subject In X"' can pass them without a lowercase
        // "in" token; falling back to parts[0] here would match a wrong
        // category instead of none.
        const category = inIndex >= 0 ? (parts[inIndex + 1] ?? "") : "";
        idCategory = convertReqToID(category);
        splitReq[i] = checkForNumRequired(allIDs, idCategory, numRequired);
        const matchesTitles =
          idCategory instanceof RegExp && idCategory.source === "film";
        if (matchesTitles) {
          // Film subjects are matched by title, not id (legacy behavior).
          const allTitles = subjects.map((s) => s.title);
          splitReq[i] = checkForNumRequired(allTitles, idCategory, numRequired);
        }
      } else {
        splitReq[i] = "false";
      }
    } else if ("()/, ".indexOf(splitReq[i]) < 0 && i !== skipNumber) {
      if (allIDs.indexOf(splitReq[i]) >= 0) {
        splitReq[i] = "true";
      } else {
        const anyClassSatisfies = subjects.some((s) =>
          classSatisfies(catalog, splitReq[i], s.subject_id, allIDs),
        );
        splitReq[i] = anyClassSatisfies ? "true" : "false";
      }
    }
  }
  return evaluateBooleanExpression(toBooleanExpression(splitReq.join("")));
}
