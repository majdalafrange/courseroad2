/**
 * Readiness: "can I actually take this, and when?" (the decision layer).
 *
 * Given a subject and the student's road, classify how takeable it is:
 *
 *   • `ready`:        its prerequisites are satisfied by what's already
 *                      behind the current term;
 *   • `ready-after`:  satisfied once planned courses complete; carries the
 *                      earliest bucket where it could be placed;
 *   • `missing`:      not satisfiable by the current plan; carries the
 *                      smallest set of unmet prerequisite subjects (the next
 *                      hops of an exploration);
 *   • `unknown`:      the only unmet requirements aren't subjects we can
 *                      point to (e.g. "permission of instructor"); we never
 *                      claim what we can't evaluate.
 *
 * Semantics deliberately reuse the app's own prerequisite evaluation
 * (`reqsFulfilled`, `parseRequirements`), so a "Ready" badge here always
 * agrees with the class detail's fulfillment checkmarks. Corequisites are
 * excluded; they can be taken concurrently by definition.
 *
 * Pure and framework-free, like the rest of `src/lib/connections/`.
 */

import type { CatalogView, SelectedSubject, Subject } from "../types";
import {
  cheapestBranch,
  isGroup,
  parseRequirements,
  unionUnmetIds,
  type ParsedLeaf,
  type ParsedRequirement,
} from "../prereqTree";
import { reqsFulfilled } from "../requirements";

export type Readiness =
  | { kind: "ready" }
  | { kind: "ready-after"; term: number }
  | {
      kind: "missing";
      /** Unmet prerequisite subject ids (smallest choice among any-branches). */
      missing: string[];
      /** True when non-subject requirements (GIRs, permission…) were also unmet. */
      approximate: boolean;
    }
  | { kind: "unknown" };

type RoadSubject = Pick<SelectedSubject, "subject_id" | "title">;

/** Resolve a requirement token to a current catalog subject id, if it is one. */
function resolveToken(
  catalog: CatalogView,
  oldIdIndex: Map<string, string>,
  token: string,
): string | undefined {
  if (token in catalog.subjectsIndex) {
    return token;
  }
  return oldIdIndex.get(token);
}

interface MissingResult {
  /** Unmet subject ids, or undefined when nothing here is a real subject. */
  ids: string[] | undefined;
  /** Unmet non-subject tokens were encountered (and skipped). */
  approximate: boolean;
  /** How many leaves under this node are already fulfilled (tie-breaking). */
  fulfilledLeaves: number;
}

/**
 * The smallest set of unmet prerequisite subjects under a parsed requirement
 * node. All-groups union their children; any-groups take the cheapest branch
 * (fewest missing, then most progress, then lexicographic; deterministic).
 */
function missingUnder(
  catalog: CatalogView,
  oldIdIndex: Map<string, string>,
  node: ParsedRequirement | ParsedLeaf,
): MissingResult {
  if (!isGroup(node)) {
    if (node.fulfilled === true) {
      return { ids: [], approximate: false, fulfilledLeaves: 1 };
    }
    const resolved = resolveToken(catalog, oldIdIndex, node.subject_id);
    if (resolved === undefined) {
      return { ids: undefined, approximate: true, fulfilledLeaves: 0 };
    }
    return { ids: [resolved], approximate: false, fulfilledLeaves: 0 };
  }

  const children = node.reqs.map((child) =>
    missingUnder(catalog, oldIdIndex, child),
  );
  if (node.connectionType === "any" && children.length > 1) {
    // pick the cheapest satisfiable branch; unmet *sibling* branches are
    // irrelevant once one is chosen, so they never flag `approximate`
    const satisfiable = children.filter(
      (c): c is MissingResult & { ids: string[] } => c.ids !== undefined,
    );
    const cheapest = cheapestBranch(satisfiable);
    if (cheapest === undefined) {
      return { ids: undefined, approximate: true, fulfilledLeaves: 0 };
    }
    return cheapest;
  }

  // "all" (and single-child / separator-less strings): union the children
  let approximate = false;
  let sawSubjects = false;
  let fulfilledLeaves = 0;
  for (const child of children) {
    approximate = approximate || child.approximate;
    fulfilledLeaves += child.fulfilledLeaves;
    sawSubjects = sawSubjects || child.ids !== undefined;
  }
  if (!sawSubjects) {
    return { ids: undefined, approximate, fulfilledLeaves };
  }
  return { ids: unionUnmetIds(children), approximate, fulfilledLeaves };
}

/**
 * Build a memoized readiness evaluator over one road snapshot. Rebuild it
 * whenever the road (or catalog) changes; evaluations are cheap after the
 * first thanks to cumulative per-bucket subject lists and a binary search
 * over the (monotone) fulfillment-by-term predicate.
 */
export function createReadinessEvaluator(
  catalog: CatalogView,
  selectedSubjects: SelectedSubject[][],
  currentSemester: number,
): (subject: Subject) => Readiness {
  const bucketCount = selectedSubjects.length;
  const oldIdIndex = new Map<string, string>();
  for (const subject of catalog.subjectsInfo) {
    if (subject.old_id !== undefined) {
      oldIdIndex.set(subject.old_id, subject.subject_id);
    }
  }
  // cumulative[t] = everything placed strictly before bucket t
  const cumulative: RoadSubject[][] = [[]];
  for (let t = 0; t < bucketCount; t++) {
    cumulative.push([
      ...cumulative[t],
      ...selectedSubjects[t].map((s) => ({
        subject_id: s.subject_id,
        title: s.title,
      })),
    ]);
  }
  const now = Math.max(0, Math.min(currentSemester, bucketCount));
  const cache = new Map<string, Readiness>();

  return (subject: Subject): Readiness => {
    const cached = cache.get(subject.subject_id);
    if (cached !== undefined) {
      return cached;
    }
    const result = evaluate(subject);
    cache.set(subject.subject_id, result);
    return result;
  };

  function fulfilledAt(prereqs: string, t: number): boolean {
    // Containment boundary: a malformed catalog string must degrade this
    // one subject to "missing", never take down the whole graph pass.
    // reqsFulfilled has no known throw path today, so a throw here means
    // an engine bug; the graph still renders while it gets fixed.
    try {
      return reqsFulfilled(catalog, prereqs, cumulative[t]);
    } catch {
      return false;
    }
  }

  function evaluate(subject: Subject): Readiness {
    const prereqs = subject.prerequisites;
    if (prereqs === undefined || prereqs.trim() === "") {
      return { kind: "ready" };
    }
    if (fulfilledAt(prereqs, now)) {
      return { kind: "ready" };
    }
    if (bucketCount > now && fulfilledAt(prereqs, bucketCount)) {
      // smallest t in (now, bucketCount] where the plan satisfies the prereqs
      let lo = now + 1;
      let hi = bucketCount;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (fulfilledAt(prereqs, mid)) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
      return { kind: "ready-after", term: lo };
    }
    const tree = parseRequirements(
      prereqs,
      catalog,
      selectedSubjects,
      bucketCount,
    );
    const result = missingUnder(catalog, oldIdIndex, tree);
    if (result.ids === undefined || result.ids.length === 0) {
      return { kind: "unknown" };
    }
    return {
      kind: "missing",
      missing: result.ids,
      approximate: result.approximate,
    };
  }
}
