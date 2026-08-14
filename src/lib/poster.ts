/**
 * Renders a road as a self-contained, typeset SVG poster: the whole-road
 * canvas in print/image form, independent of the live DOM, with no app
 * chrome. Vector, so it scales without rasterization artifacts.
 *
 * SVG is the source format (vector, tiny, themeable); rasterizeToPng turns
 * it into a PNG via an offscreen canvas with no external dependencies.
 */

import type { CatalogView, Road } from "./types";
import { courseColor } from "./colors";
import { semesterInformation } from "./hours";
import {
  NUM_SEMESTERS,
  baseYear,
  semesterCalendarYearShort,
  semesterType,
} from "./offering";

export interface PosterTheme {
  bg: string;
  surface: string;
  line: string;
  ink: string;
  ink2: string;
  ink3: string;
}

/* Mirrors of the tokens.css values (the poster renders outside the app's
   stylesheet): --g-bg, --g-surface, --g-line, --g-ink, --g-ink-2,
   --g-ink-3 per theme. poster.spec.ts pins these against the parsed
   tokens.css, so a retuned token fails a test instead of drifting. */
const LIGHT_THEME: PosterTheme = {
  bg: "#f4f4f5",
  surface: "#ffffff",
  line: "#e4e4e7",
  ink: "#1a1c1f",
  ink2: "#494d52",
  ink3: "#6b6e75",
};

/* --g-mark: the wordmark tile is cardinal in both themes, so it is not part
   of PosterTheme. */
export const MARK_TILE = "#a31f34";

const DARK_THEME: PosterTheme = {
  bg: "#151619",
  surface: "#1d1e22",
  line: "#2c2d33",
  ink: "#ececee",
  ink2: "#b6b7bc",
  ink3: "#8f9197",
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
 * an SVG `fill="…"` attribute. courseColor() can echo a subject_id verbatim
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

  // Which terms to draw: Prior Credit (if used) + 4 or 5 years × 3.
  const usesFifth = selected.slice(13, NUM_SEMESTERS).some((b) => b.length > 0);
  const usesPrior = selected[0].length > 0;
  const years = usesFifth ? 5 : 4;

  const padding = 56;
  const colGap = 20;
  const rowGap = 28;
  const colWidth = 220;
  const headerH = 120;
  const termHeaderH = 44;
  const cardH = 30;
  const cardGap = 6;

  const cols = 3; // Fall, IAP, Spring
  const width = padding * 2 + colWidth * cols + colGap * (cols - 1);

  // Compute per-term card counts to size rows.
  const maxCardsByYear: number[] = [];
  for (let y = 0; y < years; y++) {
    let maxCards = 0;
    for (let c = 0; c < 3; c++) {
      maxCards = Math.max(maxCards, selected[1 + y * 3 + c].length);
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
      `<text x="${padding}" y="${cursorY - 8}" font-family="'IBM Plex Sans',sans-serif" font-size="16" font-weight="600" fill="${theme.ink}">${esc(yearNames[y])}</text>`,
    );
    for (let c = 0; c < 3; c++) {
      const index = 1 + y * 3 + c;
      const x = padding + c * (colWidth + colGap);
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
    <path d="M${padding + 5} ${padding + 10.5} H${padding + 9.8} V${padding + 5.5} H${padding + 14.6} V${padding + 0.5} H${padding + 19}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="${padding + 34}" y="${padding + 10}" font-family="'IBM Plex Sans',sans-serif" font-size="22" font-weight="600" fill="${theme.ink}">${esc(truncateTitle(road.name))}</text>
    <text x="${padding + 34}" y="${padding + 32}" font-family="'IBM Plex Sans',sans-serif" font-size="13" fill="${theme.ink3}">${totalUnits} units · planned in CourseRoad</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${header}
${parts.join("\n")}
</svg>`;
}

/**
 * Cap the header title the way subject titles are capped below: SVG text
 * does not wrap or clip, so an unbounded road name ran past the poster's
 * right edge. 48 characters of 22px IBM Plex Sans fit the 812px sheet.
 * Sliced by code point, not code unit, so the cut can never split an
 * astral character and emit invalid XML.
 */
function truncateTitle(name: string): string {
  const chars = Array.from(name);
  return chars.length > 48 ? chars.slice(0, 47).join("") + "…" : name;
}

function termBlock(
  season: string,
  yearLabel: string,
  subjects: Road["contents"]["selectedSubjects"][number],
  x: number,
  y: number,
  w: number,
  theme: PosterTheme,
): string {
  const cardH = 30;
  const cardGap = 6;
  const headerH = 44;
  const blockH = headerH + subjects.length * (cardH + cardGap) + 8;
  const parts: string[] = [];
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${blockH}" rx="10" fill="${theme.surface}" stroke="${theme.line}"/>`,
  );
  parts.push(
    `<text x="${x + 14}" y="${y + 24}" font-family="'IBM Plex Sans',sans-serif" font-size="11" font-weight="600" letter-spacing="0.6" fill="${theme.ink3}">${esc(season.toUpperCase())} ${esc(yearLabel)}</text>`,
  );
  let cy = y + headerH;
  for (const subj of subjects) {
    const color = resolveColor(courseColor(subj));
    parts.push(
      `<rect x="${x + 10}" y="${cy}" width="${w - 20}" height="${cardH}" rx="5" fill="${theme.surface}" stroke="${theme.line}"/>`,
    );
    parts.push(
      `<rect x="${x + 10}" y="${cy}" width="5" height="${cardH}" rx="2.5" fill="${color}"/>`,
    );
    parts.push(
      `<text x="${x + 22}" y="${cy + 13}" font-family="'IBM Plex Mono',monospace" font-size="11" font-weight="500" fill="${theme.ink}">${esc(subj.subject_id)}</text>`,
    );
    const title =
      subj.title.length > 28 ? subj.title.slice(0, 27) + "…" : subj.title;
    parts.push(
      `<text x="${x + 22}" y="${cy + 24}" font-family="'IBM Plex Sans',sans-serif" font-size="10" fill="${theme.ink2}">${esc(title)}</text>`,
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

/** Download a PNG data URL. */
export function downloadPng(dataUrl: string, filename: string): void {
  triggerDownload(dataUrl, filename);
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
