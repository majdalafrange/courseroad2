import { defineConfig } from "@playwright/test";

/**
 * Smoke suite over the production build. Hermetic: every FireRoad and
 * analytics request is intercepted in tests/e2e/support/app.ts, so CI
 * needs no network and the flows cannot flake on live catalog data.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run build-prod && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
