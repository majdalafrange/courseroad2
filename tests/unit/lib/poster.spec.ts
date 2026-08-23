// @vitest-environment jsdom
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  MARK_TILE,
  POSTER_THEMES,
  buildRoadPoster,
  sanitizeColorToken,
  type PosterTheme,
} from "../../../src/lib/poster";
import type { Road } from "../../../src/lib/types";
import { makeCatalog, placed } from "./fixtures";

describe("sanitizeColorToken (poster SVG fill guard)", () => {
  it("passes legitimate color tokens through", () => {
    expect(sanitizeColorToken("#a31f34")).toBe("#a31f34");
    expect(sanitizeColorToken("#fff")).toBe("#fff");
    expect(sanitizeColorToken("rgb(163, 31, 52)")).toBe("rgb(163, 31, 52)");
    expect(sanitizeColorToken("rgba(0, 0, 0, 0.5)")).toBe("rgba(0, 0, 0, 0.5)");
    expect(sanitizeColorToken("hsl(210, 50%, 40%)")).toBe("hsl(210, 50%, 40%)");
    expect(sanitizeColorToken("var(--dept-course-6)")).toBe(
      "var(--dept-course-6)",
    );
    expect(sanitizeColorToken("rebeccapurple")).toBe("rebeccapurple");
  });

  it('falls back to a neutral color for anything that could break out of fill="..."', () => {
    // The exact breakout a hostile subject_id produces via courseColor()'s
    // dept/generic branch (which echoes the id verbatim into the var name).
    expect(
      sanitizeColorToken(
        'var(--dept-generic-HASS-A "><image href=x onerror="alert(1)" x=)',
      ),
    ).toBe("#888888");
    expect(sanitizeColorToken('"><script>alert(1)</script>')).toBe("#888888");
    expect(sanitizeColorToken('#fff" onload="alert(1)')).toBe("#888888");
    expect(sanitizeColorToken("url(javascript:alert(1))")).toBe("#888888");
    expect(sanitizeColorToken("")).toBe("#888888");
    expect(sanitizeColorToken(undefined)).toBe("#888888");
  });
});

describe("buildRoadPoster escaping", () => {
  function road(
    name: string,
    subjects: Road["contents"]["selectedSubjects"][number],
  ): Road {
    const buckets = Array.from(Array(16), () => [] as typeof subjects);
    buckets[1] = subjects;
    return {
      downloaded: "",
      changed: "",
      name,
      agent: "",
      contents: {
        coursesOfStudy: ["girs"],
        selectedSubjects: buckets,
        progressOverrides: {},
        progressAssertions: {},
      },
    };
  }

  it("escapes hostile road names and subject titles/ids", () => {
    const svg = buildRoadPoster(
      road('"><script>alert(1)</script>', [
        placed("8.01", 1, { title: "<img onerror=x>" }),
        placed('EVIL"><rect>', 1),
      ]),
      makeCatalog(),
      { userYear: 0, dark: false },
    );
    // The payloads survive only in escaped form. esc() covers &, <, >;
    // quotes stay literal because escaped values land in text nodes only,
    // where a quote cannot open an attribute.
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("<img");
    expect(svg).not.toContain('EVIL"><rect>');
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&lt;img onerror=x&gt;");
    expect(svg).toContain('EVIL"&gt;&lt;rect&gt;');
  });

  it("truncates a very long road name the way subject titles are truncated (N5)", () => {
    const longName = "Ω" + "long-road-name-".repeat(30) + "🚀END";
    const svg = buildRoadPoster(
      road(longName, [placed("8.01", 1)]),
      makeCatalog(),
      {
        userYear: 0,
        dark: false,
      },
    );
    // The title line is capped, ends in an ellipsis, and the emoji tail
    // never reaches the poster (a mid-surrogate cut would break the XML).
    const titleMatch = /font-size="22"[^>]*>([^<]*)</.exec(svg);
    expect(titleMatch).not.toBeNull();
    const title = titleMatch![1];
    expect(Array.from(title).length).toBeLessThanOrEqual(48);
    expect(title.endsWith("...")).toBe(true);
    expect(title).toContain("Ω");
    expect(svg).not.toContain("🚀");
    // A short name passes through whole.
    const short = buildRoadPoster(
      road("Course 6-3", [placed("8.01", 1)]),
      makeCatalog(),
      {
        userYear: 0,
        dark: false,
      },
    );
    expect(short).toContain(">Course 6-3<");
  });

  it("renders a road whose custom_color names no palette entry", () => {
    // An imported road pairing a real catalog id with a malformed color
    // reached resolveColor as undefined and threw on `.trim`, so opening the
    // share sheet broke for the rest of the session.
    expect(() =>
      buildRoadPoster(
        road("Imported", [
          placed("6.006", 1, { custom_color: "@999" }),
          placed("8.01", 1, { custom_color: 5 } as never),
        ]),
        makeCatalog(),
        { userYear: 0, dark: false },
      ),
    ).not.toThrow();
  });

  it("forces every fill to a sanitized color token", () => {
    // A subject id crafted to ride courseColor()'s generic branch, which
    // echoes the raw id into the var() name; must land as the fallback.
    const svg = buildRoadPoster(
      road("Road", [
        placed('HASS-A "><image href=x onerror=a x=', 1),
        placed("8.01", 1),
      ]),
      makeCatalog(),
      { userYear: 0, dark: false },
    );
    const fills = [...svg.matchAll(/fill="([^"]*)"/g)].map((m) => m[1]);
    expect(fills.length).toBeGreaterThan(0);
    for (const fill of fills) {
      expect(fill).toMatch(
        /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]*\)|hsla?\([\d\s.,%]*\)|[a-zA-Z]+)$/,
      );
    }
  });
});

describe("theme mirrors of tokens.css", () => {
  // The poster renders outside the app's stylesheet, so it mirrors the
  // token colors as literals. This test is the sync mechanism: retune a
  // token and the mirror fails here instead of drifting silently.
  const css = readFileSync("src/design/tokens.css", "utf8");
  const [lightCss, darkCss] = css.split('[data-theme="dark"]');
  const token = (section: string, name: string): string => {
    const match = new RegExp(`${name}:\\s*([^;]+);`).exec(section);
    expect(match, name).not.toBeNull();
    return (match as RegExpExecArray)[1].trim();
  };
  const FIELD_TOKENS: Record<
    Exclude<keyof PosterTheme, "deptOn" | "deptOn2">,
    string
  > = {
    bg: "--g-bg",
    surface: "--g-surface",
    cell: "--g-cell",
    line: "--g-line",
    ink: "--g-ink",
    ink2: "--g-ink-2",
    ink3: "--g-ink-3",
    accent: "--g-accent",
    brand: "--g-brand",
    brandFlag: "--g-brand-flag",
  };

  it("light theme matches the :root tokens", () => {
    for (const [field, name] of Object.entries(FIELD_TOKENS)) {
      expect(POSTER_THEMES.light[field as keyof PosterTheme], name).toBe(
        token(lightCss, name),
      );
    }
  });

  it("dark theme matches the data-theme=dark tokens", () => {
    for (const [field, name] of Object.entries(FIELD_TOKENS)) {
      expect(POSTER_THEMES.dark[field as keyof PosterTheme], name).toBe(
        token(darkCss, name),
      );
    }
  });

  it("the wordmark tile is --g-mark and ignores the theme", () => {
    expect(MARK_TILE).toBe(token(lightCss, "--g-mark"));
  });
});

describe("dept-on mirrors of departmentColors.css", () => {
  // Card text rides the same theme-fixed on-color pair every department
  // color uses (generate-palette.mjs's contrast guarantee), not tokens.css;
  // a separate small sync check for a separate generated source file.
  const css = readFileSync("src/design/departmentColors.css", "utf8");
  const [lightCss, darkCss] = css.split('[data-theme="dark"]');
  const token = (section: string, name: string): string => {
    const match = new RegExp(`${name}:\\s*([^;]+);`).exec(section);
    expect(match, name).not.toBeNull();
    return (match as RegExpExecArray)[1].trim();
  };
  const FIELD_TOKENS = { deptOn: "--dept-on", deptOn2: "--dept-on-2" } as const;

  it("light theme matches the :root tokens", () => {
    for (const [field, name] of Object.entries(FIELD_TOKENS)) {
      expect(POSTER_THEMES.light[field as keyof PosterTheme], name).toBe(
        token(lightCss, name),
      );
    }
  });

  it("dark theme matches the data-theme=dark tokens", () => {
    for (const [field, name] of Object.entries(FIELD_TOKENS)) {
      expect(POSTER_THEMES.dark[field as keyof PosterTheme], name).toBe(
        token(darkCss, name),
      );
    }
  });
});

describe("degenerate roads", () => {
  it("renders an empty road with no NaN anywhere", () => {
    const empty: Road = {
      downloaded: "",
      changed: "",
      name: "Empty",
      agent: "",
      contents: {
        coursesOfStudy: ["girs"],
        selectedSubjects: Array.from(Array(16), () => []),
        progressOverrides: {},
        progressAssertions: {},
      },
    };
    const svg = buildRoadPoster(empty, makeCatalog(), {
      userYear: 0,
      dark: true,
    });
    expect(svg.match(/\S*NaN\S*/g) ?? []).toEqual([]);
  });
});
