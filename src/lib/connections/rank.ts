/**
 * Neighbor ranking for the side panel: the convergent companion to the
 * divergent graph. Given a selected node, this produces its
 * connections as a ranked, reasoned list: each with a transparent score
 * (relationship strength + quality + popularity), a plain-language reason,
 * and the status/requirement badges the UI needs to make every row
 * actionable. This is also the **accessible, non-visual equivalent** of the
 * graph, so it must stand entirely on its own.
 *
 * Pure and framework-free: road status and requirement badges are passed in
 * as plain data, so the whole thing is unit-testable.
 */

import type { CatalogView, Subject } from "../types";
import { getSubject } from "../types";
import type { EdgeEngine, RawNeighbor } from "./edges";
import type { Readiness } from "./readiness";
import type { EdgeReason, EdgeType } from "./types";
import { isCrossing } from "./types";

export type RoadStatus = "planned" | "taken";

export interface RankContext {
  catalog: CatalogView;
  /** Subject ids already on the road and how they sit there. */
  roadStatus: Map<string, RoadStatus>;
  /** A short badge if this subject fills an open requirement, else undefined. */
  requirementBadge: (subject: Subject) => string | undefined;
  /** Whether a subject id is currently a node on the canvas. */
  onCanvas: (id: string) => boolean;
  /** "Can I take this, and when?"; undefined when not evaluated. */
  readiness?: (subject: Subject) => Readiness | undefined;
}

export interface RankedNeighbor {
  id: string;
  subject: Subject;
  /** Node-relative explanation, e.g. "Prerequisite for 6.006". */
  reason: string;
  reasons: EdgeReason[];
  primaryType: EdgeType;
  score: number;
  crossing: boolean;
  rating?: number;
  hours?: number;
  status?: RoadStatus;
  requirementBadge?: string;
  /** Only set for subjects not already on the road. */
  readiness?: Readiness;
  /** False for historical / not-offered subjects (demoted, badged). */
  offered: boolean;
  onCanvas: boolean;
}

/** Strongest reason, phrased relative to the selected node. */
function explain(
  selectedId: string,
  neighbor: RawNeighbor,
): { reason: string; primaryType: EdgeType; reasons: EdgeReason[] } {
  const reasons = [...neighbor.reasons].sort((a, b) => b.weight - a.weight);
  const top = reasons[0];
  let reason = top.label;
  if (top.type === "prereq" && neighbor.arrow !== undefined) {
    reason =
      neighbor.arrow.from === selectedId
        ? `Unlocked by ${selectedId}`
        : `Prerequisite for ${selectedId}`;
  }
  return { reason, primaryType: top.type, reasons };
}

function totalHours(subject: Subject): number | undefined {
  if (
    subject.in_class_hours === undefined &&
    subject.out_of_class_hours === undefined
  ) {
    return undefined;
  }
  return (subject.in_class_hours ?? 0) + (subject.out_of_class_hours ?? 0);
}

function isStale(subject: Subject): boolean {
  return (
    Boolean(subject.is_historical) || subject.not_offered_year !== undefined
  );
}

/**
 * Transparent score blend: relationship weight dominates, nudged by course
 * quality and popularity, with a small bonus for interdisciplinary
 * crossings and a firm penalty for no-longer-offered subjects so they never
 * outrank a live alternative.
 */
function scoreNeighbor(
  neighbor: RawNeighbor,
  subject: Subject,
  crossing: boolean,
  readiness: Readiness | undefined,
): number {
  const relationship = neighbor.weight; // 0–1
  const rating = (subject.rating ?? 3.5) / 7; // 0–1, neutral when unknown
  const enrollment = subject.enrollment_number ?? 0;
  const popularity = Math.min(1, Math.log10(enrollment + 1) / Math.log10(500));
  const crossingBonus = crossing ? 1 : 0;
  // a takeable course surfaces a little sooner, never enough to override
  // relationship strength
  const readyBonus = readiness?.kind === "ready" ? 1 : 0;
  const stalePenalty = isStale(subject) ? 1 : 0;
  return (
    relationship * 0.6 +
    rating * 0.25 +
    popularity * 0.1 +
    crossingBonus * 0.05 +
    readyBonus * 0.05 -
    stalePenalty * 0.5
  );
}

/**
 * Rank a node's connections for the side panel. Returns an empty list when
 * the node has no discoverable neighbors (the UI shows "nothing connected
 * we can show yet").
 */
export function rankNeighbors(
  engine: EdgeEngine,
  nodeId: string,
  context: RankContext,
): RankedNeighbor[] {
  const ranked: RankedNeighbor[] = [];
  for (const neighbor of engine.neighbors(nodeId)) {
    const subject = getSubject(context.catalog, neighbor.id);
    if (subject === undefined) {
      continue;
    }
    const crossing = isCrossing(nodeId, neighbor.id);
    const { reason, primaryType, reasons } = explain(nodeId, neighbor);
    const status = context.roadStatus.get(neighbor.id);
    const readiness =
      status === undefined ? context.readiness?.(subject) : undefined;
    ranked.push({
      id: neighbor.id,
      subject,
      reason,
      reasons,
      primaryType,
      score: scoreNeighbor(neighbor, subject, crossing, readiness),
      crossing,
      rating: subject.rating,
      hours: totalHours(subject),
      status,
      requirementBadge: context.requirementBadge(subject),
      readiness,
      offered: !isStale(subject),
      onCanvas: context.onCanvas(neighbor.id),
    });
  }
  ranked.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  return ranked;
}
