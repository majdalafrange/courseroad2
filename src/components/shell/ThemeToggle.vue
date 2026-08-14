<template>
  <button
    type="button"
    class="theme-toggle"
    data-cy="themeToggle"
    :aria-label="dark ? 'Switch to light theme' : 'Switch to dark theme'"
    @click="emit('toggle')"
  >
    <!-- The Great Dome as a static ground, drawn to its photographed
         proportions: a shallow segmental dome (rise near a quarter of its
         width, not a hemisphere) on a drum, stepping out to the attic, the
         colonnade, and the stylobate. The celestial body above it names
         the theme this button switches TO, so the glyph, the tooltip, and
         the aria-label all say one thing: a crescent while the page is
         light, a sun while it is dark. -->
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <g class="dome">
        <path d="M6.9 12 A6.25 6.25 0 0 1 17.1 12 Z" />
        <rect x="6.4" y="12" width="11.3" height="1.2" />
        <rect x="4.6" y="13.2" width="14.8" height="1.4" />
        <rect x="5.5" y="14.6" width="1.15" height="4.3" />
        <rect x="8.45" y="14.6" width="1.15" height="4.3" />
        <rect x="11.4" y="14.6" width="1.15" height="4.3" />
        <rect x="14.35" y="14.6" width="1.15" height="4.3" />
        <rect x="17.3" y="14.6" width="1.15" height="4.3" />
        <rect x="3.9" y="18.9" width="16.2" height="1.2" />
      </g>
      <!-- The celestial sits in the clear sky beside the dome, never on
           its apex: centered there it reads as a finial and the whole
           mark turns into a different building. -->
      <circle
        class="celestial sun"
        :class="{ visible: dark }"
        cx="18.3"
        cy="4.2"
        r="3.2"
      />
      <path
        class="celestial crescent"
        :class="{ visible: !dark }"
        d="M21.09 6.35 A3.8 3.8 0 1 1 15.89 1.66 A3.04 3.04 0 0 0 21.09 6.35 Z"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{
  dark: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle"): void;
}>();
</script>

<style scoped>
/*
 * A switch, not an action, so it does not use the ghost header-icon-btn
 * recipe: it is a filled round chip carrying the theme it switches TO.
 * --g-ink-2 and --g-bg already invert per theme, so the same rule reads
 * as a dark chip on a light page and a light chip on a dark one, which
 * is a swatch of the other theme sitting in the header. The round shape
 * separates it from the square action buttons beside it.
 */
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--g-ink-2);
  color: var(--g-bg);
  cursor: pointer;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.theme-toggle:hover {
  background: var(--g-ink);
}
.theme-toggle:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

/* Everything inside the chip is the chip's own ink. The dome is the
   ground and stays put; only the sky changes, so the celestial body in
   the clear upper corner carries the state. */
.dome {
  fill: currentColor;
}
/* Matches the 320ms theme crossfade in tokens.ts. */
.celestial {
  fill: currentColor;
  opacity: 0;
  transition: opacity var(--motion-standard) var(--ease-in-out);
}
.celestial.visible {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .celestial {
    transition: none;
  }
}
</style>
