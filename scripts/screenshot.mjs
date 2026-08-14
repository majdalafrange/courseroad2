/**
 * Captures the planner canvas for docs/ (uses the dev server's ?demo=1
 * seed). Usage: node scripts/screenshot.mjs [url] [outfile] [width] [height] [theme]
 */

import puppeteer from "puppeteer-core";
import { parseArgs } from "node:util";

const OPTIONS = {
  url: {
    type: "string",
    short: "u",
    default: "http://localhost:8080/road?demo=1",
  },
  outfile: {
    type: "string",
    short: "o",
    default: "docs/canvas.png",
  },
  width: {
    type: "string",
    short: "w",
    default: "1500",
  },
  height: {
    type: "string",
    short: "h",
    default: "1280",
  },
  theme: {
    type: "string",
    short: "t",
    default: "light",
  },
};

const { values } = parseArgs({ options: OPTIONS });
const url = values.url;
const outfile = values.outfile;
const width = Number(values.width);
const height = Number(values.height);
const theme = values.theme; // optional "dark"

const browser = await puppeteer.launch({
  channel: "chrome",
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
if (theme === "light") {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
  });
}
if (theme === "dark") {
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });
}
await new Promise((resolve) => setTimeout(resolve, 900));
await page.screenshot({ path: outfile });
await browser.close();
console.log(`wrote ${outfile}`);
