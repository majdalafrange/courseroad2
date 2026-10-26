import { defineConfig } from "eslint/config";

import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig(
  {
    ignores: [
      "dist/",
      "coverage/",
      ".vite/",
      "playwright-report/",
      "test-results/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, definePage: "readonly" },
    },
    settings: { "import/core-modules": ["vue-router/auto-routes"] },
    rules: {
      // TypeScript handles undefined analysis (vue-tsc); the TS-aware
      // unused-vars rule below replaces the base one.
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      // Vue style guide rules outside flat/recommended.
      "vue/component-name-in-template-casing": [
        "error",
        "PascalCase",
        { registeredComponentsOnly: false },
      ],
      "vue/match-component-file-name": ["error", { extensions: ["vue"] }],
      // warn and error report real failures; anything else is leftover
      // debugging.
      "no-console": ["error", { allow: ["warn", "error"] }],
      // A cast to never or any silences the compiler as thoroughly as an
      // any type, without tripping no-explicit-any.
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSAsExpression > TSNeverKeyword",
          message: "as never silences the compiler. Model the type instead.",
        },
        {
          selector: "TSAsExpression > TSAnyKeyword",
          message: "as any silences the compiler. Model the type instead.",
        },
      ],
    },
  },
  {
    // Specs build deliberately malformed fixtures (a semester that is
    // null, a custom_color that is a number); the cast to never is the
    // right tool there and only there.
    files: ["tests/**"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // File-based routes are named by their URL path and never used as tags.
    files: ["src/pages/**"],
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  {
    // CLI scripts report through stdout; console.log is their interface.
    files: ["scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
  prettier,
  {
    // eslint-config-prettier turns this off, but Prettier keeps either form;
    // only empty components are required to self-close.
    files: ["**/*.vue"],
    rules: {
      "vue/html-self-closing": [
        "error",
        {
          html: { void: "any", normal: "any", component: "always" },
          svg: "any",
          math: "any",
        },
      ],
    },
  },
);
