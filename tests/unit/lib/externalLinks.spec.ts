import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/**
 * Every external link leaves over https (F4). A plain http link from an
 * https page hands the click to the network unprotected, and both hosts
 * this caught (catalog.mit.edu, student.mit.edu) serve https. XML
 * namespace identifiers are not links and stay http by specification.
 */

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.(ts|vue|css)$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe("external links in src", () => {
  it("carry no plain-http URL outside XML namespaces and localhost", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("http://")) {
          return;
        }
        if (
          line.includes("http://www.w3.org/") ||
          line.includes("http://localhost")
        ) {
          return;
        }
        offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
