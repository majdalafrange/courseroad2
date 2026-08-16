/**
 * Generates src/design/departmentColors.css.
 *
 * Every department is an OKLCH color at a FIXED lightness/chroma band per
 * theme, so chips are equally vivid and text contrast holds by
 * construction; only hue (+ a "deep" tier) distinguishes departments.
 * Hues are matched to the legacy app's per-department color (see
 * src/mixins/colorMixin.js on master) rather than grouped into clean
 * families, so returning students' color sense carries over.
 *
 * Light theme: L=0.53 C=0.115 (white text, ≥4.5:1 by construction)
 * Dark theme:  L=0.70 C=0.10  (ink text, ≥7:1 by construction)
 *
 * Run: node scripts/generate-palette.mjs
 */

import { writeFileSync } from "fs";

/**
 * Converts OKLCH color to sRGB.
 * @param {number} L
 * @param {number} C
 * @param {number} hDeg
 * @returns {[number, number, number]} Array representing [r, g, b] in sRGB space, each in [0, 1]
 */
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, v));
  });
}

/**
 * Converts an sRGB color to a hex string.
 * @param {[number, number, number]} param0 Array representing [r, g, b] in sRGB space, each in [0, 1]
 * @returns {string} Hex string representing the color
 */
function hex([r, g, b]) {
  const to = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Calculates the relative luminance of an sRGB color.
 * @param {[number, number, number]} param0 Array representing [r, g, b] in sRGB space, each in [0, 1]
 * @returns {number} The relative luminance of the color
 */
function relLuminance([r, g, b]) {
  const lin = [r, g, b].map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * Calculates the contrast ratio between two sRGB colors.
 * @param {[number, number, number]} rgb1 Array representing [r, g, b] in sRGB space, each in [0, 1]
 * @param {[number, number, number]} rgb2 Array representing [r, g, b] in sRGB space, each in [0, 1]
 * @returns {number} The contrast ratio between the two colors
 */
function contrast(rgb1, rgb2) {
  const l1 = relLuminance(rgb1);
  const l2 = relLuminance(rgb2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---- Theme bands ---- */
const LIGHT = { L: 0.53, C: 0.115 };
const LIGHT_DEEP = { L: 0.45, C: 0.105 };
const DARK = { L: 0.76, C: 0.095 };
const DARK_DEEP = { L: 0.69, C: 0.1 };

/** @type {[number, number, number]} */
const WHITE = [1, 1, 1];
const INK = oklchToRgb(0.22, 0.012, 250); // --g-ink dark text

/**
 * Department → [hue, tier] assignments, matched from the legacy app's
 * per-department hex (hue = its HSL hue; tier 1 = the muted ~30-40%
 * saturation half of that palette, tier 0 = the ~70% saturated half).
 * A few hues that would otherwise collide get a 1° nudge to keep every
 * department's final hex distinct (enforced by assertDistinct below).
 * @type {Record<string, [number, number]>
 */
const assignments = {
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
  SP: [240, 0], // Special Programs (e.g., Interphase, Terrascope, etc.)
  SWE: [13, 1], // Engineering School-Wide
};

/** Generic categories: same legacy-hue-match rule as departments above.
 * @type {Record<string, [number, number]>}
 */
const genericAssignments = {
  "generic-GIR": [18, 0],
  "generic-HASS-A": [198, 0],
  "generic-HASS-H": [234, 0],
  "generic-HASS-S": [270, 0],
  "generic-HASS-E": [163, 0], // nudged 1° off course-5 (coincidental collision)
  "generic-CI-H": [306, 0],
  "generic-CI-HW": [342, 0],
  "course-none": null, // neutral, defined by hand below
};

/* "No department" fallback grey; distinct from the ROTC tints below, as
   in the legacy app (#999999 vs #b0b0b0). */
const NEUTRAL = {
  light: "#8a8f98",
  dark: "#9aa0a8",
};

/** ROTC (AS/MS/NS): legacy app painted all three the same grey. Each gets
 * a faint chroma at its own hue instead, so they stay distinct too.
 * @type {Record<string, [number, number]>}
 */
const ROTC = {
  AS: [250, 0.02], // Air Force: faint cool/blue-grey
  MS: [40, 0.02], // Army: faint warm/olive-grey
  NS: [150, 0.02], // Navy: faint green-grey
};

/**
 * Tones a hue within a theme band.
 * @param {Object} band Theme band (LIGHT, LIGHT_DEEP, DARK, DARK_DEEP)
 * @param {number} band.L Luminance
 * @param {number} band.C Chroma
 * @param {number} hue Hue in degrees
 * @returns {string} The resulting hex color
 */
function tone(band, hue) {
  return hex(oklchToRgb(band.L, band.C, hue));
}

/* Lightness matching NEUTRAL at C≈0, so ROTC tints sit at the same
   visual weight instead of jumping to the department L/C bands. */
const NEUTRAL_LIGHT_L = 0.655;
const NEUTRAL_DARK_L = 0.708;

/**
 * @type {Record<string, {light: string, dark: string}>}
 */
const entries = {};

let minLight = Infinity;
let minDark = Infinity;
for (const [dept, [hue, tier]] of Object.entries(assignments)) {
  const lightBand = tier === 1 ? LIGHT_DEEP : LIGHT;
  const darkBand = tier === 1 ? DARK_DEEP : DARK;
  const light = tone(lightBand, hue);
  const dark = tone(darkBand, hue);
  minLight = Math.min(
    minLight,
    contrast(oklchToRgb(lightBand.L, lightBand.C, hue), WHITE),
  );
  minDark = Math.min(
    minDark,
    contrast(oklchToRgb(darkBand.L, darkBand.C, hue), INK),
  );
  entries[`course-${dept}`] = { light, dark };
}
for (const [dept, [hue, chroma]] of Object.entries(ROTC)) {
  entries[`course-${dept}`] = {
    light: hex(oklchToRgb(NEUTRAL_LIGHT_L, chroma, hue)),
    dark: hex(oklchToRgb(NEUTRAL_DARK_L, chroma, hue)),
  };
}
for (const [key, assignment] of Object.entries(genericAssignments)) {
  if (assignment === null) {
    entries[key] = NEUTRAL;
    continue;
  }
  const [hue, tier] = assignment;
  entries[key] = {
    light: tone(tier === 1 ? LIGHT_DEEP : LIGHT, hue),
    dark: tone(tier === 1 ? DARK_DEEP : DARK, hue),
  };
}

console.log(
  `min contrast: light(white text) ${minLight.toFixed(2)}, dark(ink text) ${minDark.toFixed(2)}`,
);

/**
 * Fails loudly on any two departments sharing a final hex per theme.
 * @param {"light" | "dark"} themeKey "light" or "dark"
 * @throws {Error} If any two departments share a final hex for the given theme
 */
function assertDistinct(themeKey) {
  const seen = new Map();
  for (const [dept, value] of Object.entries(entries)) {
    const hexValue = value[themeKey];
    if (seen.has(hexValue)) {
      throw new Error(
        `Duplicate ${themeKey} color ${hexValue}: ${seen.get(hexValue)} and ${dept}. ` +
          `Nudge one of their hues in the assignments above.`,
      );
    }
    seen.set(hexValue, dept);
  }
}
assertDistinct("light");
assertDistinct("dark");

/* ---- emit CSS custom properties ---- */
let css = `/* GENERATED by scripts/generate-palette.mjs. Do not edit. */\n:root {\n`;
for (const [key, { light }] of Object.entries(entries)) {
  css += `  --dept-${key}: ${light};\n`;
}
css += `  --dept-on: #ffffff;\n}\n\n[data-theme="dark"] {\n`;
for (const [key, { dark }] of Object.entries(entries)) {
  css += `  --dept-${key}: ${dark};\n`;
}
css += `  --dept-on: #16191d;\n}\n`;
writeFileSync("src/design/departmentColors.css", css);

console.log(
  `wrote ${Object.keys(entries).length} department colors to src/design/departmentColors.css`,
);
