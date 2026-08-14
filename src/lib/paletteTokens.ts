/**
 * Command-palette filter tokens: the typed grammar ("hass", "9u",
 * "not-ci", …) mapped onto the search filter groups in lib/filters.ts.
 * Pure data + one projection, kept out of the palette component so the
 * grammar is testable and greppable on its own.
 */

import { emptyChosenFilters } from "./filters";

export interface TokenDef {
  key: string;
  label: string;
  /** Filter group name (matches emptyChosenFilters keys). */
  group: string;
  /** Index within the group's boolean array. */
  index: number;
  aliases: string[];
}

export const TOKEN_DEFS: TokenDef[] = [
  { key: "gir", label: "GIR", group: "girs", index: 0, aliases: ["gir"] },
  { key: "lab", label: "Lab", group: "girs", index: 1, aliases: ["lab"] },
  { key: "rest", label: "REST", group: "girs", index: 2, aliases: ["rest"] },
  { key: "hass", label: "HASS", group: "hass", index: 0, aliases: ["hass"] },
  {
    key: "hass-a",
    label: "HASS-A",
    group: "hass",
    index: 1,
    aliases: ["hass-a", "hassa"],
  },
  {
    key: "hass-s",
    label: "HASS-S",
    group: "hass",
    index: 2,
    aliases: ["hass-s", "hasss"],
  },
  {
    key: "hass-h",
    label: "HASS-H",
    group: "hass",
    index: 3,
    aliases: ["hass-h", "hassh"],
  },
  {
    key: "hass-e",
    label: "HASS-E",
    group: "hass",
    index: 4,
    aliases: ["hass-e", "hasse"],
  },
  { key: "ci", label: "CI", group: "ci", index: 0, aliases: ["ci"] },
  {
    key: "ci-h",
    label: "CI-H",
    group: "ci",
    index: 1,
    aliases: ["ci-h", "cih"],
  },
  {
    key: "ci-hw",
    label: "CI-HW",
    group: "ci",
    index: 2,
    aliases: ["ci-hw", "cihw"],
  },
  {
    key: "not-ci",
    label: "Not CI",
    group: "ci",
    index: 3,
    aliases: ["not-ci", "notci"],
  },
  {
    key: "ug",
    label: "Undergrad",
    group: "level",
    index: 0,
    aliases: ["ug", "undergrad"],
  },
  {
    key: "grad",
    label: "Graduate",
    group: "level",
    index: 1,
    aliases: ["grad", "g"],
  },
  {
    key: "units<6",
    label: "<6 units",
    group: "units",
    index: 0,
    aliases: ["units<6"],
  },
  {
    key: "units6",
    label: "6 units",
    group: "units",
    index: 1,
    aliases: ["units6", "6u"],
  },
  {
    key: "units9",
    label: "9 units",
    group: "units",
    index: 2,
    aliases: ["units9", "9u"],
  },
  {
    key: "units12",
    label: "12 units",
    group: "units",
    index: 3,
    aliases: ["units12", "12u"],
  },
  {
    key: "units15",
    label: "15 units",
    group: "units",
    index: 4,
    aliases: ["units15", "15u"],
  },
  {
    key: "units6-15",
    label: "6–15 units",
    group: "units",
    index: 5,
    aliases: ["units6-15"],
  },
  {
    key: "units>15",
    label: ">15 units",
    group: "units",
    index: 6,
    aliases: ["units>15"],
  },
  { key: "fall", label: "Fall", group: "terms", index: 0, aliases: ["fall"] },
  { key: "iap", label: "IAP", group: "terms", index: 1, aliases: ["iap"] },
  {
    key: "spring",
    label: "Spring",
    group: "terms",
    index: 2,
    aliases: ["spring"],
  },
  {
    key: "virtual",
    label: "Virtual",
    group: "virtual",
    index: 0,
    aliases: ["virtual"],
  },
  {
    key: "in-person",
    label: "In person",
    group: "virtual",
    index: 1,
    aliases: ["in-person", "inperson"],
  },
  {
    key: "hybrid",
    label: "Hybrid",
    group: "virtual",
    index: 2,
    aliases: ["hybrid"],
  },
];

/** Filter-group booleans for a set of active tokens. */
export function chosenFiltersFor(
  tokens: TokenDef[],
): Record<string, boolean[]> {
  const filters = emptyChosenFilters();
  for (const token of tokens) {
    filters[token.group][token.index] = true;
  }
  return filters;
}
