/** Browser file-download helper for `.road` exports. */

import type { RoadContents } from "./types";
import { formatRoadContents } from "./roads";

export type SaveFileOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Save a road as `<name>.road` (legacy-compatible JSON), preferring the OS
 * share sheet on a touch device. Same reasoning as poster.ts's savePng:
 * `<a download>` doesn't reliably save on mobile WebKit, and "prefer
 * share" is decided by pointer type rather than viewport width so a
 * rotated/larger phone doesn't fall through to the unreliable path.
 */
export async function downloadRoadFile(
  name: string,
  contents: RoadContents,
): Promise<SaveFileOutcome> {
  const text = JSON.stringify(formatRoadContents(contents));
  const filename = `${name}.road`;
  const preferShare = matchMedia("(pointer: coarse)").matches;
  if (preferShare && navigator.canShare !== undefined) {
    try {
      const file = new File([text], filename, { type: "text/plain" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return "shared";
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  triggerDownload(text, filename);
  return "downloaded";
}

function triggerDownload(text: string, filename: string): void {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
  );
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
