/**
 * External per-program links (department checklists, NEET threads) shown
 * under the audit. Ported from the courseLinks mixin.
 */

export interface CourseLink {
  link: string;
  text: string;
}

const COURSE_LINKS: { courses: string[]; link: string; text: string }[] = [
  {
    courses: [
      "major6-1",
      "major6-1-8-flex",
      "major6-2",
      "major6-2new",
      "major6-3",
      "major6-3new",
      "major6-4",
      "major6-7",
      "major6-14",
      "major11-6",
      "minor6",
      "master6-P",
      "meng6-14",
    ],
    link: "https://eecsis.mit.edu/checklist.cgi",
    text: "Course 6 Checklist",
  },
  {
    courses: ["major11"],
    link: "https://duspsis.mit.edu/",
    text: "Course 11 Student Status",
  },
  {
    courses: [
      "neetLM-CB",
      "neetLM-IE",
      "neetLM-TE",
      "neetLM-SB",
      "neetLM-MDE",
      "neetLM",
    ],
    link: "https://neet.mit.edu/threads/lm",
    text: "NEET Living Machines Website",
  },
  {
    courses: ["neetAM"],
    link: "https://neet.mit.edu/threads/am",
    text: "NEET Autonomous Machines Website",
  },
  {
    courses: ["neetAAM"],
    link: "https://neet.mit.edu/threads/amm",
    text: "NEET Advanced Materials Machines Website",
  },
  {
    courses: ["neetDC"],
    link: "https://neet.mit.edu/threads/dc",
    text: "NEET Digital Cities Website",
  },
  {
    courses: ["neetCES"],
    link: "https://neet.mit.edu/threads/rem",
    text: "NEET Renewable Energy Machines",
  },
];

/**
 * Guard a catalog- or requirements-supplied URL before binding it to an
 * href. Only absolute http(s) URLs pass; anything else, notably
 * `javascript:` and `data:`, is dropped so a hostile or MITM'd FireRoad
 * response cannot turn a link into click-to-execute script.
 */
export function safeHref(url: unknown): string | undefined {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim())
    ? url
    : undefined;
}

/** Links applicable to the selected programs. */
export function getCourseLinks(selectedReqs: string[]): CourseLink[] {
  const links: CourseLink[] = [];
  for (const { courses, link, text } of COURSE_LINKS) {
    if (selectedReqs.some((course) => courses.includes(course))) {
      links.push({ link, text });
    }
  }
  return links;
}
