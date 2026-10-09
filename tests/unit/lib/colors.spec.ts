// @vitest-environment jsdom
import { readFileSync } from "fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  CUSTOM_COLOR_COUNT,
  courseColor,
  courseColorClass,
  courseColorClassFromId,
  isCustomColor,
  resolveCssColor,
} from "../../../src/lib/colors";

const css = readFileSync("src/design/departmentColors.css", "utf8");

describe("course colors", () => {
  it("maps department ids to course colors", () => {
    expect(courseColorClassFromId("6.006")).toBe("course-6");
    expect(courseColorClassFromId("21M.301")).toBe("course-21M");
    expect(courseColorClassFromId("CMS.100")).toBe("course-CMS");
  });

  it("maps generic ids", () => {
    expect(courseColorClassFromId("PHY1")).toBe("generic-GIR");
    expect(courseColorClassFromId("HASS-A")).toBe("generic-HASS-A");
    expect(courseColorClassFromId("CI-H")).toBe("generic-CI-H");
    expect(courseColorClassFromId("CI-H HASS-A")).toBe("generic-GIR");
    expect(courseColorClassFromId("GIR:PHY1")).toBe("generic-GIR");
  });

  it("falls back for unknown departments", () => {
    expect(courseColorClassFromId("ZZZ.999")).toBe("course-none");
    expect(courseColorClassFromId(undefined)).toBe("course-none");
  });

  it("uses custom colors for custom activities", () => {
    expect(courseColorClass({ subject_id: "UROP", custom_color: "@5" })).toBe(
      "custom-color-5",
    );
  });

  it("resolves department colors to theme-aware CSS variables", () => {
    expect(courseColor({ subject_id: "6.006" })).toBe("var(--dept-course-6)");
    expect(courseColor({ subject_id: "PHY1" })).toBe("var(--dept-generic-GIR)");
  });

  it("resolves custom colors to the palette's CSS variables", () => {
    expect(courseColor({ subject_id: "UROP", custom_color: "@5" })).toBe(
      "var(--custom-color-5)",
    );
  });

  it("finds every palette entry in departmentColors.css", () => {
    // The light (:root) block; the palette does not change with the theme.
    const root = css.split('[data-theme="dark"]')[0];
    for (let i = 0; i < CUSTOM_COLOR_COUNT; i++) {
      expect(root, `--custom-color-${i}`).toMatch(
        new RegExp(`--custom-color-${i}: #[0-9a-f]{6};`),
      );
    }
    expect(root).not.toContain(`--custom-color-${CUSTOM_COLOR_COUNT}:`);
  });

  it("recognizes only real palette references", () => {
    expect(isCustomColor("@0")).toBe(true);
    expect(isCustomColor("@41")).toBe(true);
    expect(isCustomColor("@42")).toBe(false);
    expect(isCustomColor("@999")).toBe(false);
    expect(isCustomColor("")).toBe(false);
    expect(isCustomColor(5)).toBe(false);
    expect(isCustomColor(undefined)).toBe(false);
  });

  it("falls back to the department color for a malformed custom_color", () => {
    // A `.road` import carries custom_color through unvalidated whenever the
    // subject id resolves in the catalog. A non-string threw on `.slice`, and
    // an index outside the palette produced an undefined color downstream.
    const nonString = { subject_id: "6.006", custom_color: 5 } as never;
    expect(courseColorClass(nonString)).toBe("course-6");
    expect(courseColor(nonString)).toBe("var(--dept-course-6)");

    const outOfRange = { subject_id: "6.006", custom_color: "@999" };
    expect(courseColorClass(outOfRange)).toBe("course-6");
    expect(courseColor(outOfRange)).toBe("var(--dept-course-6)");
  });
});

describe("resolveCssColor", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("reads a var() from the page's styles and passes literals through", () => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    expect(resolveCssColor("var(--custom-color-5)")).toBe("#57b586");
    expect(resolveCssColor("#123456")).toBe("#123456");
    expect(resolveCssColor("var(--not-a-color)")).toBe("");
  });
});
