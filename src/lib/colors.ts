/**
 * Department/course color assignments. Ported keying from the legacy
 * colorMixin: department, generic-GIR/HASS/CI, and 42-color custom
 * activity keys. The perceptually coherent hex values live in
 * generate-palette.mjs/departmentColors.css; this is the stable contract
 * they key off.
 */

import type { Subject, SelectedSubject } from "./types";

export const VALID_COURSES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "14",
  "15",
  "16",
  "17",
  "18",
  "20",
  "21",
  "21A",
  "21G",
  "21H",
  "21L",
  "21M",
  "21T",
  "21W",
  "22",
  "24",
  "CC",
  "CMS",
  "CSB",
  "EC",
  "EM",
  "ES",
  "HST",
  "IDS",
  "MAS",
  "SCM",
  "STS",
  "WGS",
  "SP",
  "SWE",
  "AS",
  "MS",
  "NS",
];

export const VALID_GENERIC = [
  "PHY1",
  "PHY2",
  "CHEM",
  "BIOL",
  "CAL1",
  "CAL2",
  "LAB",
  "REST",
  "HASS-A",
  "HASS-H",
  "HASS-S",
  "HASS-E",
  "CI-H",
  "CI-HW",
];

export const COURSE_COLORS: Record<string, string> = {
  "course-none": "#999999",
  "course-1": "#de4343",
  "course-2": "#de7643",
  "course-3": "#4369de",
  "course-4": "#57b563",
  "course-5": "#43deaf",
  "course-6": "#4390de",
  "course-7": "#5779b5",
  "course-8": "#8157b5",
  "course-9": "#8143de",
  "course-10": "#b55757",
  "course-11": "#b55773",
  "course-12": "#43de4f",
  "course-14": "#de9043",
  "course-15": "#b55c57",
  "course-16": "#43b2de",
  "course-17": "#de43b7",
  "course-18": "#575db5",
  "course-20": "#57b56e",
  "course-21": "#57b573",
  "course-21A": "#57b573",
  "course-21G": "#57b599",
  "course-21H": "#57b5a5",
  "course-21L": "#57b5b2",
  "course-21M": "#57acb5",
  "course-21T": "#5e9da6",
  "course-21W": "#57b580",
  "course-22": "#b55757",
  "course-24": "#7657b5",
  "course-CC": "#4fde43",
  "course-CMS": "#57b58c",
  "course-CSB": "#579ab5",
  "course-EC": "#76b557",
  "course-EM": "#576eb5",
  "course-ES": "#5a57b5",
  "course-HST": "#5779b5",
  "course-IDS": "#57b586",
  "course-MAS": "#57b55a",
  "course-SCM": "#57b573",
  "course-STS": "#8f57b5",
  "course-WGS": "#579fb5",
  "course-SP": "#4343de",
  "course-SWE": "#b56b57",
  "course-AS": "#b0b0b0",
  "course-MS": "#b0b0b0",
  "course-NS": "#b0b0b0",
  "generic-GIR": "#bf6139",
  "generic-HASS-E": "#39bf97",
  "generic-HASS-A": "#3997bf",
  "generic-HASS-H": "#3946bf",
  "generic-HASS-S": "#7c39bf",
  "generic-CI-H": "#bf39b1",
  "generic-CI-HW": "#bf3961",
  "custom_color-0": "#b55757",
  "custom_color-1": "#b58657",
  "custom_color-2": "#b5b557",
  "custom_color-3": "#86b557",
  "custom_color-4": "#57b557",
  "custom_color-5": "#57b586",
  "custom_color-6": "#de4343",
  "custom_color-7": "#de9043",
  "custom_color-8": "#dede43",
  "custom_color-9": "#90de43",
  "custom_color-10": "#43de43",
  "custom_color-11": "#43de90",
  "custom_color-12": "#b51616",
  "custom_color-13": "#b56516",
  "custom_color-14": "#b5b516",
  "custom_color-15": "#65b516",
  "custom_color-16": "#16b516",
  "custom_color-17": "#16b565",
  "custom_color-18": "#57b5b5",
  "custom_color-19": "#5786b5",
  "custom_color-20": "#5757b5",
  "custom_color-21": "#8657b5",
  "custom_color-22": "#b557b5",
  "custom_color-23": "#b55786",
  "custom_color-24": "#43dede",
  "custom_color-25": "#4390de",
  "custom_color-26": "#4343de",
  "custom_color-27": "#9043de",
  "custom_color-28": "#de43de",
  "custom_color-29": "#de4390",
  "custom_color-30": "#16b5b5",
  "custom_color-31": "#1665b5",
  "custom_color-32": "#1616b5",
  "custom_color-33": "#6516b5",
  "custom_color-34": "#b516b5",
  "custom_color-35": "#b51665",
  "custom_color-36": "#000000",
  "custom_color-37": "#262626",
  "custom_color-38": "#4d4d4d",
  "custom_color-39": "#737373",
  "custom_color-40": "#999999",
  "custom_color-41": "#bfbfbf",
};

/** Color *class* (key into COURSE_COLORS) for a subject id. */
export function courseColorClassFromId(id: string | undefined): string {
  if (id !== undefined) {
    let course = id.split(".")[0];
    if (course.indexOf("GIR:") >= 0) {
      course =
        course.substring(0, course.indexOf("GIR:")) +
        course.substring(course.indexOf("GIR:") + 4);
    }
    const girAttrs = course
      .split(" ")
      .filter((c) => VALID_GENERIC.indexOf(c) >= 0);
    if (VALID_COURSES.indexOf(course) !== -1) {
      return "course-" + course;
    } else if (girAttrs.length > 0) {
      if (girAttrs.length === 1) {
        const attr = girAttrs[0];
        if (attr.indexOf("HASS") === 0 || attr.indexOf("CI") === 0) {
          return "generic-" + course;
        }
      }
      return "generic-GIR";
    }
  }
  return "course-none";
}

/**
 * Palette key for a custom-activity color reference ("@0" … "@41"), or
 * undefined when the value does not name a real palette entry.
 *
 * `custom_color` is untrusted: it rides through `parseRoadFile` and the
 * cloud-sync path unvalidated whenever the subject id resolves in the
 * catalog, so an imported `.road` file can carry any JSON value here. A
 * non-string threw on `.slice`, and an out-of-range index produced an
 * undefined color that broke the poster. Both now fall back to the
 * department color. The "custom_color-" prefix means a lookup can never
 * reach an inherited Object key.
 */
function paletteClass(customColor: unknown): string | undefined {
  if (typeof customColor !== "string") {
    return undefined;
  }
  const colorClass = "custom_color-" + customColor.slice(1);
  return COURSE_COLORS[colorClass] !== undefined ? colorClass : undefined;
}

/** Whether a value names a real entry in the custom-activity palette. */
export function isCustomColor(value: unknown): value is string {
  return paletteClass(value) !== undefined;
}

/** Color class for a subject (custom activities use their chosen color). */
export function courseColorClass(
  subject: Pick<Subject | SelectedSubject, "subject_id"> & {
    custom_color?: string;
    id?: string;
  },
): string {
  const custom = paletteClass(subject.custom_color);
  if (custom !== undefined) {
    return custom;
  }
  return courseColorClassFromId(subject.id || subject.subject_id);
}

/** Raw hex for a color class (legacy palette; custom activities only). */
export function rawColor(colorClass: string): string {
  return COURSE_COLORS[colorClass];
}

/**
 * CSS background color for a subject. Department/generic colors resolve
 * through the CourseRoad palette's CSS variables (theme-aware; see
 * src/design/departmentColors.css). Custom-activity colors keep the
 * legacy 42-color palette because `custom_color: "@N"` indices are saved
 * in users' roads.
 */
export function courseColor(
  subject: Parameters<typeof courseColorClass>[0],
): string {
  const colorClass = courseColorClass(subject);
  if (colorClass.startsWith("custom_color-")) {
    return COURSE_COLORS[colorClass];
  }
  return `var(--dept-${colorClass})`;
}
