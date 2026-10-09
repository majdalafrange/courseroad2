/**
 * The department and custom-activity palette, served as CSS by vite.config.ts.
 *
 * Each department sits in one fixed OKLCH lightness/chroma band per theme,
 * so text contrast holds by construction; only hue and a "deep" tier differ.
 * The bands leave headroom for --dept-on-2/-3, which departmentPalette.spec.ts
 * holds to 4.5:1.
 */

type Rgb = [number, number, number];
interface Band {
  L: number;
  C: number;
}
export interface ThemedColor {
  light: string;
  dark: string;
}

function oklchToRgb(L: number, C: number, hueDegrees: number): Rgb {
  const h = (hueDegrees * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, v));
  }) as Rgb;
}

function hex([r, g, b]: Rgb): string {
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function fromHex(value: string): Rgb {
  const n = parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two "#rrggbb" colors. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(fromHex(a));
  const lb = relativeLuminance(fromHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT: Band = { L: 0.46, C: 0.115 };
const LIGHT_DEEP: Band = { L: 0.45, C: 0.105 };
const DARK: Band = { L: 0.76, C: 0.095 };
const DARK_DEEP: Band = { L: 0.72, C: 0.1 };

/** Text on a department fill, primary first. The lower-emphasis greys are
 *  opaque: a faded --dept-on picks up the fill's hue and loses contrast. */
export const DEPT_ON = {
  light: ["#ffffff", "#f0f0f0", "#eaeaea"],
  dark: ["#16191d", "#2a2a2a", "#323232"],
} as const;

/**
 * [hue, tier] per department: the HSL hue of the legacy app's color, so
 * returning students recognize it, and tier 1 if that color was muted.
 * A few hues are nudged 1° to keep every hex distinct.
 */
const DEPARTMENTS: Record<string, [number, 0 | 1]> = {
  // Engineering
  1: [0, 0], // Civil & Environmental
  2: [20, 0], // Mechanical
  3: [225, 0], // Materials
  6: [210, 0], // EECS
  10: [0, 1], // Chemical
  16: [197, 0], // AeroAstro
  20: [135, 1], // Biological Eng
  22: [1, 1], // Nuclear
  // Sciences
  5: [162, 0], // Chemistry
  7: [218, 1], // Biology
  8: [267, 1], // Physics
  9: [264, 0], // Brain & Cog
  12: [125, 0], // EAPS
  18: [236, 1], // Math
  // HASS
  4: [128, 1], // Architecture
  11: [342, 1], // Urban Studies
  14: [30, 0], // Economics
  15: [3, 1], // Management
  17: [315, 0], // Political Science
  24: [260, 1], // Linguistics & Philosophy
  // Course 21 family
  21: [138, 1],
  "21A": [139, 1], // Anthropology
  "21G": [162, 1], // Global Languages
  "21H": [170, 1], // History
  "21L": [178, 1], // Literature
  "21M": [186, 1], // Music
  "21T": [188, 1], // Theater Arts
  "21W": [146, 1], // Writing
  // Interdisciplinary & misc
  CC: [115, 0], // Concourse
  CMS: [154, 1], // Comparative Media
  CSB: [197, 1], // Computational & Systems Bio
  EC: [100, 1], // Edgerton
  EM: [225, 1], // Engineering and Management
  ES: [242, 1], // ESG
  HST: [217, 1], // Health Sciences
  IDS: [150, 1], // IDSS
  MAS: [122, 1], // Media Arts
  SCM: [137, 1], // Supply Chain
  STS: [276, 1], // Science, Technology & Society
  WGS: [194, 1], // Women's & Gender Studies
  SP: [240, 0], // Special Programs (Interphase, Terrascope, ...)
  SWE: [13, 1], // Engineering School-Wide
};

/** ROTC: the legacy app painted all three the same grey; each gets a
 *  faint chroma at its own hue so they stay distinct. */
const ROTC: Record<string, [number, number]> = {
  AS: [250, 0.02], // Air Force
  MS: [40, 0.02], // Army
  NS: [150, 0.02], // Navy
};
/* The neutral grey's lightness at C≈0, so ROTC tints weigh the same. */
const NEUTRAL_LIGHT_L = 0.51;
const NEUTRAL_DARK_L = 0.708;

/** Generic categories, by the same legacy-hue rule as departments. */
const GENERICS: Record<string, [number, 0 | 1]> = {
  GIR: [18, 0],
  "HASS-A": [198, 0],
  "HASS-H": [234, 0],
  "HASS-S": [270, 0],
  "HASS-E": [163, 0], // nudged 1° off course-5
  "CI-H": [306, 0],
  "CI-HW": [342, 0],
};

/* "No department": a full-card fill like any department, so it needs the
   same 4.5:1 with white text. */
const NEUTRAL: ThemedColor = { light: "#666666", dark: "#9aa0a8" };

function banded([hue, tier]: [number, 0 | 1]): ThemedColor {
  const light = tier === 1 ? LIGHT_DEEP : LIGHT;
  const dark = tier === 1 ? DARK_DEEP : DARK;
  return {
    light: hex(oklchToRgb(light.L, light.C, hue)),
    dark: hex(oklchToRgb(dark.L, dark.C, hue)),
  };
}

/** Keyed by colors.ts's color classes. */
export const DEPARTMENT_COLORS: Record<string, ThemedColor> = {
  ...Object.fromEntries(
    Object.entries(DEPARTMENTS).map(([dept, a]) => [
      `course-${dept}`,
      banded(a),
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(ROTC).map(([dept, [hue, chroma]]) => [
      `course-${dept}`,
      {
        light: hex(oklchToRgb(NEUTRAL_LIGHT_L, chroma, hue)),
        dark: hex(oklchToRgb(NEUTRAL_DARK_L, chroma, hue)),
      },
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(GENERICS).map(([key, a]) => [`generic-${key}`, banded(a)]),
  ),
  "course-none": NEUTRAL,
};

/** Indexed by the "@N" custom_color saved roads carry, so these keep the
 *  legacy app's hexes in both themes. */
export const CUSTOM_COLORS = [
  "#b55757", "#b58657", "#b5b557", "#86b557", "#57b557", "#57b586",
  "#de4343", "#de9043", "#dede43", "#90de43", "#43de43", "#43de90",
  "#b51616", "#b56516", "#b5b516", "#65b516", "#16b516", "#16b565",
  "#57b5b5", "#5786b5", "#5757b5", "#8657b5", "#b557b5", "#b55786",
  "#43dede", "#4390de", "#4343de", "#9043de", "#de43de", "#de4390",
  "#16b5b5", "#1665b5", "#1616b5", "#6516b5", "#b516b5", "#b51665",
  "#000000", "#262626", "#4d4d4d", "#737373", "#999999", "#bfbfbf",
]; // prettier-ignore

export function departmentColorsCss(): string {
  const block = (theme: "light" | "dark") => [
    ...Object.entries(DEPARTMENT_COLORS).map(
      ([key, color]) => `  --dept-${key}: ${color[theme]};`,
    ),
    `  --dept-on: ${DEPT_ON[theme][0]};`,
    `  --dept-on-2: ${DEPT_ON[theme][1]};`,
    `  --dept-on-3: ${DEPT_ON[theme][2]};`,
  ];
  return [
    ":root {",
    ...block("light"),
    ...CUSTOM_COLORS.map((color, i) => `  --custom-color-${i}: ${color};`),
    "}",
    "",
    '[data-theme="dark"] {',
    ...block("dark"),
    "}",
    "",
  ].join("\n");
}
