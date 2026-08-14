/**
 * Road data plumbing: bucket conversion, sanitization of roads arriving
 * from FireRoad or `.road` files, save/export formatting, renumbered
 * subject-id migration, and road-name deduplication.
 *
 * Ported from sanitizeSubjects.js, Auth.vue, ImportExport.vue and the
 * Vuex store. The flattened save format is FireRoad's contract; keep it
 * byte-compatible.
 */

import type {
  CatalogView,
  FlatRoadContents,
  Road,
  RoadContents,
  SelectedSubject,
} from "./types";
import { flatten } from "./types";
import { isCustomColor } from "./colors";
import { formatFireroadDate } from "./dates";
import { NUM_SEMESTERS } from "./offering";

export const DEFAULT_ROAD_ID = "$defaultroad$";
export const DEFAULT_ROAD_NAME = "My First Road";

/** Empty 16-bucket selected-subjects array. */
export function emptySelectedSubjects(): SelectedSubject[][] {
  return Array.from(Array(NUM_SEMESTERS), () => []);
}

/** A fresh road (default contents = GIRs only). */
export function newRoad(
  name: string,
  coursesOfStudy: string[] = ["girs"],
  selectedSubjects: SelectedSubject[][] = emptySelectedSubjects(),
  progressOverrides: Record<string, number> = {},
): Road {
  return {
    downloaded: formatFireroadDate(),
    changed: formatFireroadDate(),
    name,
    agent: "",
    contents: {
      coursesOfStudy,
      selectedSubjects,
      progressOverrides,
      progressAssertions: {},
    },
  };
}

/**
 * Convert a flat selected-subjects list into the 16-bucket layout
 * (subjects with missing/negative semesters land in Prior Credit).
 */
export function getSimpleSelectedSubjects(
  selectedSubjects: SelectedSubject[],
): SelectedSubject[][] {
  const simpless = emptySelectedSubjects();
  for (let i = 0; i < selectedSubjects.length; i++) {
    const s = selectedSubjects[i];
    // Canonicalize to an integer bucket index in [0,15] and ALWAYS write it
    // back. Coercing without reassigning would leave non-canonical values
    // (null, "", "03", " 3", false, []), all of which Number() maps to a
    // valid in-range integer, in place, so simpless[s.semester] indexed a
    // missing array property and threw inside the cloud/cookie load path
    // (→ logout + localStorage wipe). Missing/negative/NaN → Prior Credit;
    // out-of-range/fractional → clamped to the last bucket.
    const n = Number(s.semester);
    const sem = !Number.isFinite(n) || n < 0 ? 0 : Math.min(15, Math.floor(n));
    s.semester = sem;
    simpless[sem].push(s);
  }
  return simpless;
}

/**
 * Normalize one incoming subject: the legacy `id` field becomes
 * `subject_id`, and a `custom_color` that names no palette entry is
 * dropped. Both `.road` imports and cloud payloads carry arbitrary JSON
 * here, and the render paths read `custom_color` directly, so a value that
 * is not a real palette reference has to be removed at ingest rather than
 * guarded at each of the several places that draw a class.
 */
function normalizeIncomingSubject(s: SelectedSubject): SelectedSubject {
  if ("id" in s && s.id !== undefined) {
    s.subject_id = s.id;
    delete s.id;
  }
  if (!isCustomColor(s.custom_color)) {
    delete s.custom_color;
  }
  return s;
}

/**
 * Normalize a road object arriving from FireRoad (legacy `id` field,
 * missing progress maps, flat subject list → buckets). Mutates and
 * returns the road.
 */
export function sanitizeRoad(road: Road): Road {
  const flatSubjects = road.contents
    .selectedSubjects as unknown as SelectedSubject[];
  const newss = flatSubjects.map(normalizeIncomingSubject);
  // convert selected subjects to more convenient format
  road.contents.selectedSubjects = getSimpleSelectedSubjects(newss);
  if (road.contents.progressOverrides === undefined) {
    road.contents.progressOverrides = {};
  }
  if (road.contents.progressAssertions === undefined) {
    road.contents.progressAssertions = {};
  }
  return road;
}

/**
 * Road contents flattened for saving to FireRoad / exporting as `.road`.
 * Matches the legacy byte format exactly (including the odd
 * `progressOverrides: []` default for exports).
 */
export function formatRoadContents(contents: RoadContents): FlatRoadContents {
  return Object.assign(
    {
      coursesOfStudy: ["girs"],
      progressOverrides: [] as never[],
      progressAssertions: {},
    },
    contents,
    { selectedSubjects: flatten(contents.selectedSubjects) },
  );
}

/**
 * Update subjects that are no longer in the catalog (or are historical)
 * to their renumbered successors via `old_id`. Mutates road contents.
 */
export function migrateOldSubjects(road: Road, catalog: CatalogView): void {
  for (let i = 0; i < NUM_SEMESTERS; i++) {
    for (let j = 0; j < road.contents.selectedSubjects[i].length; j++) {
      const subject = road.contents.selectedSubjects[i][j];
      const subjectIndex = catalog.subjectsIndex[subject.subject_id];
      const genericIndex = catalog.genericIndex[subject.subject_id];
      const notInCatalog =
        subjectIndex === undefined && genericIndex === undefined;
      const isHistorical =
        subjectIndex !== undefined &&
        catalog.subjectsInfo[subjectIndex].is_historical;
      if (notInCatalog || isHistorical) {
        // Look for subject with old ID
        const oldSubjects = catalog.subjectsInfo.filter(
          (subj) => subj.old_id === subject.subject_id,
        );
        if (oldSubjects.length > 0) {
          const oldSubject = oldSubjects[0];
          subject.subject_id = oldSubject.subject_id;
          subject.title = oldSubject.title;
          subject.units = oldSubject.total_units;
        }
      }
    }
  }
}

/** Fields every imported subject must carry (back-filled from catalog). */
const EXPECTED_IMPORT_FIELDS = [
  "index",
  "title",
  "overrideWarnings",
  "semester",
  "units",
  "subject_id",
] as const;

export class RoadImportError extends Error {}

/**
 * Parse and sanitize `.road` file text into road pieces ready for
 * addRoad. Custom activities (marked `public: false`, the same marker the
 * rest of the app uses) carry their own units and hours and pass through
 * without catalog resolution. Other unknown subjects are rescued via
 * old_id or dropped, and the dropped ids are returned so callers can say
 * so; missing fields are back-filled from the catalog. Throws
 * RoadImportError on malformed input.
 */
export function parseRoadFile(
  text: string,
  catalog: CatalogView,
): {
  coursesOfStudy: string[];
  selectedSubjects: SelectedSubject[][];
  progressOverrides: Record<string, number>;
  /** subject_ids that resolved nowhere and were left out of the road. */
  droppedSubjects: string[];
} {
  let obj: FlatRoadContents;
  try {
    obj = JSON.parse(text);
  } catch (error) {
    throw new RoadImportError(`not valid JSON: ${error}`);
  }
  // JSON.parse also accepts null and bare primitives; the property reads
  // below would turn those into TypeErrors, which the documented contract
  // says must surface as RoadImportError.
  if (obj === null || typeof obj !== "object") {
    throw new RoadImportError("not a road object");
  }
  if (!Array.isArray(obj.selectedSubjects)) {
    throw new RoadImportError("missing selectedSubjects");
  }
  // progressOverrides must be defined
  if (obj.progressOverrides === undefined) {
    obj.progressOverrides = {};
  }
  // legacy `id` field issue
  const newss = obj.selectedSubjects.map(normalizeIncomingSubject);

  const droppedSubjects: string[] = [];
  const ss = newss
    .map((s) => {
      // A custom activity is its own record: it carries its units and
      // hours and its id is user-chosen, so the catalog can never resolve
      // it. It passes through whole, or an export with a UROP on it lost
      // the UROP on re-import.
      if (s.public === false) {
        if (s.overrideWarnings === undefined) {
          s.overrideWarnings = false;
        }
        return s;
      }
      // make sure it has everything; if not, fill from the catalog
      let subject;
      if (catalog.subjectsIndex[s.subject_id] !== undefined) {
        subject = catalog.subjectsInfo[catalog.subjectsIndex[s.subject_id]];
      } else if (catalog.genericIndex[s.subject_id] !== undefined) {
        subject = catalog.genericCourses[catalog.genericIndex[s.subject_id]];
      }
      if (subject === undefined) {
        const oldSubjects = catalog.subjectsInfo.filter(
          (subj) => subj.old_id === s.subject_id,
        );
        if (oldSubjects.length > 0) {
          subject = oldSubjects[0];
          s.subject_id = subject.subject_id;
        }
      }
      if (subject !== undefined) {
        for (const f of EXPECTED_IMPORT_FIELDS) {
          if (s[f] === undefined) {
            if (f === "units") {
              s[f] = subject.total_units;
            } else {
              (s as unknown as Record<string, unknown>)[f] = (
                subject as unknown as Record<string, unknown>
              )[f];
            }
          }
        }
        return s;
      }
      if (typeof s.subject_id === "string") {
        droppedSubjects.push(s.subject_id);
      }
      return undefined;
    })
    .filter((s): s is SelectedSubject => s !== undefined);

  return {
    coursesOfStudy: obj.coursesOfStudy ?? ["girs"],
    selectedSubjects: getSimpleSelectedSubjects(ss),
    progressOverrides: obj.progressOverrides as Record<string, number>,
    droppedSubjects,
  };
}

/** "Name (2)", "Name (3)", …: first numbered name not in otherNames. */
export function renumberName(name: string, otherNames: string[]): string {
  let newName;
  let copyIndex = 2;
  while (newName === undefined) {
    const copyName = name + " (" + copyIndex + ")";
    if (otherNames.indexOf(copyName) === -1) {
      newName = copyName;
    }
    copyIndex++;
  }
  return newName;
}

/**
 * The first free name from `base`: `base` itself, then "base (2)",
 * "base (3)". Compared case-insensitively, the same way
 * otherRoadHasName compares, so the result never collides with the
 * duplicate-name check that guards renaming and importing.
 */
export function uniqueRoadName(
  roads: Record<string, Road>,
  base: string,
): string {
  const taken = new Set(
    Object.values(roads).map((road) => road.name.toLowerCase()),
  );
  if (!taken.has(base.toLowerCase())) {
    return base;
  }
  let copyIndex = 2;
  while (taken.has(`${base} (${copyIndex})`.toLowerCase())) {
    copyIndex++;
  }
  return `${base} (${copyIndex})`;
}

/** Case-insensitive check that another road already uses `roadName`. */
export function otherRoadHasName(
  roads: Record<string, Road>,
  roadID: string,
  roadName: string,
): boolean {
  const otherRoadNames = Object.keys(roads).map((road) =>
    road === roadID ? undefined : roads[road].name.toLowerCase(),
  );
  return otherRoadNames.indexOf(roadName.toLowerCase()) >= 0;
}
