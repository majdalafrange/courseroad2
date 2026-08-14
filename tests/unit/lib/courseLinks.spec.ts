import { describe, expect, it } from "vitest";
import { safeHref } from "../../../src/lib/courseLinks";

describe("safeHref", () => {
  it("passes through absolute http(s) URLs", () => {
    expect(safeHref("https://catalog.mit.edu/6-006")).toBe(
      "https://catalog.mit.edu/6-006",
    );
    expect(safeHref("http://example.mit.edu/x")).toBe(
      "http://example.mit.edu/x",
    );
    expect(safeHref("HTTPS://Example.com")).toBe("HTTPS://Example.com");
  });

  it("drops script-executing and non-http schemes", () => {
    // The catalog/requirements URL is untrusted under a compromised/MITM
    // FireRoad response; these must never reach an href.
    expect(safeHref("javascript:alert(document.cookie)")).toBeUndefined();
    expect(safeHref("JavaScript:alert(1)")).toBeUndefined();
    expect(safeHref("  javascript:alert(1)")).toBeUndefined();
    expect(
      safeHref("data:text/html,<script>alert(1)</script>"),
    ).toBeUndefined();
    expect(safeHref("vbscript:msgbox(1)")).toBeUndefined();
    expect(safeHref("//evil.example.com")).toBeUndefined();
    expect(safeHref("/relative/path")).toBeUndefined();
  });

  it("handles non-string input", () => {
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(123)).toBeUndefined();
    expect(safeHref("")).toBeUndefined();
  });
});
