import { describe, expect, it } from "vitest";
import { exitFraction } from "../../../src/stores/connections";

/** Where the ray (dx, dy) * t leaves the shape. */
function exitPoint(
  dx: number,
  dy: number,
  halfW: number,
  halfH: number,
  r: number,
) {
  const t = exitFraction(dx, dy, halfW, halfH, r);
  return { x: dx * t, y: dy * t };
}

describe("exitFraction: a ray leaving a rounded rectangle", () => {
  it("exits a long side flat", () => {
    expect(exitPoint(0, 100, 100, 40, 6)).toEqual({ x: 0, y: 40 });
  });

  it("exits a short side flat", () => {
    expect(exitPoint(-300, 0, 100, 40, 6)).toEqual({ x: -100, y: 0 });
  });

  it("exits a corner on its arc", () => {
    const { x, y } = exitPoint(100, 40, 100, 40, 6);
    const cx = 94;
    const cy = 34;
    expect(Math.hypot(x - cx, y - cy)).toBeCloseTo(6, 6);
    expect(x).toBeLessThan(100);
  });

  it("with r = halfH, matches the half-circle caps of a stadium", () => {
    // the cap circle sits at (halfW - halfH, 0) with radius halfH
    const { x, y } = exitPoint(200, 10, 100, 40, 40);
    expect(Math.hypot(x - 60, y)).toBeCloseTo(40, 6);
  });

  it("is 0 for a ray of no length", () => {
    expect(exitFraction(0, 0, 100, 40, 6)).toBe(0);
  });
});
