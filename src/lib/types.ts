/**
 * Core domain types for CourseRoad.
 *
 * These types document the implicit contracts the app has always had with
 * the FireRoad API and with its own persistence formats (localStorage,
 * cookies, `.road` files). They are the single source of truth for every
 * module in `src/lib`; treat this file as the public SDK surface.
 *
 * IMPORTANT: field names here mirror FireRoad's JSON exactly (snake_case and
 * all). Renaming a field breaks byte-compatibility with saved user data.
 */

/** A subject as returned by FireRoad's `/courses/all?full=true` catalog. */
export interface Subject {
  subject_id: string;
  title: string;
  total_units?: number;
  lecture_units?: number;
  lab_units?: number;
  design_units?: number;
  preparation_units?: number;
  offered_fall?: boolean;
  offered_IAP?: boolean;
  offered_spring?: boolean;
  offered_summer?: boolean;
  /** No longer in the catalog; `source_semester` holds its last appearance. */
  is_historical?: boolean;
  /** e.g. "fall-2021", the catalog the historical entry was sourced from. */
  source_semester?: string;
  /** e.g. "2023-2024", not offered during this school year. */
  not_offered_year?: string;
  instructors?: string[];
  communication_requirement?: string;
  hass_attribute?: string;
  gir_attribute?: string;
  /** Boolean requirement string, e.g. "6.0001/(6.01, 6.02)". */
  prerequisites?: string;
  corequisites?: string;
  either_prereq_or_coreq?: boolean;
  description?: string;
  url?: string;
  related_subjects?: string[];
  joint_subjects?: string[];
  equivalent_subjects?: string[];
  /** "<quarter>,<date>" where quarter 0/1 = first/second half-term. */
  quarter_information?: string;
  rating?: number;
  enrollment_number?: number;
  in_class_hours?: number;
  out_of_class_hours?: number;
  level?: "U" | "G";
  /** Former subject id for renumbered subjects (6.0001 → 6.100A etc). */
  old_id?: string;
  /** ex: 6.0001 and 6.0002 together satisfy the 6.00 (parent) requirement */
  parent?: string;
  children?: string[];
  schedule?: string;
  virtual_status?: "Virtual" | "In-Person" | "Virtual/In-Person";
  /** false marks locally-created custom activities. */
  public?: boolean;
  custom_color?: string;
}

/** A class placed on a road. This exact shape is saved to FireRoad. */
export interface SelectedSubject {
  subject_id: string;
  title: string;
  /** Semester bucket index 0–15 (0 = Prior Credit). */
  semester: number;
  units?: number;
  overrideWarnings: boolean;
  /** Custom-activity-only fields below. */
  public?: boolean;
  in_class_hours?: number;
  out_of_class_hours?: number;
  custom_color?: string;
  offered_fall?: boolean;
  offered_IAP?: boolean;
  offered_spring?: boolean;
  offered_summer?: boolean;
  /** Legacy field still found in old saves; migrated to subject_id. */
  id?: string;
  index?: number;
}

/** Progress assertion on an audit requirement: substitution or ignore. */
export interface ProgressAssertion {
  substitutions?: string[];
  ignore?: boolean;
}

export interface RoadContents {
  coursesOfStudy: string[];
  /** 16 semester buckets of selected subjects. */
  selectedSubjects: SelectedSubject[][];
  progressOverrides: Record<string, number>;
  progressAssertions: Record<string, ProgressAssertion>;
}

export interface Road {
  /** FireRoad-format timestamps (see lib/dates.ts). */
  downloaded: string;
  changed: string;
  name: string;
  agent: string;
  contents: RoadContents;
}

/** Road contents as serialized for FireRoad / `.road` files (flattened). */
export interface FlatRoadContents {
  coursesOfStudy: string[];
  selectedSubjects: SelectedSubject[];
  progressOverrides: Record<string, number> | never[];
  progressAssertions: Record<string, ProgressAssertion>;
}

/** Entry in FireRoad's `/requirements/list_reqs/` response (plus its key). */
export interface ReqListEntry {
  key: string;
  "list-id": string;
  "short-title": string;
  "medium-title": string;
  title?: string;
  "title-no-degree"?: string;
}

/** Threshold on a requirement (e.g. "complete 2 subjects"). */
export interface ReqThreshold {
  type: "GTE" | "GT" | "LTE" | "LT";
  cutoff: number;
  criterion: "subjects" | "units" | string;
}

/**
 * A node of FireRoad's `/requirements/progress/` response tree.
 * Leaves carry `req`; branches carry `reqs`.
 */
export interface RequirementNode {
  req?: string;
  reqs?: RequirementNode[];
  "list-id"?: string;
  /** Assigned client-side; see lib/audit.ts assignListIDs. */
  uniqueKey?: string;
  title?: string;
  "short-title"?: string;
  "medium-title"?: string;
  "title-no-degree"?: string;
  "threshold-desc"?: string;
  threshold?: ReqThreshold;
  "plain-string"?: boolean;
  fulfilled?: boolean;
  percent_fulfilled?: number | "N/A";
  sat_courses?: string[];
  /**
   * Requirements satisfied out of `max`, on this node's own normalized
   * scale. A units-criterion child is folded into the parent's count rather
   * than contributing its raw unit total, so these are comparable only
   * within one program, never between two.
   */
  progress?: number;
  max?: number;
  distinct?: number;
  desc?: string;
  url?: string;
}

/** OAuth payload from FireRoad's `/fetch_token/`, stored in a cookie. */
export interface AccessInfo {
  access_token: string;
  academic_id: string;
  current_semester?: number;
  username?: string;
  success?: boolean;
}

/** Payload describing a save conflict between local and cloud roads. */
export interface ConflictInfo {
  id: string;
  other_name: string;
  other_agent: string;
  other_date: string;
  other_contents: FlatRoadContents;
  this_agent?: string;
  this_date?: string;
}

export interface SaveWarning {
  id: string;
  name: string;
  error: string;
}

/**
 * Read-only view of the loaded catalog, used by every logic module that
 * needs to resolve a subject id. Both the real store and tests provide it.
 */
export interface CatalogView {
  subjectsInfo: Subject[];
  subjectsIndex: Record<string, number>;
  genericCourses: Subject[];
  genericIndex: Record<string, number>;
}

/** Look up a subject by id across catalog and generic courses. */
export function getSubject(
  catalog: CatalogView,
  subjectID: string,
): Subject | undefined {
  if (subjectID in catalog.subjectsIndex) {
    return catalog.subjectsInfo[catalog.subjectsIndex[subjectID]];
  }
  if (subjectID in catalog.genericIndex) {
    return catalog.genericCourses[catalog.genericIndex[subjectID]];
  }
  return undefined;
}

/** Flatten semester buckets into a single list (old `flatten` mixin). */
export function flatten<T>(array: T[][]): T[] {
  return ([] as T[]).concat(...array);
}
