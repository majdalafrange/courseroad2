// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadRoadFile } from "../../../src/lib/download";
import type { RoadContents } from "../../../src/lib/types";
import { emptyBuckets, placed } from "./fixtures";

function contents(): RoadContents {
  const selectedSubjects = emptyBuckets();
  selectedSubjects[1].push(placed("8.01", 1));
  return {
    coursesOfStudy: ["girs"],
    selectedSubjects,
    progressOverrides: {},
    progressAssertions: {},
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("downloadRoadFile", () => {
  it("downloads <name>.road as an inert data:text/plain URL", () => {
    const click = vi
      .spyOn(HTMLElement.prototype, "click")
      .mockImplementation(() => {});
    let anchor: HTMLAnchorElement | undefined;
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = createElement(tag);
      if (tag === "a") {
        anchor = el as HTMLAnchorElement;
      }
      return el;
    });

    downloadRoadFile("My Road", contents());

    expect(click).toHaveBeenCalledOnce();
    expect(anchor?.getAttribute("download")).toBe("My Road.road");
    const href = anchor?.getAttribute("href") ?? "";
    // text/plain cannot execute; the payload is percent-encoded JSON.
    expect(href.startsWith("data:text/plain;charset=utf-8,")).toBe(true);
    const decoded = JSON.parse(
      decodeURIComponent(href.slice("data:text/plain;charset=utf-8,".length)),
    );
    // Flattened legacy byte format: subjects as one flat list.
    expect(decoded.selectedSubjects).toHaveLength(1);
    expect(decoded.selectedSubjects[0].subject_id).toBe("8.01");
    expect(decoded.coursesOfStudy).toEqual(["girs"]);
    // The anchor is cleaned up after the click.
    expect(anchor?.isConnected).toBe(false);
  });
});
