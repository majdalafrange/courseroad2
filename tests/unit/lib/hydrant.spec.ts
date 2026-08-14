import { describe, expect, it } from "vitest";
import {
  hydrantState,
  hydrantTerm,
  hydrantURL,
} from "../../../src/lib/hydrant";
import { placed } from "./fixtures";

describe("hydrant encoding", () => {
  it("produces the pinned msgpack+base64 payload", () => {
    // Pinned against the legacy implementation's output
    expect(
      hydrantState([
        placed("8.01", 1),
        placed("18.01A", 1),
        placed("6.0001", 1),
      ]),
    ).toBe("k5ORpDguMDGRpjE4LjAxQZGmNi4wMDAxwAA=");
    expect(hydrantState([])).toBe("k5DAAA==");
  });

  it("builds term strings", () => {
    expect(hydrantTerm(1, 2026)).toBe("f25");
    expect(hydrantTerm(3, 2026)).toBe("s26");
    expect(hydrantTerm(2, 2026)).toBe("i26");
  });

  it("builds a full URL with t and s params", () => {
    const url = new URL(hydrantURL(1, 2026, [placed("8.01", 1)]));
    expect(url.origin).toBe("https://hydrant.mit.edu");
    expect(url.searchParams.get("t")).toBe("f25");
    expect(url.searchParams.get("s")).toBeTruthy();
  });
});
