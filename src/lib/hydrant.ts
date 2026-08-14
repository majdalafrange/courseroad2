/**
 * Hydrant deep-link encoder.
 *
 * Builds a hydrant.mit.edu URL preloading one semester's class list, using
 * Hydrant's own msgpack + base64 query encoding (logic mirrored from
 * hydrant/src/lib/utils.tsx:urlencode).
 */

import { encode } from "@msgpack/msgpack";
import type { SelectedSubject } from "./types";
import { semesterTypeShort, semesterCalendarYearShort } from "./offering";

/** Hydrant's "t" term parameter, e.g. "f26". */
export function hydrantTerm(index: number, baseYearValue: number): string {
  return (
    semesterTypeShort(index) + semesterCalendarYearShort(index, baseYearValue)
  );
}

/** Hydrant's "s" payload: msgpack([[ [id], ... ], null, 0]) base64-encoded. */
export function hydrantState(semesterSubjects: SelectedSubject[]): string {
  const classes = semesterSubjects.map((subj) => [subj.subject_id]);
  const obj = [classes, null, 0];
  // The payload uses only fixarray/fixstr/nil/fixint, whose msgpack
  // encodings are canonical; the unit test pins the exact bytes so an
  // encoder change cannot silently break Hydrant's decoder.
  const encoded = encode(obj);
  return btoa(String.fromCharCode(...encoded));
}

/** Full Hydrant URL for a semester bucket. */
export function hydrantURL(
  index: number,
  baseYearValue: number,
  semesterSubjects: SelectedSubject[],
): string {
  const url = new URL("https://hydrant.mit.edu/");
  url.searchParams.set("t", hydrantTerm(index, baseYearValue));
  url.searchParams.set("s", hydrantState(semesterSubjects));
  return url.href;
}
