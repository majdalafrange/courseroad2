/**
 * Captures the planner canvas for docs/ (uses the dev server's ?demo=1
 * seed). Usage: node scripts/screenshot.mjs [url] [outfile] [width] [height]
 */

import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:8080/road?demo=1";
const outfile = process.argv[3] ?? "docs/canvas.png";
const width = Number(process.argv[4] ?? 1500);
const height = Number(process.argv[5] ?? 1280);
const theme = process.argv[6]; // optional "dark"

const browser = await puppeteer.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
// Wait for the demo road's classes to render
await page.waitForSelector('[data-cy^="classInSemester"]', {
  timeout: 60000,
});
// Dismiss the cookie consent for a clean shot
await page.evaluate(() => {
  document
    .querySelector('[data-cy="acceptCookies"]')
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
});
if (theme === "dark") {
  await page.evaluate(() => {
    [...document.querySelectorAll(".rail-action")]
      .find((b) => /Dark/.test(b.textContent))
      ?.click();
  });
}
await new Promise((resolve) => setTimeout(resolve, 900));
await page.screenshot({ path: outfile });
await browser.close();
console.log(`wrote ${outfile}`);
