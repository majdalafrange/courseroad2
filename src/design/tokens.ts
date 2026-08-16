/**
 * Theme helpers over the design tokens (the CSS custom properties in
 * tokens.css are the source of truth for rendering).
 */

import type { ThemeMode } from "../lib/persistedStore";

export type ThemeName = "light" | "dark";

let themeTransitionTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Apply the theme to the document (CSS vars switch off this attribute).
 * Briefly enables color transitions on surfaces so the switch crossfades
 * rather than snapping, unless the user prefers reduced motion.
 */
export function applyThemeAttribute(theme: ThemeName): void {
  const root = document.documentElement;
  if (root.getAttribute("data-theme") !== null && !prefersReducedMotion()) {
    root.classList.add("theme-transitioning");
    if (themeTransitionTimer !== undefined) {
      clearTimeout(themeTransitionTimer);
    }
    themeTransitionTimer = setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 320);
  }
  root.setAttribute("data-theme", theme);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Live OS/browser color-scheme preference, for the "system" theme mode. */
export function systemPrefersDark(): boolean {
  return typeof matchMedia === "function"
    ? matchMedia("(prefers-color-scheme: dark)").matches
    : true;
}

/** Resolve a stored preference (possibly "system") to a concrete theme. */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ThemeName {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}
