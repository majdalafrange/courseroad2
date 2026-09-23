import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * --g-line-control rings the header's field-shaped controls (the road
 * switcher, the search field), and at rest that ring is what says
 * "control". It sits just past the 3:1 a UI boundary needs against the
 * header (--g-bg) and against the field's own fill (--g-surface), so a
 * retune of any token it mixes can take it under. The margin is pinned
 * here, resolved from tokens.css the way a browser mixes in srgb.
 */

type Rgb = [number, number, number];

const css = readFileSync("src/design/tokens.css", "utf8");
const [lightCss, darkCss] = css.split('[data-theme="dark"]');

function token(section: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(section);
  expect(match, name).not.toBeNull();
  return (match as RegExpExecArray)[1].trim();
}

function hex(value: string): Rgb {
  const digits = value.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as Rgb;
}

/** color-mix(in srgb, var(--a) N%, var(--b)), resolved in one theme. */
function mix(section: string, expression: string): Rgb {
  const match =
    /color-mix\(\s*in srgb,\s*var\((--[\w-]+)\)\s+(\d+)%,\s*var\((--[\w-]+)\)\s*\)/.exec(
      expression,
    );
  expect(match, expression).not.toBeNull();
  const [, first, percent, second] = match as RegExpExecArray;
  const share = Number(percent) / 100;
  const a = hex(token(section, first));
  const b = hex(token(section, second));
  return a.map((channel, i) => channel * share + b[i] * (1 - share)) as Rgb;
}

/** WCAG 2 contrast ratio between two sRGB colors. */
function contrast(a: Rgb, b: Rgb): number {
  const luminance = (color: Rgb) => {
    const [r, g, bl] = color.map((channel) => {
      const s = channel / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

describe("--g-line-control", () => {
  it.each([
    ["light", lightCss],
    ["dark", darkCss],
  ])(
    "clears 3:1 against the header and the field's fill in %s",
    (_, section) => {
      const ring = mix(section, token(section, "--g-line-control"));
      expect(
        contrast(ring, hex(token(section, "--g-bg"))),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(ring, hex(token(section, "--g-surface"))),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});
