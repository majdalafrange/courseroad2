/** Saving files the user exports: `.road` files and the share poster. */

import type { RoadContents } from "./types";
import { isTouchDevice } from "./platform";
import { formatRoadContents } from "./roads";

export type SaveFileOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Prefers the share sheet on a touch device: `<a download>` is unreliable
 * on mobile WebKit. `href` is a data: URL, so the bytes never become a page.
 */
export async function saveFile(
  file: File,
  href: string,
): Promise<SaveFileOutcome> {
  if (isTouchDevice() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (err) {
      // Backing out of the share sheet is not a failure; anything else
      // falls through to the direct download below.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  const link = document.createElement("a");
  link.href = href;
  link.download = file.name;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return "downloaded";
}

export function downloadRoadFile(
  name: string,
  contents: RoadContents,
): Promise<SaveFileOutcome> {
  const text = JSON.stringify(formatRoadContents(contents));
  return saveFile(
    new File([text], `${name}.road`, { type: "text/plain" }),
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
  );
}
