/**
 * Renders a road as a self-contained, typeset SVG poster: the whole-road
 * canvas in print/image form, independent of the live DOM, no app
 * chrome. Vector so it scales cleanly; rasterizeToPng turns it into a
 * PNG via an offscreen canvas, no external dependencies.
 */

import type { CatalogView, Road } from "./types";
import { courseColor } from "./colors";
import { semesterInformation } from "./hours";
import {
  NUM_SEMESTERS,
  baseYear,
  defaultCurrentSemester,
  semesterCalendarYearShort,
  semesterType,
} from "./offering";
import { useTouchDevice } from "../composables/useIsMobile";
import ibmPlexSansUrl from "@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wdth-normal.woff2?url";
import ibmPlexMonoMediumUrl from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url";

let fontFaceCss = "";
let fontFacesPromise: Promise<void> | undefined;

async function toBase64(url: string): Promise<string> {
  const buffer = await (await fetch(url)).arrayBuffer();
  let binary = "";
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Fetch and cache the poster's embedded fonts once; safe to call repeatedly. */
export function preparePosterFonts(): Promise<void> {
  fontFacesPromise ??= (async () => {
    try {
      const [sans, monoMedium] = await Promise.all([
        toBase64(ibmPlexSansUrl),
        toBase64(ibmPlexMonoMediumUrl),
      ]);
      fontFaceCss =
        `<style>` +
        `@font-face{font-family:'IBM Plex Sans Variable';font-weight: 100 700;src:url(data:font/woff2;base64,${sans}) format('woff2');}` +
        `@font-face{font-family:'IBM Plex Mono';font-weight:500;src:url(data:font/woff2;base64,${monoMedium}) format('woff2');}` +
        `</style>`;
    } catch {
      // Offline or blocked: still renders, just without the embed (falls
      // back to the system font, same as before this existed).
      fontFaceCss = "";
    }
  })();
  return fontFacesPromise;
}

export interface PosterTheme {
  bg: string;
  surface: string;
  /* term-cell working surface */
  cell: string;
  line: string;
  ink: string;
  ink2: string;
  ink3: string;
  /* current-term accent */
  accent: string;
  /* brand color, used for now border */
  brand: string;
  /* color of now flag */
  brandFlag: string;
  /* used for text contrast */
  deptOn: string;
  deptOn2: string;
}

/* Mirrors of the tokens.css / departmentColors.css values (the poster
   renders outside the app's stylesheet): --g-bg, --g-surface, --g-cell,
   --g-line, --g-ink, --g-ink-2, --g-ink-3, --g-accent, --g-brand,
   --g-brand-flag, --dept-on, --dept-on-2 per theme. poster.spec.ts pins
   these against the parsed source files, so a retuned token fails a test
   instead of drifting. */
const LIGHT_THEME: PosterTheme = {
  bg: "#eef1f3",
  surface: "#ffffff",
  cell: "#ffffff",
  line: "#dde2e5",
  ink: "#191c20",
  ink2: "#484d54",
  ink3: "#676c74",
  accent: "#a31f34",
  brand: "#a31f34",
  brandFlag: "#a31f34",
  deptOn: "#ffffff",
  deptOn2: "#f0f0f0",
};

/* --g-mark: the wordmark tile is cardinal in both themes, so it is not part
   of PosterTheme. */
export const MARK_TILE = "#a31f34";

const DARK_THEME: PosterTheme = {
  bg: "#10141b",
  surface: "#171b23",
  cell: "#1e232c",
  line: "#262b35",
  ink: "#ececee",
  ink2: "#b6b7bc",
  ink3: "#8f9197",
  accent: "#a6b2bb",
  brand: "#d4586c",
  brandFlag: "#c04057",
  deptOn: "#16191d",
  deptOn2: "#2a2a2a",
};

/** Both theme tables, exported for the tokens.css sync test. */
export const POSTER_THEMES: Record<"light" | "dark", PosterTheme> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Restrict a value to a safe CSS color token before it is interpolated into
 * an SVG `fill="..."` attribute. courseColor() can echo a subject_id verbatim
 * into the token (the dept/generic branch does), so a hostile id arriving
 * from a MITM'd sync or a poisoned newRoads cookie could otherwise break out
 * of the attribute and inject a live <image onerror>. Anything not shaped
 * like a real color falls back; closed by construction, no escaping needed.
 */
export function sanitizeColorToken(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (
    /^#[0-9a-fA-F]{3,8}$/.test(v) || // hex
    /^rgba?\([\d.,%\s/]+\)$/.test(v) || // rgb()/rgba() (getComputedStyle form)
    /^hsla?\([\d.,%\s/]+\)$/.test(v) || // hsl()/hsla()
    /^var\(--[\w-]+\)$/.test(v) || // a bare CSS custom property
    /^[a-zA-Z]+$/.test(v) // a named color
  ) {
    return v;
  }
  return "#888888";
}

/** Resolve a CSS var or literal color through the live document. */
function resolveColor(value: string | undefined): string {
  const match = /var\((--[\w-]+)\)/.exec(value ?? "");
  if (match === null) {
    return sanitizeColorToken(value);
  }
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1])
    .trim();
  return sanitizeColorToken(resolved || "#888888");
}

export interface PosterOptions {
  userYear: number;
  dark: boolean;
  hideIAP: boolean;
}

/** Build an SVG poster string for a road. */
export function buildRoadPoster(
  road: Road,
  catalog: CatalogView,
  options: PosterOptions,
): string {
  const theme = options.dark ? DARK_THEME : LIGHT_THEME;
  const base = baseYear(options.userYear);
  const selected = road.contents.selectedSubjects;
  const currentSemester = defaultCurrentSemester() + options.userYear * 3;

  // Which terms to draw: Prior Credit (if used) + 4 or 5 years × 3.
  const usesFifth = selected.slice(13, NUM_SEMESTERS).some((b) => b.length > 0);
  const usesPrior = selected[0].length > 0;
  const years = usesFifth ? 5 : 4;

  const padding = 56;
  const colGap = 20;
  const rowGap = 28;
  const colWidth = options.hideIAP ? 330 : 220;
  const headerH = 120;
  const termHeaderH = 44;
  const cardH = 30;
  const cardGap = 6;

  const cols = options.hideIAP ? 2 : 3; // Fall, IAP, Spring
  const width = padding * 2 + colWidth * cols + colGap * (cols - 1);

  // Compute per-term card counts to size rows.
  const maxCardsByYear: number[] = [];
  for (let y = 0; y < years; y++) {
    let maxCards = 0;
    for (let c = 0; c < 3; c++) {
      if (!options.hideIAP || c !== 1) {
        // Skip IAP if hidden
        maxCards = Math.max(maxCards, selected[1 + y * 3 + c].length);
      }
    }
    maxCardsByYear.push(maxCards);
  }

  const parts: string[] = [];
  let cursorY = headerH;

  // Prior credit strip
  if (usesPrior) {
    const priorH = termHeaderH + selected[0].length * (cardH + cardGap) + 16;
    parts.push(
      termBlock(
        "Prior credit",
        "",
        selected[0],
        padding,
        cursorY,
        width - padding * 2,
        theme,
        { isPrior: true, isCurrent: false },
      ),
    );
    cursorY += priorH + rowGap;
    void priorH;
  }

  // Year rows
  const yearNames = ["Freshman", "Sophomore", "Junior", "Senior", "Fifth year"];
  for (let y = 0; y < years; y++) {
    const rowH = termHeaderH + maxCardsByYear[y] * (cardH + cardGap) + 16;
    // year label
    parts.push(
      `<text x="${padding}" y="${cursorY - 8}" font-family="'IBM Plex Sans Variable',sans-serif" font-size="16" font-weight="600" fill="${theme.ink}">${esc(yearNames[y])}</text>`,
    );
    for (let c = 0; c < 3; c++) {
      const index = 1 + y * 3 + c;
      if (options.hideIAP && c === 1) continue; // Skip IAP if hidden
      const x =
        padding +
        c * (colWidth + colGap) -
        (options.hideIAP && c > 1 ? colGap + colWidth : 0);
      const season = semesterType(index);
      const yr = semesterCalendarYearShort(index, base);
      parts.push(
        termBlock(
          season,
          `’${yr}`,
          selected[index],
          x,
          cursorY,
          colWidth,
          theme,
          { isPrior: false, isCurrent: index === currentSemester },
        ),
      );
    }
    cursorY += rowH + rowGap;
  }

  const height = cursorY + padding - rowGap;

  // Header
  const totalUnits = selected.reduce(
    (sum, bucket) => sum + semesterInformation(bucket, catalog).totalUnits,
    0,
  );
  const header = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="${theme.bg}"/>
    <rect x="${padding}" y="${padding - 8}" width="24" height="24" rx="3" fill="${MARK_TILE}"/>
    <path d="M${padding + 4.5} ${padding + 12.5} L${padding + 9.3} ${padding - 2} L${padding + 14.7} ${padding - 2} L${padding + 19.5} ${padding + 12.5} Z" fill="#ffffff"/>
    <line x1="${padding + 12}" y1="${padding + 10}" x2="${padding + 12}" y2="${padding + 6.3}" stroke="${MARK_TILE}" stroke-width="2.1" stroke-linecap="round"/>
    <line x1="${padding + 12}" y1="${padding + 3.3}" x2="${padding + 12}" y2="${padding + 0.8}" stroke="${MARK_TILE}" stroke-width="1.7" stroke-linecap="round"/>
    <text x="${padding + 34}" y="${padding + 10}" font-family="'IBM Plex Sans Variable',sans-serif" font-size="22" font-weight="600" fill="${theme.ink}">${esc(truncateTitle(road.name))}</text>
    <text x="${padding + 34}" y="${padding + 32}" font-family="'IBM Plex Sans Variable',sans-serif" font-size="13" fill="${theme.ink3}">${totalUnits} units · planned in CourseRoad</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${fontFaceCss}
${header}
${parts.join("\n")}
</svg>`;
}

/**
 * Cap the header title the way subject titles are capped below: SVG text
 * does not wrap or clip, so an unbounded road name ran past the poster's
 * right edge. 48 characters of 22px IBM Plex Sans Variable fit the 812px
 * sheet. Sliced by code point, not code unit, so the cut can never split
 * an astral character and emit invalid XML.
 */
function truncateTitle(name: string): string {
  const chars = Array.from(name);
  return chars.length > 48 ? chars.slice(0, 45).join("") + "..." : name;
}

interface TermBlockFlags {
  /** Prior credit: sentence-case label, transparent dashed box, never "now". */
  isPrior: boolean;
  /** TermCell.is-current: brand-bordered box, accent label, a "Now" flag. */
  isCurrent: boolean;
}

function termBlock(
  season: string,
  yearLabel: string,
  subjects: Road["contents"]["selectedSubjects"][number],
  x: number,
  y: number,
  w: number,
  theme: PosterTheme,
  { isPrior, isCurrent }: TermBlockFlags,
): string {
  const cardH = 30;
  const cardGap = 6;
  const headerH = 44;
  const blockH = headerH + subjects.length * (cardH + cardGap) + 8;
  const parts: string[] = [];
  // TermCell: --g-cell (not --g-surface), --radius-md (6px, not 10), and
  // prior credit sits on a dashed, transparent (not filled) box.
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${blockH}" rx="6" ` +
      `fill="${isPrior ? "none" : theme.cell}" stroke="${isCurrent ? theme.brand : theme.line}" ` +
      `stroke-width="${isCurrent ? 1.5 : 1}"${isPrior ? ' stroke-dasharray="4 3"' : ""}/>`,
  );
  if (isPrior) {
    // Prior credit is a row name, not a column header: sentence case, no
    // caps treatment (TermCell's .term-name.is-prior).
    parts.push(
      `<text x="${x + 14}" y="${y + 24}" font-family="'IBM Plex Sans Variable',sans-serif" font-size="12.5" fill="${theme.ink3}">${esc(season)}</text>`,
    );
  } else {
    // A season label is a data column header: caps, tracked, weight 500
    // (not 600); accent-colored while it's the current term, the way
    // TermCell's .is-current .term-name is. The year half stays legible
    // but quieter (TermCell's .term-year, opacity 0.8).
    parts.push(
      `<text x="${x + 14}" y="${y + 24}" font-family="'IBM Plex Sans Variable',sans-serif" font-size="11" font-weight="500" letter-spacing="0.66" fill="${isCurrent ? theme.accent : theme.ink3}">` +
        `<tspan>${esc(season.toUpperCase())}</tspan><tspan dx="3" fill-opacity="0.8">${esc(yearLabel)}</tspan></text>`,
    );
  }
  if (isCurrent) {
    // TermCell's "Now" flag: a pinned tab clipped onto the box, tilted,
    // sitting right-of-center on the top edge.
    const flagW = 40;
    const flagH = 15;
    const flagX = x + w - 40 - flagW;
    const flagY = y - 1;
    const cx = flagX + flagW / 2;
    const cy = flagY + flagH / 2;
    parts.push(
      `<g transform="rotate(-1.5 ${cx} ${cy})">` +
        `<rect x="${flagX}" y="${flagY}" width="${flagW}" height="${flagH}" rx="3" fill="${theme.brandFlag}"/>` +
        `<text x="${cx}" y="${flagY + flagH - 4.5}" text-anchor="middle" font-family="'IBM Plex Sans Variable',sans-serif" font-size="9" font-weight="600" letter-spacing="0.6" fill="#ffffff">NOW</text>` +
        `</g>`,
    );
  }
  let cy = y + headerH;
  for (const subj of subjects) {
    // Course chips and cards: the subject's own color as the whole card's
    // fill, not a rail beside a neutral card (tokens.css → "Course chips
    // and cards"; legacy CourseRoad's rail convention, retired).
    const color = resolveColor(courseColor(subj));
    parts.push(
      `<rect x="${x + 10}" y="${cy}" width="${w - 20}" height="${cardH}" rx="4" fill="${color}"/>`,
    );
    // A subject missing subject_id/title (a pre-migration save, or a
    // hand-edited/malformed .road import) would otherwise throw here and
    // take down the whole poster instead of just this one card.
    const subjectId = subj.subject_id ?? "?";
    parts.push(
      `<text x="${x + 14}" y="${cy + 13}" font-family="'IBM Plex Mono',monospace" font-size="11" font-weight="600" fill="${theme.deptOn}">${esc(subjectId)}</text>`,
    );
    const rawTitle = subj.title ?? "";
    const title =
      rawTitle.length > 38 ? rawTitle.slice(0, 35) + "..." : rawTitle;
    parts.push(
      `<text x="${x + 14}" y="${cy + 24}" font-family="'IBM Plex Sans Variable',sans-serif" font-size="10" fill="${theme.deptOn2}">${esc(title)}</text>`,
    );
    cy += cardH + cardGap;
  }
  return parts.join("\n");
}

/** Rasterize an SVG string to a PNG data URL via an offscreen canvas. */
export function rasterizeToPng(svg: string, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const widthMatch = /width="(\d+)"/.exec(svg);
    const heightMatch = /height="(\d+)"/.exec(svg);
    const w = widthMatch ? Number(widthMatch[1]) : 1000;
    const h = heightMatch ? Number(heightMatch[1]) : 1400;
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (ctx === null) {
        reject(new Error("no 2d context"));
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export type SavePngOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Save a PNG data URL, preferring the OS share sheet on a touch device.
 */
export async function savePng(
  dataUrl: string,
  filename: string,
): Promise<SavePngOutcome> {
  const preferShare = useTouchDevice().value;
  if (preferShare && navigator.canShare !== undefined) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return "shared";
      }
    } catch (err) {
      // The user backing out of the share sheet is not a failure; anything
      // else falls through to the direct download below.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  triggerDownload(dataUrl, filename);
  return "downloaded";
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
