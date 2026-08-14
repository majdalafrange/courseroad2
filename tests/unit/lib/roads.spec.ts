import { describe, expect, it } from "vitest";
import {
  emptySelectedSubjects,
  formatRoadContents,
  getSimpleSelectedSubjects,
  migrateOldSubjects,
  newRoad,
  otherRoadHasName,
  parseRoadFile,
  renumberName,
  sanitizeRoad,
  uniqueRoadName,
} from "../../../src/lib/roads";
import { RoadImportError } from "../../../src/lib/roads";
import type {
  Road,
  RoadContents,
  SelectedSubject,
} from "../../../src/lib/types";
import { makeCatalog, placed } from "./fixtures";

const catalog = makeCatalog();

describe("custom_color validation at ingest", () => {
  it("drops a malformed custom_color on import, keeping valid ones", () => {
    // parseRoadFile back-fills only EXPECTED_IMPORT_FIELDS, so custom_color
    // used to survive untouched on any subject whose id resolved.
    const file = JSON.stringify({
      coursesOfStudy: ["girs"],
      selectedSubjects: [
        { subject_id: "6.006", semester: 1, custom_color: 5 },
        { subject_id: "8.01", semester: 1, custom_color: "@999" },
        { subject_id: "18.01", semester: 1, custom_color: "@5" },
      ],
      progressOverrides: {},
    });
    const bucket = parseRoadFile(file, catalog).selectedSubjects[1];
    const colorFor = (id: string) =>
      bucket.find((s) => s.subject_id === id)?.custom_color;
    expect(colorFor("6.006")).toBeUndefined();
    expect(colorFor("8.01")).toBeUndefined();
    expect(colorFor("18.01")).toBe("@5");
  });

  it("drops a malformed custom_color arriving from the cloud", () => {
    const road = {
      downloaded: "",
      changed: "",
      name: "Cloud",
      agent: "",
      contents: {
        coursesOfStudy: ["girs"],
        selectedSubjects: [
          { ...placed("6.006", 1), custom_color: 5 },
          { ...placed("18.01", 1), custom_color: "@5" },
        ],
        progressOverrides: {},
        progressAssertions: {},
      },
    } as unknown as Road;
    sanitizeRoad(road);
    expect(road.contents.selectedSubjects[1][0].custom_color).toBeUndefined();
    expect(road.contents.selectedSubjects[1][1].custom_color).toBe("@5");
  });
});

describe("getSimpleSelectedSubjects", () => {
  it("buckets a flat list by semester", () => {
    const flat = [placed("8.01", 1), placed("18.01", 3), placed("6.006", 1)];
    const buckets = getSimpleSelectedSubjects(flat);
    expect(buckets).toHaveLength(16);
    expect(buckets[1].map((s) => s.subject_id)).toEqual(["8.01", "6.006"]);
    expect(buckets[3].map((s) => s.subject_id)).toEqual(["18.01"]);
  });

  it("rescues missing/negative semesters into Prior Credit", () => {
    const flat = [
      { ...placed("8.01", 0), semester: undefined } as never,
      placed("18.01", -2),
    ];
    const buckets = getSimpleSelectedSubjects(flat as SelectedSubject[]);
    expect(buckets[0].map((s) => s.subject_id)).toEqual(["8.01", "18.01"]);
  });

  it("clamps out-of-range / fractional semesters instead of crashing (B1)", () => {
    // A corrupt cloud/cookie road with semester > 15 or a fractional value
    // used to index past the 16 buckets and throw inside the load path.
    const flat = [
      placed("6.006", 16),
      placed("8.01", 40),
      placed("18.03", 1.5),
      { ...placed("2.001", 0), semester: NaN } as never,
    ];
    expect(() =>
      getSimpleSelectedSubjects(flat as SelectedSubject[]),
    ).not.toThrow();
    const buckets = getSimpleSelectedSubjects(flat as SelectedSubject[]);
    expect(buckets).toHaveLength(16);
    // 16 and 40 clamp to the last bucket (15); 1.5 floors to 1; NaN → Prior Credit.
    expect(buckets[15].map((s) => s.subject_id)).toEqual(["6.006", "8.01"]);
    expect(buckets[1].map((s) => s.subject_id)).toEqual(["18.03"]);
    expect(buckets[0].map((s) => s.subject_id)).toEqual(["2.001"]);
  });

  it("canonicalizes coercible-but-non-canonical semesters (B1, round 2)", () => {
    // Number(x) maps all of these to a valid in-range integer, so an earlier
    // clamp that only reassigned out-of-range values left them in place and
    // simpless[s.semester] crashed on the cloud/cookie load path.
    const flat = [
      { ...placed("6.006", 0), semester: null } as never,
      { ...placed("8.01", 0), semester: "" } as never,
      { ...placed("7.01", 0), semester: false } as never,
      { ...placed("18.03", 0), semester: "03" } as never,
      { ...placed("2.001", 0), semester: " 3" } as never,
    ];
    const buckets = getSimpleSelectedSubjects(flat as SelectedSubject[]);
    // null / "" / false → Prior Credit; "03" and " 3" → bucket 3.
    expect(buckets[0].map((s) => s.subject_id)).toEqual([
      "6.006",
      "8.01",
      "7.01",
    ]);
    expect(buckets[3].map((s) => s.subject_id)).toEqual(["18.03", "2.001"]);
    // Every semester is now a canonical integer, so no bucket index can miss.
    for (const bucket of buckets) {
      for (const s of bucket) {
        expect(Number.isInteger(s.semester)).toBe(true);
      }
    }
  });
});

describe("sanitizeRoad", () => {
  it("migrates legacy id fields, buckets subjects, defaults maps", () => {
    const road = {
      downloaded: "x",
      changed: "x",
      name: "Test",
      agent: "",
      contents: {
        coursesOfStudy: ["girs"],
        selectedSubjects: [
          { id: "8.01", title: "t", semester: 1, overrideWarnings: false },
        ],
      },
    } as unknown as Road;
    sanitizeRoad(road);
    expect(road.contents.selectedSubjects[1][0].subject_id).toBe("8.01");
    expect(road.contents.selectedSubjects[1][0].id).toBeUndefined();
    expect(road.contents.progressOverrides).toEqual({});
    expect(road.contents.progressAssertions).toEqual({});
  });
});

describe("the .road byte format (golden)", () => {
  // These strings are the wire format FireRoad stores and students'
  // exported files carry. A failure here means the bytes changed;
  // changing an expectation is a deliberate format-compatibility
  // decision, never a test fix.
  it("serializes contents byte-identically to the legacy format", () => {
    const road = newRoad("Golden");
    road.contents.selectedSubjects[1].push(placed("8.01", 1));
    expect(JSON.stringify(formatRoadContents(road.contents))).toBe(
      '{"coursesOfStudy":["girs"],"progressOverrides":{},"progressAssertions":{},' +
        '"selectedSubjects":[{"subject_id":"8.01","title":"8.01","semester":1,' +
        '"units":12,"overrideWarnings":false}]}',
    );
  });

  it("emits the legacy [] default when progressOverrides is absent", () => {
    const road = newRoad("Golden");
    delete (road.contents as Partial<RoadContents>).progressOverrides;
    expect(JSON.stringify(formatRoadContents(road.contents))).toBe(
      '{"coursesOfStudy":["girs"],"progressOverrides":[],' +
        '"progressAssertions":{},"selectedSubjects":[]}',
    );
  });

  it("round-trips through parseRoadFile", () => {
    const road = newRoad("Golden", ["girs", "major6-3"]);
    road.contents.selectedSubjects[1].push(placed("8.01", 1));
    road.contents.selectedSubjects[4].push(placed("6.006", 4));
    const text = JSON.stringify(formatRoadContents(road.contents));
    const parsed = parseRoadFile(text, catalog);
    expect(parsed.coursesOfStudy).toEqual(["girs", "major6-3"]);
    expect(parsed.selectedSubjects[1].map((s) => s.subject_id)).toEqual([
      "8.01",
    ]);
    expect(parsed.selectedSubjects[4].map((s) => s.subject_id)).toEqual([
      "6.006",
    ]);
    expect(parsed.progressOverrides).toEqual({});
  });
});

describe("formatRoadContents", () => {
  it("flattens buckets and keeps assertions/overrides", () => {
    const road = newRoad("Mine");
    road.contents.selectedSubjects[1].push(placed("8.01", 1));
    road.contents.selectedSubjects[4].push(placed("6.006", 4));
    road.contents.progressAssertions = { "major6.0": { ignore: true } };
    const flat = formatRoadContents(road.contents);
    expect(flat.selectedSubjects.map((s) => s.subject_id)).toEqual([
      "8.01",
      "6.006",
    ]);
    expect(flat.coursesOfStudy).toEqual(["girs"]);
    expect(flat.progressAssertions).toEqual({ "major6.0": { ignore: true } });
  });
});

describe("migrateOldSubjects", () => {
  it("renumbers subjects via old_id when missing from the catalog", () => {
    const road = newRoad("Test");
    road.contents.selectedSubjects[1].push(placed("6.001", 1)); // old id of 6.0001
    migrateOldSubjects(road, catalog);
    const migrated = road.contents.selectedSubjects[1][0];
    expect(migrated.subject_id).toBe("6.0001");
    expect(migrated.units).toBe(6);
  });

  it("leaves current subjects alone", () => {
    const road = newRoad("Test");
    road.contents.selectedSubjects[1].push(placed("8.01", 1));
    migrateOldSubjects(road, catalog);
    expect(road.contents.selectedSubjects[1][0].subject_id).toBe("8.01");
  });
});

describe("parseRoadFile", () => {
  it("imports a valid road file, back-filling fields", () => {
    const text = JSON.stringify({
      coursesOfStudy: ["girs", "major6-3"],
      selectedSubjects: [
        { subject_id: "8.01", semester: 1 },
        { id: "18.01", semester: 1 },
        { subject_id: "TOTALLY.FAKE", semester: 2 },
      ],
    });
    const parsed = parseRoadFile(text, catalog);
    expect(parsed.coursesOfStudy).toEqual(["girs", "major6-3"]);
    expect(parsed.selectedSubjects[1].map((s) => s.subject_id)).toEqual([
      "8.01",
      "18.01",
    ]);
    // Unknown subject dropped
    expect(parsed.selectedSubjects[2]).toEqual([]);
    // Back-filled from catalog
    expect(parsed.selectedSubjects[1][0].title).toBe("Classical Mechanics");
    expect(parsed.selectedSubjects[1][0].units).toBe(12);
  });

  it("rescues renumbered subjects via old_id", () => {
    const text = JSON.stringify({
      selectedSubjects: [{ subject_id: "6.001", semester: 2 }],
    });
    const parsed = parseRoadFile(text, catalog);
    expect(parsed.selectedSubjects[2][0].subject_id).toBe("6.0001");
  });

  it("keeps a custom activity through an export then import round trip", () => {
    // A custom activity's id is user-chosen and never in the catalog; the
    // importer used to resolve it nowhere and drop it, so exporting a road
    // with a UROP on it and importing it back lost the UROP.
    const road = newRoad("Mine");
    road.contents.selectedSubjects[1].push(placed("8.01", 1));
    road.contents.selectedSubjects[1].push({
      overrideWarnings: false,
      semester: 1,
      title: "Soft Robotics UROP",
      subject_id: "UROP1",
      units: 9,
      in_class_hours: 0,
      out_of_class_hours: 9,
      custom_color: "@4",
      public: false,
      offered_fall: true,
      offered_IAP: true,
      offered_spring: true,
      offered_summer: true,
    });
    const text = JSON.stringify(formatRoadContents(road.contents));
    const parsed = parseRoadFile(text, catalog);
    expect(parsed.selectedSubjects[1].map((s) => s.subject_id)).toEqual([
      "8.01",
      "UROP1",
    ]);
    const urop = parsed.selectedSubjects[1][1];
    expect(urop.title).toBe("Soft Robotics UROP");
    expect(urop.units).toBe(9);
    expect(urop.in_class_hours).toBe(0);
    expect(urop.out_of_class_hours).toBe(9);
    expect(urop.custom_color).toBe("@4");
    expect(urop.public).toBe(false);
    expect(parsed.droppedSubjects).toEqual([]);
  });

  it("names the entries it drops instead of discarding them silently", () => {
    const text = JSON.stringify({
      selectedSubjects: [
        { subject_id: "8.01", semester: 1 },
        { subject_id: "TOTALLY.FAKE", semester: 2 },
        { subject_id: "ALSO.FAKE", semester: 3 },
      ],
    });
    const parsed = parseRoadFile(text, catalog);
    expect(parsed.selectedSubjects[1].map((s) => s.subject_id)).toEqual([
      "8.01",
    ]);
    expect(parsed.droppedSubjects).toEqual(["TOTALLY.FAKE", "ALSO.FAKE"]);
  });

  it("throws RoadImportError on malformed input", () => {
    expect(() => parseRoadFile("not json{", catalog)).toThrow(RoadImportError);
    expect(() => parseRoadFile("{}", catalog)).toThrow(RoadImportError);
  });

  it("throws RoadImportError, not TypeError, on non-object JSON", () => {
    // "null" parses to null; obj.selectedSubjects on null used to throw
    // a raw TypeError, breaking the documented contract.
    expect(() => parseRoadFile("null", catalog)).toThrow(RoadImportError);
    expect(() => parseRoadFile("42", catalog)).toThrow(RoadImportError);
    expect(() => parseRoadFile('"road"', catalog)).toThrow(RoadImportError);
  });

  it("throws RoadImportError when selectedSubjects is not an array", () => {
    expect(() => parseRoadFile('{"selectedSubjects": {}}', catalog)).toThrow(
      RoadImportError,
    );
    expect(() =>
      parseRoadFile('{"selectedSubjects": "6.006"}', catalog),
    ).toThrow(RoadImportError);
  });
});

describe("road names", () => {
  it("renumbers copies", () => {
    expect(renumberName("Mine", ["Mine"])).toBe("Mine (2)");
    expect(renumberName("Mine", ["Mine", "Mine (2)"])).toBe("Mine (3)");
  });

  it("detects duplicate names case-insensitively", () => {
    const roads = { a: newRoad("My Road"), b: newRoad("Other") };
    expect(otherRoadHasName(roads, "b", "my road")).toBe(true);
    expect(otherRoadHasName(roads, "a", "My Road")).toBe(false); // own name
    expect(otherRoadHasName(roads, "", "Third")).toBe(false);
  });

  it("suggests the first free name, counting from the base", () => {
    expect(uniqueRoadName({}, "Imported road")).toBe("Imported road");
    expect(uniqueRoadName({ a: newRoad("Other") }, "Imported road")).toBe(
      "Imported road",
    );
    expect(
      uniqueRoadName({ a: newRoad("Imported road") }, "Imported road"),
    ).toBe("Imported road (2)");
    expect(
      uniqueRoadName(
        { a: newRoad("Imported road"), b: newRoad("Imported road (2)") },
        "Imported road",
      ),
    ).toBe("Imported road (3)");
  });

  it("suggests a name the duplicate check will accept", () => {
    // otherRoadHasName compares case-insensitively, so a suggestion that
    // only differs in case would land straight on the disabled state it
    // exists to avoid.
    const roads = { a: newRoad("imported ROAD") };
    const suggested = uniqueRoadName(roads, "Imported road");
    expect(suggested).toBe("Imported road (2)");
    expect(otherRoadHasName(roads, "new", suggested)).toBe(false);
  });
});

describe("newRoad", () => {
  it("creates 16 empty buckets and girs default", () => {
    const road = newRoad("Fresh");
    expect(road.contents.selectedSubjects).toHaveLength(16);
    expect(road.contents.coursesOfStudy).toEqual(["girs"]);
    expect(emptySelectedSubjects().every((b) => b.length === 0)).toBe(true);
  });
});
