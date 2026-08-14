import { describe, expect, it } from "vitest";
import { SearchIndex } from "../../../src/lib/search";
import { emptyChosenFilters } from "../../../src/lib/filters";
import { SUBJECTS, GENERIC_COURSES, makeSubject } from "./fixtures";
import type { Subject } from "../../../src/lib/types";

const ALL = [...GENERIC_COURSES, ...SUBJECTS];

function freshIndex(subjects: Subject[] = ALL): SearchIndex {
  const index = new SearchIndex();
  index.setSubjects(subjects);
  return index;
}

describe("SearchIndex", () => {
  it("returns nothing when no text or filters are active", () => {
    expect(freshIndex().search("")).toEqual([]);
  });

  it("matches on subject id, title, and old id", () => {
    const index = freshIndex();
    expect(index.search("8.01").map((s) => s.subject_id)).toContain("8.01");
    expect(index.search("Algorithms").map((s) => s.subject_id)).toContain(
      "6.006",
    );
    // old_id of 6.0001 is 6.001
    expect(index.search("6.001").map((s) => s.subject_id)).toContain("6.0001");
  });

  it("matches instructors", () => {
    const subjects = [
      ...ALL,
      makeSubject({
        subject_id: "9.99",
        title: "Course With Prof",
        instructors: ["Eric Demaine"],
      }),
    ];
    const index = freshIndex(subjects);
    expect(index.search("demaine").map((s) => s.subject_id)).toEqual(["9.99"]);
  });

  it("ranks prefix matches before mid-string matches", () => {
    const subjects = [
      makeSubject({ subject_id: "16.006", title: "Other" }),
      makeSubject({ subject_id: "6.006", title: "Algorithms" }),
    ];
    const results = freshIndex(subjects).search("6.006");
    expect(results[0].subject_id).toBe("6.006");
    expect(results[1].subject_id).toBe("16.006");
  });

  it("applies filter groups (AND across, OR within)", () => {
    const index = freshIndex();
    const filters = emptyChosenFilters();
    filters.hass = [false, true, false, false, false]; // HASS-A
    const results = index.search("", filters);
    expect(results.map((s) => s.subject_id).sort()).toEqual([
      "21M.301",
      "HASS-A",
    ]);
    // add term filter: HASS-A AND offered fall
    filters.terms = [true, false, false];
    const results2 = index.search("", filters);
    expect(results2.every((s) => s.offered_fall)).toBe(true);
  });

  it("incremental narrowing returns exactly the full-scan results", () => {
    const index = freshIndex();
    const fresh = freshIndex();
    // Type "6", then "6.", then "6.0", then "6.00"; narrowing kicks in
    const queries = ["6", "6.", "6.0", "6.00", "6.006"];
    for (const q of queries) {
      const narrowed = index.search(q);
      const fullScan = fresh.search(q);
      expect(narrowed.map((s) => s.subject_id)).toEqual(
        fullScan.map((s) => s.subject_id),
      );
      fresh.setSubjects(ALL); // reset memo so fresh always full-scans
    }
  });

  it("handles regex queries without narrowing corruption", () => {
    const index = freshIndex();
    index.search("6.0");
    // A regex that matches MORE than the literal-narrowed set would
    const results = index.search("6.0|8.01");
    expect(results.map((s) => s.subject_id)).toContain("8.01");
  });

  it("finds generic placeholder courses", () => {
    const index = freshIndex();
    expect(index.search("PHY1").map((s) => s.subject_id)).toContain("PHY1");
  });
});
