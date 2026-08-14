import js from "@eslint/js";
import pluginVue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
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
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // TypeScript handles undefined analysis (vue-tsc); the TS-aware
      // unused-vars rule below replaces the base one.
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      // Legacy single-word component filenames (Road, Semester, ...) are
      // kept through the migration; they are always used via imports, never
      // as raw tags, so they cannot clash with HTML elements.
      "vue/multi-word-component-names": "off",
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
    // CLI scripts report through stdout; console.log is their interface.
    files: ["scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
  prettier,
);
