<template>
  <span class="g-wordmark" :class="size">
    <svg
      class="g-mark"
      viewBox="0 0 24 24"
      :width="markSize"
      :height="markSize"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="24" height="24" rx="3" class="mark-tile" />
      <!-- a road narrowing into the distance, two lane-marking dashes;
           copied in public/favicon.svg, public/favicon.ico, and the poster
           header in src/lib/poster.ts -->
      <path d="M4.5 20.5 L9.3 6 L14.7 6 L19.5 20.5 Z" class="mark-road" />
      <line x1="12" y1="18" x2="12" y2="14.3" class="mark-dash" />
      <line x1="12" y1="11.3" x2="12" y2="8.8" class="mark-dash mark-dash-sm" />
    </svg>
    <span class="g-name">Course<span class="name-road">Road</span></span>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    size?: "sm" | "md" | "lg";
  }>(),
  { size: "md" },
);

const markSize = computed(() => ({ sm: 18, md: 22, lg: 30 })[props.size]);
</script>

<style scoped>
.g-wordmark {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  user-select: none;
}
.mark-tile {
  fill: var(--g-mark);
}
.mark-road {
  /* paper, not --g-surface: the tile never inverts, so the mark reads the
     same way on either theme's brand tile */
  fill: #fff;
}
.mark-dash {
  stroke: var(--g-mark);
  stroke-width: 2.1;
  stroke-linecap: round;
}
.mark-dash-sm {
  stroke-width: 1.7;
}
.g-name {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--g-ink);
  letter-spacing: -0.015em;
}
/* Echoes Hydrant's own two-tone wordmark ("hydr" + "ant"): --g-brand, not
   --g-accent, since accent goes neutral-silver in dark mode and this half
   is meant to stay the road's own red in both themes. */
.name-road {
  color: var(--g-brand);
}
.g-wordmark.sm .g-name {
  font: var(--text-body-lg);
  font-family: var(--font-display);
  font-weight: 600;
}
.g-wordmark.md .g-name {
  font-size: 1.25rem;
}
.g-wordmark.lg .g-name {
  font-size: 1.75rem;
}
</style>
