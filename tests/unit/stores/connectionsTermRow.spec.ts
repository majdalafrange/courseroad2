import { describe, expect, it } from "vitest";
import { subjectTermRow } from "../../../src/stores/connections";
import type { Readiness } from "../../../src/lib/connections/readiness";

describe("subjectTermRow", () => {
  it("uses the road bucket when the subject is already placed", () => {
    const roadBucket = new Map([["6.006", 3]]);
    expect(subjectTermRow("6.006", roadBucket, undefined)).toBe(3);
  });

  it("prefers the road bucket over readiness, even if both are present", () => {
    const roadBucket = new Map([["6.006", 3]]);
    const readiness: Readiness = { kind: "ready-after", term: 7 };
    expect(subjectTermRow("6.006", roadBucket, readiness)).toBe(3);
  });

  it("falls back to a ready-after readiness term when not on the road", () => {
    const readiness: Readiness = { kind: "ready-after", term: 5 };
    expect(subjectTermRow("6.006", new Map(), readiness)).toBe(5);
  });

  it("is unscheduled when ready now but not on the road (no real term yet)", () => {
    const readiness: Readiness = { kind: "ready" };
    expect(subjectTermRow("6.006", new Map(), readiness)).toBeUndefined();
  });

  it("is unscheduled when missing prerequisites", () => {
    const readiness: Readiness = {
      kind: "missing",
      missing: ["18.01"],
      approximate: false,
    };
    expect(subjectTermRow("6.006", new Map(), readiness)).toBeUndefined();
  });

  it("is unscheduled when readiness is unknown or absent", () => {
    expect(
      subjectTermRow("6.006", new Map(), { kind: "unknown" }),
    ).toBeUndefined();
    expect(subjectTermRow("6.006", new Map(), undefined)).toBeUndefined();
  });
});
