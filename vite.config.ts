/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type PluginOption } from "vite";
import vue from "@vitejs/plugin-vue";

/**
 * Build-only CSP meta tag. The authoritative policy is the
 * Content-Security-Policy header in the deploy .htaccess files; this meta
 * tag is the fallback for hosts that strip headers. It is injected at
 * build time only; the dev server needs eval and websockets for HMR,
 * which the policy forbids. frame-ancestors and the non-CSP headers
 * cannot be expressed in a meta tag and live in .htaccess alone.
 */
const cspMeta = (mode: string): PluginOption => ({
  name: "csp-meta",
  apply: "build",
  transformIndexHtml() {
    const fireroad = loadEnv(mode, process.cwd()).VITE_FIREROAD_URL;
    const csp = [
      "default-src 'self'",
      "script-src 'self' https://analytics.mit.edu",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self' ${fireroad} https://analytics.mit.edu`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    return [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: csp },
        injectTo: "head-prepend",
      },
    ];
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    port: 8080,
  },
  plugins: [vue(), cspMeta(mode)],
  test: {
    // Lib tests are pure TS and run in node; jsdom is opt-in, for the
    // store specs here and via a file pragma where a lib spec touches
    // the DOM. environmentMatchGlobs is the vitest 2 mechanism.
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          include: ["tests/unit/stores/**"],
          name: "stores",
          environment: "jsdom",
        },
      },
    ],
    include: ["tests/unit/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/stores/**"],
      // Floors sit five points under the measured baseline (2026-08-12:
      // 72.75% stmts, 86.68% branch, 72.43% funcs). They are a ratchet
      // against regression, not a target; raise them as reality rises.
      thresholds: {
        statements: 67,
        branches: 81,
        functions: 67,
        lines: 67,
      },
    },
  },
}));
