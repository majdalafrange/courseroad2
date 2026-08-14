/**
 * FireRoad timestamp formatting.
 *
 * The legacy app produced road timestamps with
 * `moment().format("YYYY-MM-DDTHH:mm:ss.SSS000Z")`, i.e. *local* time with
 * millisecond precision, three literal zeros (faux microseconds), and the
 * UTC offset with a colon ("+05:30", "-04:00"). These strings are stored in
 * roads, sent to FireRoad on save, and compared during conflict resolution,
 * so the format must stay byte-identical. Pinned against moment in
 * tests/unit/lib/dates.spec.ts.
 */

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

/** Format a date exactly like moment's "YYYY-MM-DDTHH:mm:ss.SSS000Z". */
export function formatFireroadDate(date: Date = new Date()): string {
  const offsetMinutesTotal = -date.getTimezoneOffset();
  const sign = offsetMinutesTotal < 0 ? "-" : "+";
  const offsetAbs = Math.abs(offsetMinutesTotal);
  const offset = `${sign}${pad(Math.floor(offsetAbs / 60), 2)}:${pad(offsetAbs % 60, 2)}`;
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}` +
    `T${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}` +
    `.${pad(date.getMilliseconds(), 3)}000${offset}`
  );
}
