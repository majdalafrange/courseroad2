import { describe, expect, it } from "vitest";
import {
  DEPARTMENT_COLORS,
  DEPT_ON,
  contrastRatio,
} from "../../../src/design/departmentPalette";

const THEMES = ["light", "dark"] as const;

describe("department palette", () => {
  it.each(THEMES)("gives every class a distinct %s color", (theme) => {
    const values = Object.values(DEPARTMENT_COLORS).map((c) => c[theme]);
    expect(new Set(values).size).toBe(values.length);
  });

  // --dept-on-2/-3 are lower-emphasis text on a full card fill, so they
  // need AA on every department, not just the primary on-color.
  it.each(THEMES)("keeps all %s on-colors at 4.5:1 on every fill", (theme) => {
    for (const [key, color] of Object.entries(DEPARTMENT_COLORS)) {
      for (const on of DEPT_ON[theme]) {
        expect(
          contrastRatio(on, color[theme]),
          `${on} on ${key}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
