/**
 * Consequence-highlighting state: while a class is hovered or dragged,
 * its prerequisite ancestors and dependents on the canvas illuminate.
 * Plain reactive module shared by the canvas, search, and (later) the
 * audit's cross-highlighting.
 */

import { reactive } from "vue";
import { computeConsequences } from "../lib/consequences";
import type { CatalogView, SelectedSubject, Subject } from "../lib/types";

interface HighlightState {
  /** The subject driving the highlight, if any. */
  subjectId: string | null;
  /** placedKey() entries that feed the hovered subject. */
  ancestors: Set<string>;
  /** placedKey() entries the hovered subject feeds. */
  dependents: Set<string>;
  /** Subject ids illuminated by hovering an audit requirement. */
  auditCourses: Set<string>;
}

export const highlightState = reactive<HighlightState>({
  subjectId: null,
  ancestors: new Set(),
  dependents: new Set(),
  auditCourses: new Set(),
});

/** Audit → canvas: illuminate the classes satisfying a requirement. */
export function highlightAuditCourses(subjectIds: string[]): void {
  highlightState.auditCourses = new Set(subjectIds);
}

export function clearAuditHighlight(): void {
  highlightState.auditCourses = new Set();
}

let hoverTimer: ReturnType<typeof setTimeout> | undefined;

/** Begin highlighting after a beat (prevents flicker while scanning). */
export function highlightSubject(
  subject: Subject,
  selectedSubjects: SelectedSubject[][],
  catalog: CatalogView,
  delay = 120,
): void {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    const { ancestors, dependents } = computeConsequences(
      subject,
      selectedSubjects,
      catalog,
    );
    highlightState.subjectId = subject.subject_id;
    highlightState.ancestors = ancestors;
    highlightState.dependents = dependents;
  }, delay);
}

export function clearHighlight(): void {
  clearTimeout(hoverTimer);
  highlightState.subjectId = null;
  highlightState.ancestors = new Set();
  highlightState.dependents = new Set();
}
