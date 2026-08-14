/**
 * Edge extraction: turns the catalog's relational signals into typed,
 * reasoned, deduplicated graph edges. The catalog's edge cases live
 * here, so the tests pay off here.
 *
 * The one signal used, client-side from the cached catalog: the
 * prerequisite graph (forward + reverse). Curated relateds, shared
 * prereqs, and topical similarity were tried and dropped: they crowded
 * the canvas without telling a student anything actionable.
 *
 * Invariants: prereq strings parse to *leaf subject ids only* (booleans,
 * parens, GIR/HASS/CI tokens, quoted phrases, ranges never become nodes);
 * references resolve through `old_id`, unresolvable ones drop silently
 * (no ghost nodes); generic placeholders and custom activities are never
 * nodes; no self-edges, one merged edge per pair carrying every reason
 * and a combined weight; hub fan-out is bounded and ranked so expansion
 * can cap it.
 *
 * Memoized per-subject: extraction, the reverse-prereq scan, and the
 * prereq-leaf parse, so repeated expansion is cheap.
 */

import type { CatalogView, Subject } from "../types";
import { getSubject } from "../types";
import { subjectsWithPrereq } from "../prereqTree";
import type { EdgeReason, EdgeType, GraphEdge } from "./types";
import { edgeKey, isCrossing } from "./types";

/** Base weight of a prerequisite relationship. */
const PREREQ_WEIGHT = 0.95;

/** A candidate connection from one subject to another, with merged reasons. */
export interface RawNeighbor {
  id: string;
  reasons: EdgeReason[];
  /** Noisy-OR blend of the reason weights: bounded, rewards multiple signals. */
  weight: number;
  /** For prerequisite relationships: prerequisite → dependent. */
  arrow?: { from: string; to: string };
}

/**
 * Bounded probabilistic OR of a set of weights. Two weak signals reinforce,
 * but the result stays in [0, 1) so no edge can dominate by stacking reasons.
 */
export function noisyOr(weights: number[]): number {
  let product = 1;
  for (const w of weights) {
    product *= 1 - Math.min(0.99, Math.max(0, w));
  }
  return 1 - product;
}

/** Plain-language label for a prerequisite relationship. */
function prereqLabel(prereqId: string, dependentId: string): string {
  return `${dependentId} requires ${prereqId}`;
}

/**
 * Pull candidate subject-id *tokens* out of a prerequisite/corequisite
 * string, dropping everything that isn't a subject id: boolean operators,
 * grouping, GIR/HASS/CI attribute tokens, and quoted phrases like
 * "permission of instructor". Catalog resolution happens separately, so
 * this is catalog-free and trivially unit-testable.
 */
export function extractPrereqTokens(reqString: string | undefined): string[] {
  if (reqString === undefined || reqString === "") {
    return [];
  }
  // FireRoad marks quotes with doubled single-quotes; restore them so
  // phrases are detectable, then split on the boolean/grouping operators.
  const normalized = reqString.replace(/''/g, '"');
  const tokens: string[] = [];
  for (const piece of normalized.split(/[/,()]/)) {
    const token = piece.trim();
    if (token === "") {
      continue;
    }
    if (token.includes('"') || token.includes("'")) {
      continue; // quoted phrase, e.g. "permission of instructor"
    }
    if (/^GIR:/i.test(token) || /^(HASS|CI)\b/i.test(token)) {
      continue; // attribute requirement, not an explorable subject
    }
    tokens.push(token);
  }
  return tokens;
}

/** Resolve a token to a current catalog subject id, via `old_id` if needed. */
export function resolveSubjectId(
  catalog: CatalogView,
  token: string,
  oldIdIndex?: Map<string, string>,
): string | undefined {
  if (token in catalog.subjectsIndex) {
    return token;
  }
  if (oldIdIndex !== undefined) {
    return oldIdIndex.get(token);
  }
  for (const subject of catalog.subjectsInfo) {
    if (subject.old_id === token) {
      return subject.subject_id;
    }
  }
  return undefined;
}

/**
 * Leaf subject ids of a prerequisite/corequisite string, resolved against
 * the catalog (renumbered ids followed via `old_id`, unresolvable tokens
 * dropped). Deduplicated, order-preserving.
 */
export function prereqLeafIds(
  reqString: string | undefined,
  catalog: CatalogView,
  oldIdIndex?: Map<string, string>,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of extractPrereqTokens(reqString)) {
    const resolved = resolveSubjectId(catalog, token, oldIdIndex);
    if (resolved !== undefined && !seen.has(resolved)) {
      seen.add(resolved);
      out.push(resolved);
    }
  }
  return out;
}

/** Deduplicate reasons by (type, label), keeping the highest weight. */
function dedupeReasons(reasons: EdgeReason[]): EdgeReason[] {
  const byKey = new Map<string, EdgeReason>();
  for (const reason of reasons) {
    const key = `${reason.type}|${reason.label}`;
    const existing = byKey.get(key);
    if (existing === undefined || reason.weight > existing.weight) {
      byKey.set(key, reason);
    }
  }
  return [...byKey.values()];
}

/** Build a finished, sorted graph edge from a set of reasons. */
function buildEdge(
  x: string,
  y: string,
  reasons: EdgeReason[],
  arrow?: { from: string; to: string },
): GraphEdge {
  const [a, b] = x < y ? [x, y] : [y, x];
  const merged = dedupeReasons(reasons);
  const primaryType: EdgeType = merged
    .slice()
    .sort((p, q) => q.weight - p.weight)[0].type;
  return {
    id: edgeKey(a, b),
    a,
    b,
    reasons: merged,
    weight: noisyOr(merged.map((r) => r.weight)),
    primaryType,
    crossing: isCrossing(a, b),
    arrow,
  };
}

/**
 * Stateful, memoized edge source over one catalog. Construct once per
 * catalog (the store holds one); every graph operation reads from it.
 */
export class EdgeEngine {
  readonly catalog: CatalogView;
  private oldIdIndex: Map<string, string>;

  private neighborCache = new Map<string, RawNeighbor[]>();
  private neighborMapCache = new Map<string, Map<string, RawNeighbor>>();
  private reversePrereqCache = new Map<string, Subject[]>();
  private prereqLeafCache = new Map<string, string[]>();

  constructor(catalog: CatalogView) {
    this.catalog = catalog;
    this.oldIdIndex = new Map();
    for (const subject of catalog.subjectsInfo) {
      if (subject.old_id !== undefined) {
        this.oldIdIndex.set(subject.old_id, subject.subject_id);
      }
    }
  }

  /** Whether an id names a real, explorable subject (not generic/custom). */
  isExplorable(id: string): boolean {
    if (id in this.catalog.genericIndex) {
      return false;
    }
    const subject = getSubject(this.catalog, id);
    return subject !== undefined && subject.public !== false;
  }

  private resolve(token: string): string | undefined {
    return resolveSubjectId(this.catalog, token, this.oldIdIndex);
  }

  /** Resolve a (possibly renumbered) id to its current catalog id. */
  resolveId(token: string): string | undefined {
    return this.resolve(token);
  }

  private prereqLeaves(id: string, subject: Subject): string[] {
    const cached = this.prereqLeafCache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const leaves: string[] = [];
    const seen = new Set<string>();
    for (const source of [subject.prerequisites, subject.corequisites]) {
      for (const leaf of prereqLeafIds(source, this.catalog, this.oldIdIndex)) {
        if (leaf !== id && !seen.has(leaf)) {
          seen.add(leaf);
          leaves.push(leaf);
        }
      }
    }
    this.prereqLeafCache.set(id, leaves);
    return leaves;
  }

  /** Subjects that list `id` (or its GIR attribute) among their prereqs. */
  private reversePrereq(id: string): Subject[] {
    const cached = this.reversePrereqCache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const subject = getSubject(this.catalog, id);
    const result =
      subject === undefined
        ? []
        : subjectsWithPrereq(subject, this.catalog.subjectsInfo).filter(
            (s) => s.subject_id !== id && s.public !== false,
          );
    this.reversePrereqCache.set(id, result);
    return result;
  }

  /** All candidate neighbors of a subject, ranked by weight (memoized). */
  neighbors(id: string): RawNeighbor[] {
    const cached = this.neighborCache.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const result = this.computeNeighbors(id);
    this.neighborCache.set(id, result);
    this.neighborMapCache.set(id, new Map(result.map((n) => [n.id, n])));
    return result;
  }

  /** O(1)-lookup form of `neighbors`. */
  neighborMap(id: string): Map<string, RawNeighbor> {
    this.neighbors(id);
    return this.neighborMapCache.get(id) as Map<string, RawNeighbor>;
  }

  private computeNeighbors(id: string): RawNeighbor[] {
    const subject = getSubject(this.catalog, id);
    if (
      subject === undefined ||
      subject.public === false ||
      !this.isExplorable(id)
    ) {
      return [];
    }
    const byId = new Map<
      string,
      { reasons: EdgeReason[]; arrow?: { from: string; to: string } }
    >();
    const add = (
      rawOther: string,
      reason: EdgeReason,
      arrow?: { from: string; to: string },
    ) => {
      const other = this.resolve(rawOther);
      if (other === undefined || other === id || !this.isExplorable(other)) {
        return;
      }
      const entry = byId.get(other) ?? { reasons: [] };
      entry.reasons.push(reason);
      if (arrow !== undefined && entry.arrow === undefined) {
        entry.arrow = arrow;
      }
      byId.set(other, entry);
    };

    const ownPrereqs = this.prereqLeaves(id, subject);

    // forward: this subject's prerequisites lead into it
    for (const p of ownPrereqs) {
      add(
        p,
        { type: "prereq", weight: PREREQ_WEIGHT, label: prereqLabel(p, id) },
        { from: p, to: id },
      );
    }
    // reverse: subjects that require this one
    for (const dependent of this.reversePrereq(id)) {
      add(
        dependent.subject_id,
        {
          type: "prereq",
          weight: PREREQ_WEIGHT,
          label: prereqLabel(id, dependent.subject_id),
        },
        { from: id, to: dependent.subject_id },
      );
    }

    const list: RawNeighbor[] = [];
    for (const [otherId, entry] of byId) {
      const reasons = dedupeReasons(entry.reasons);
      list.push({
        id: otherId,
        reasons,
        weight: noisyOr(reasons.map((r) => r.weight)),
        arrow: entry.arrow,
      });
    }
    list.sort((p, q) => q.weight - p.weight || (p.id < q.id ? -1 : 1));
    return list;
  }

  /**
   * The merged edge between two subjects, unioning what each side declares
   * (related/joint edges can be one-directional in the catalog; this keeps
   * the rendered relationship symmetric). Returns undefined if unrelated.
   */
  edgeBetween(x: string, y: string): GraphEdge | undefined {
    const fromX = this.neighborMap(x).get(y);
    const fromY = this.neighborMap(y).get(x);
    if (fromX === undefined && fromY === undefined) {
      return undefined;
    }
    const reasons = [...(fromX?.reasons ?? []), ...(fromY?.reasons ?? [])];
    const arrow = fromX?.arrow ?? fromY?.arrow;
    return buildEdge(x, y, reasons, arrow);
  }
}
