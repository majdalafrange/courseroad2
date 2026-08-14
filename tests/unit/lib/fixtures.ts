/** Synthetic catalog fixtures for logic-SDK tests. */

import type {
  CatalogView,
  Subject,
  SelectedSubject,
} from "../../../src/lib/types";
import { buildIndex } from "../../../src/lib/genericCourses";
import { emptySelectedSubjects } from "../../../src/lib/roads";

export function makeSubject(partial: Partial<Subject>): Subject {
  return {
    subject_id: "TEST.000",
    title: "Test Subject",
    total_units: 12,
    offered_fall: true,
    offered_IAP: false,
    offered_spring: true,
    offered_summer: false,
    ...partial,
  };
}

export const SUBJECTS: Subject[] = [
  makeSubject({
    subject_id: "8.01",
    title: "Classical Mechanics",
    gir_attribute: "PHY1",
    in_class_hours: 5,
    out_of_class_hours: 9,
  }),
  makeSubject({
    subject_id: "18.01",
    title: "Calculus",
    gir_attribute: "CAL1",
  }),
  makeSubject({
    subject_id: "18.02",
    title: "Multivariable Calculus",
    gir_attribute: "CAL2",
    prerequisites: "GIR:CAL1",
  }),
  makeSubject({
    subject_id: "8.02",
    title: "Electricity and Magnetism",
    gir_attribute: "PHY2",
    prerequisites: "GIR:PHY1",
    corequisites: "GIR:CAL2",
  }),
  makeSubject({
    subject_id: "20.110",
    title: "Thermodynamics of Biomolecular Systems",
    prerequisites: "GIR:PHY1",
    corequisites: "GIR:CAL2",
    either_prereq_or_coreq: true,
  }),
  makeSubject({
    subject_id: "6.0001",
    title: "Introduction to CS Programming in Python",
    total_units: 6,
    parent: "6.00",
    old_id: "6.001",
    quarter_information: "0,apr 15",
    prerequisites: "GIR:CAL1",
  }),
  makeSubject({
    subject_id: "6.0002",
    title: "Introduction to Computational Thinking",
    total_units: 6,
    parent: "6.00",
    quarter_information: "1,apr 15",
    prerequisites: "6.0001",
  }),
  makeSubject({
    subject_id: "6.00",
    title: "Introduction to CS and Programming",
    children: ["6.0001", "6.0002"],
  }),
  makeSubject({
    subject_id: "6.006",
    title: "Introduction to Algorithms",
    prerequisites: "(6.0001/6.00/6.01), (6.042/6.1200/18.062)",
    in_class_hours: 4,
    out_of_class_hours: 10,
  }),
  makeSubject({
    subject_id: "6.042",
    title: "Math for CS",
    equivalent_subjects: ["18.062"],
  }),
  makeSubject({
    subject_id: "21M.301",
    title: "Harmony and Counterpoint I",
    hass_attribute: "HASS-A",
  }),
  makeSubject({
    subject_id: "21W.022",
    title: "Writing about Personal Experience",
    hass_attribute: "HASS-H",
    communication_requirement: "CI-HW",
  }),
  makeSubject({
    subject_id: "2.001",
    title: "Mechanics and Materials I",
    prerequisites: '8.01, "permission of instructor"',
  }),
  makeSubject({
    subject_id: "CMS.100",
    title: "Introduction to Media Studies",
    hass_attribute: "HASS-S",
  }),
  makeSubject({
    subject_id: "21H.001",
    title: "How to Stage a Revolution",
    hass_attribute: "HASS-H",
    communication_requirement: "CI-H",
  }),
  makeSubject({
    subject_id: "5.111",
    title: "Principles of Chemical Science",
    gir_attribute: "CHEM",
    is_historical: true,
    source_semester: "fall-2023",
  }),
  makeSubject({
    subject_id: "9.40",
    title: "Intro to Neural Computation",
    not_offered_year: "2026-2027",
  }),
];

export const GENERIC_COURSES: Subject[] = [
  makeSubject({
    subject_id: "PHY1",
    title: "Generic Physics 1 GIR",
    gir_attribute: "PHY1",
  }),
  makeSubject({
    subject_id: "HASS-A",
    title: "Generic HASS-A",
    hass_attribute: "HASS-A",
  }),
];

export function makeCatalog(
  subjects: Subject[] = SUBJECTS,
  generic: Subject[] = GENERIC_COURSES,
): CatalogView {
  return {
    subjectsInfo: subjects,
    subjectsIndex: buildIndex(subjects),
    genericCourses: generic,
    genericIndex: buildIndex(generic),
  };
}

export function placed(
  subject_id: string,
  semester: number,
  extra: Partial<SelectedSubject> = {},
): SelectedSubject {
  return {
    subject_id,
    title: subject_id,
    semester,
    units: 12,
    overrideWarnings: false,
    ...extra,
  };
}

export function emptyBuckets(): SelectedSubject[][] {
  return emptySelectedSubjects();
}
