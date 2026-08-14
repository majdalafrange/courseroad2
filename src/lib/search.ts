/**
 * Subject search with identical semantics to the legacy ClassSearch
 * autocomplete (text match over subject_id/title/old_id + instructor
 * names, AND across filter groups, ranked literal/prefix first), plus an
 * incremental index: when the new query extends the previous one as a
 * plain literal (the overwhelmingly common case while typing), only the
 * previous result set is re-scanned instead of the full ~6000-subject
 * catalog. Regex queries and filter changes fall back to a full scan, so
 * results are always exactly what a full scan would produce.
 */

import type { Subject } from "./types";
import {
  FilterGroup,
  RegexFilter,
  buildSearchFilterGroups,
  emptyChosenFilters,
  instructorFilter,
  textFilter,
  toAttributeBag,
} from "./filters";

export type ChosenFilters = Record<string, boolean[]>;

export class SearchIndex {
  private allSubjects: Subject[] = [];
  private filterGroups: Record<string, FilterGroup> = buildSearchFilterGroups();
  private lastQuery: string | null = null;
  private lastFilters: string | null = null;
  private lastCandidates: Subject[] | null = null;

  setSubjects(allSubjects: Subject[]): void {
    this.allSubjects = allSubjects;
    this.lastQuery = null;
    this.lastFilters = null;
    this.lastCandidates = null;
  }

  get groups(): Record<string, FilterGroup> {
    return this.filterGroups;
  }

  /**
   * Search with the legacy semantics. Returns [] when neither text nor any
   * filter is active (the old "only display subjects if filtering" rule).
   */
  search(
    nameInput: string,
    chosenFilters: ChosenFilters = emptyChosenFilters(),
  ): Subject[] {
    const anyFilterActive = Object.keys(chosenFilters).some((g) =>
      chosenFilters[g].some((f) => f),
    );
    if (nameInput.length === 0 && !anyFilterActive) {
      this.lastQuery = null;
      this.lastCandidates = null;
      return [];
    }

    textFilter.setupInputs({ nameInput });
    instructorFilter.setupInputs({ nameInput });

    // Incremental narrowing: matching results for "6.00" are a superset of
    // results for "6.004" only when both behave as literals (no regex
    // metacharacters); regexes are not monotonic under extension.
    const filtersKey = JSON.stringify(chosenFilters);
    const isLiteral = RegexFilter.escapeRegex(nameInput) === nameInput;
    const canNarrow =
      isLiteral &&
      this.lastQuery !== null &&
      this.lastCandidates !== null &&
      this.lastFilters === filtersKey &&
      nameInput.startsWith(this.lastQuery) &&
      RegexFilter.escapeRegex(this.lastQuery) === this.lastQuery;

    const searchSpace = canNarrow
      ? (this.lastCandidates as Subject[])
      : this.allSubjects;

    const filteredSubjects = searchSpace.filter((subject) => {
      const matches =
        textFilter.matches(toAttributeBag(subject)) ||
        instructorFilter.matches(toAttributeBag(subject));
      return (
        matches &&
        Object.keys(this.filterGroups).every((filterGroup) =>
          this.filterGroups[filterGroup].matches(
            toAttributeBag(subject),
            chosenFilters[filterGroup] ?? [],
          ),
        )
      );
    });

    this.lastQuery = nameInput;
    this.lastFilters = filtersKey;
    this.lastCandidates = filteredSubjects;

    if (nameInput.length) {
      // Sort first by literal-vs-regex match, then by prefix match
      textFilter.setupVariants(
        { nameInput },
        { atStart: true, asLiteral: true },
        ["asLiteral", "atStart"],
      );
      const ranks = new Map<Subject, number>();
      for (const subject of filteredSubjects) {
        ranks.set(
          subject,
          textFilter.compareByVariants(toAttributeBag(subject)),
        );
      }
      return [...filteredSubjects].sort(
        (subject1, subject2) =>
          (ranks.get(subject2) as number) - (ranks.get(subject1) as number),
      );
    }
    return filteredSubjects;
  }
}
