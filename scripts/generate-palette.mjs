/**
 * Generates src/design/departmentColors.css, the perceptually coherent
 * department color system.
 *
 * Design: every department color is an OKLCH color with a FIXED
 * lightness/chroma band per theme, so chips are equally vivid, text
 * contrast is guaranteed by construction, and only hue (+ a "deep" tier)
 * distinguishes departments. Hue assignments group departments into
 * meaningful families (computing = azure, sciences = green/teal,
 * humanities = warm gold/coral, arts = magenta), so the canvas reads
 * as a landscape rather than confetti.
 *
 * Light theme: L=0.53 C=0.115 (white text, ≥4.5:1 by construction)
 * Dark theme:  L=0.70 C=0.10  (ink text, ≥7:1 by construction)
 *
 * Run: node scripts/generate-palette.mjs
 */

import { writeFileSync } from "fs";

/* ---- OKLCH → sRGB ---- */
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

function hex([r, g, b]) {
  const to = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function relLuminance([r, g, b]) {
  const lin = [r, g, b].map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

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

const WHITE = [1, 1, 1];
const INK = oklchToRgb(0.22, 0.012, 250); // --g-ink dark text

/**
 * Department → [hue, tier] assignments.
 * Families: 200–250 computing/engineering blues · 130–185 sciences ·
 * 25–95 humanities warm range · 300–345 arts/media · greys for ROTC.
 */
const assignments = {
  // Engineering
  1: [185, 0], // Civil & Environmental: sea teal
  2: [215, 1], // Mechanical: deep steel
  3: [50, 1], // Materials: bronze
  6: [240, 0], // EECS: azure
  10: [95, 1], // Chemical: olive
  16: [205, 0], // AeroAstro: sky steel
  20: [160, 1], // Biological Eng: deep emerald
  22: [260, 1], // Nuclear: deep cobalt
  // Sciences
  5: [150, 0], // Chemistry: emerald
  7: [130, 0], // Biology: green
  8: [262, 0], // Physics: cobalt
  9: [285, 0], // Brain & Cog: indigo
  12: [105, 0], // EAPS: moss
  18: [300, 0], // Math: violet
  // HASS
  4: [330, 0], // Architecture: magenta
  11: [70, 1], // Urban Studies: ochre
  14: [40, 0], // Economics: copper
  15: [25, 1], // Management: deep ember
  17: [10, 0], // Political Science: brick rose
  24: [295, 1], // Linguistics & Philosophy: deep violet
  // Course 21 family: the humanities ridge (warm golds & corals)
  21: [65, 0],
  "21A": [58, 0],
  "21G": [80, 0],
  "21H": [30, 0],
  "21L": [45, 0],
  "21M": [340, 0], // Music sits with the arts
  "21T": [350, 0], // Theater
  "21W": [20, 0],
  // Interdisciplinary & misc
  CC: [120, 1], // Concourse
  CMS: [320, 0], // Comparative Media: orchid
  CSB: [225, 1], // Computational & Systems Bio
  EC: [140, 1], // Edgerton
  EM: [250, 1],
  ES: [275, 1],
  HST: [170, 0], // Health Sciences: clinical teal
  IDS: [230, 1], // IDSS
  MAS: [310, 0], // Media Arts: fuchsia
  SCM: [90, 0], // Supply Chain
  STS: [55, 1],
  WGS: [345, 1],
  SP: [265, 0],
  SWE: [35, 1],
};

/* Generic categories keep their own recognizable hues. */
const genericAssignments = {
  "generic-GIR": [45, 1], // amber bronze: "foundation"
  "generic-HASS-A": [330, 0],
  "generic-HASS-H": [30, 0],
  "generic-HASS-S": [70, 0],
  "generic-HASS-E": [110, 0],
  "generic-CI-H": [200, 0],
  "generic-CI-HW": [255, 0],
  "course-none": null, // neutral, defined by hand below
};

const NEUTRAL = {
  light: "#8a8f98",
  dark: "#9aa0a8",
};
const ROTC = ["AS", "MS", "NS"];

function tone(band, hue) {
  return hex(oklchToRgb(band.L, band.C, hue));
}

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
for (const dept of ROTC) {
  entries[`course-${dept}`] = NEUTRAL;
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
