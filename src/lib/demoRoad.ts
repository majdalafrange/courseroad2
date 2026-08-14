/**
 * A realistic Course 6-3 four-year plan, used by the dev-only `?demo=1`
 * seed (screenshots, design review) and later by onboarding previews.
 * Subject ids are post-2022 renumberings; unknown ids are dropped by the
 * importer, so catalog drift degrades gracefully.
 */

import type { FlatRoadContents } from "./types";

export const DEMO_ROAD_NAME = "Course 6-3";

export const DEMO_ROAD: FlatRoadContents = {
  coursesOfStudy: ["girs", "major6-3"],
  progressOverrides: {},
  progressAssertions: {},
  selectedSubjects: [
    { subject_id: "8.01", semester: 1 },
    { subject_id: "18.01", semester: 1 },
    { subject_id: "3.091", semester: 1 },
    { subject_id: "24.900", semester: 1 },
    { subject_id: "6.100A", semester: 2 },
    { subject_id: "8.02", semester: 3 },
    { subject_id: "18.02", semester: 3 },
    { subject_id: "7.012", semester: 3 },
    { subject_id: "21M.301", semester: 3 },
    { subject_id: "6.1010", semester: 4 },
    { subject_id: "6.1200", semester: 4 },
    { subject_id: "14.01", semester: 4 },
    { subject_id: "21H.001", semester: 4 },
    { subject_id: "6.1210", semester: 6 },
    { subject_id: "6.1020", semester: 6 },
    { subject_id: "18.06", semester: 6 },
    { subject_id: "CMS.100", semester: 6 },
    { subject_id: "6.1040", semester: 7 },
    { subject_id: "6.3900", semester: 7 },
    { subject_id: "21L.001", semester: 7 },
    { subject_id: "6.1800", semester: 9 },
    { subject_id: "6.4100", semester: 9 },
    { subject_id: "HASS-A", semester: 9 },
    { subject_id: "6.UAT", semester: 10 },
    { subject_id: "6.5840", semester: 10 },
    { subject_id: "WGS.101", semester: 10 },
    { subject_id: "6.1060", semester: 12 },
    { subject_id: "6.UAR", semester: 12 },
    { subject_id: "24.09", semester: 12 },
  ] as FlatRoadContents["selectedSubjects"],
};
