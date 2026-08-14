/** Browser file-download helper for `.road` exports. */

import type { RoadContents } from "./types";
import { formatRoadContents } from "./roads";

/** Download a road as `<name>.road` (legacy-compatible JSON). */
export function downloadRoadFile(name: string, contents: RoadContents): void {
  const text = JSON.stringify(formatRoadContents(contents));
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text),
  );
  element.setAttribute("download", `${name}.road`);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}
