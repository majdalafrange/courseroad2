import { describe, expect, it } from "vitest";
import { buildSuggestions } from "../../../src/lib/suggestions";
import type { RequirementNode } from "../../../src/lib/types";
import { makeCatalog, makeSubject, emptyBuckets, placed } from "./fixtures";

/** A catalog with several HASS-A options at different ratings. */
const catalog = makeCatalog([
  makeSubject({
    subject_id: "21M.301",
    title: "Harmony I",
    hass_attribute: "HASS-A",
    offered_fall: true,
    offered_spring: true,
    rating: 6.2,
    in_class_hours: 4,
    out_of_class_hours: 6,
  }),
  makeSubject({
    subject_id: "21M.011",
    title: "Intro to Music",
    hass_attribute: "HASS-A",
    offered_fall: true,
    offered_spring: false,
    rating: 6.8,
    in_class_hours: 3,
    out_of_class_hours: 6,
  }),
  makeSubject({
    subject_id: "4.301",
    title: "Intro to Studio Art",
    hass_attribute: "HASS-A",
    offered_fall: false,
    offered_spring: true,
    rating: 5.0,
  }),
  makeSubject({
    subject_id: "OLD.001",
    title: "Defunct Arts",
    hass_attribute: "HASS-A",
    offered_fall: true,
    is_historical: true,
    rating: 7.0,
  }),
]);

function girsTree(): RequirementNode {
  return {
    "list-id": "girs",
    reqs: [
      { req: "HASS-A", fulfilled: false },
      { req: "HASS-S", fulfilled: false },
      { req: "GIR:CAL1", fulfilled: true },
    ],
  };
}

describe("buildSuggestions", () => {
  it("suggests highly-rated classes for an unfilled attribute gap", () => {
    const suggestions = buildSuggestions({
      catalog,
      reqTrees: { girs: girsTree() },
      selectedSubjects: emptyBuckets(),
      currentSemester: 3, // spring (bucket 3 = Freshman Spring)
      hideIAP: true,
      now: new Date(2026, 1, 1), // February, not May → no bump
    });
    const hassA = suggestions.find((s) => s.attribute === "HASS-A");
    expect(hassA).toBeDefined();
    // Spring term: 21M.301 and 4.301 are offered; sorted by rating
    const ids = hassA!.classes.map((c) => c.subject.subject_id);
    expect(ids[0]).toBe("21M.301"); // 6.2 > 5.0
    expect(ids).toContain("4.301");
    expect(ids).not.toContain("21M.011"); // fall-only
    expect(hassA!.tokens).toEqual(["hass-a"]);
  });

  it("excludes historical and already-planned subjects", () => {
    const buckets = emptyBuckets();
    buckets[3].push(placed("21M.301", 3)); // already on the road
    const suggestions = buildSuggestions({
      catalog,
      reqTrees: { girs: girsTree() },
      selectedSubjects: buckets,
      currentSemester: 3,
      hideIAP: true,
      now: new Date(2026, 1, 1),
    });
    const hassA = suggestions.find((s) => s.attribute === "HASS-A");
    const ids = hassA!.classes.map((c) => c.subject.subject_id);
    expect(ids).not.toContain("21M.301"); // already planned
    expect(ids).not.toContain("OLD.001"); // historical
  });

  it("returns nothing when there are no attribute gaps", () => {
    const tree: RequirementNode = {
      reqs: [{ req: "HASS-A", fulfilled: true }],
    };
    expect(
      buildSuggestions({
        catalog,
        reqTrees: { girs: tree },
        selectedSubjects: emptyBuckets(),
        currentSemester: 3,
        hideIAP: true,
        now: new Date(2026, 1, 1),
      }),
    ).toEqual([]);
  });

  it("counts how many of an attribute remain", () => {
    const tree: RequirementNode = {
      reqs: [
        { req: "HASS-A", fulfilled: false },
        { req: "HASS-A", fulfilled: false },
      ],
    };
    const suggestions = buildSuggestions({
      catalog,
      reqTrees: { girs: tree },
      selectedSubjects: emptyBuckets(),
      currentSemester: 3,
      hideIAP: true,
      now: new Date(2026, 1, 1),
    });
    expect(suggestions[0].headline).toContain("2 more");
  });
});
