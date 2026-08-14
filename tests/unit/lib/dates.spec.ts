import { describe, expect, it } from "vitest";
import moment from "moment";
import { formatFireroadDate } from "../../../src/lib/dates";

const LEGACY_FORMAT = "YYYY-MM-DDTHH:mm:ss.SSS000Z";

describe("formatFireroadDate", () => {
  it("matches moment's legacy output for a fixed date", () => {
    const d = new Date(2026, 5, 12, 15, 4, 5, 123);
    expect(formatFireroadDate(d)).toBe(moment(d).format(LEGACY_FORMAT));
  });

  it("matches moment across random dates (incl. DST boundaries)", () => {
    for (let i = 0; i < 200; i++) {
      const d = new Date(
        2000 + Math.floor(Math.random() * 50),
        Math.floor(Math.random() * 12),
        1 + Math.floor(Math.random() * 28),
        Math.floor(Math.random() * 24),
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 60),
        Math.floor(Math.random() * 1000),
      );
      expect(formatFireroadDate(d)).toBe(moment(d).format(LEGACY_FORMAT));
    }
  });

  it("pads milliseconds and includes faux microseconds", () => {
    const d = new Date(2026, 0, 2, 3, 4, 5, 7);
    expect(formatFireroadDate(d)).toContain("T03:04:05.007000");
  });
});
