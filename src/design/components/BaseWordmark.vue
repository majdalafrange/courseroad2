<template>
  <span class="base-wordmark" :class="size">
    <svg
      class="base-mark"
      viewBox="0 0 24 24"
      :width="markSize"
      :height="markSize"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="24" height="24" rx="3" class="mark-tile" />
      <!-- Lucide's "road" icon, literally. Copied in public/favicon.svg, 
           public/favicon.ico, and the poster header in src/lib/poster.ts -->
      <path
        d="M2.077 18.449A2 2 0 0 0 4 21h16a2 2 0 0 0 1.924-2.55l-4-14A2 2 0 0 0 16 3H8a2 2 0 0 0-1.924 1.45z"
        class="mark-road"
      />
      <line x1="12" y1="21" x2="12" y2="17" class="mark-dash" />
      <line x1="12" y1="12" x2="12" y2="9" class="mark-dash mark-dash-mid" />
      <line x1="12" y1="5" x2="12" y2="3" class="mark-dash mark-dash-sm" />
    </svg>
    <span class="base-name">
      Course<span class="name-road">Road</span>
      <span v-if="dev" class="name-version"> (dev) </span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const { size = "md" } = defineProps<{
  size?: "sm" | "md" | "lg";
}>();

const markSize = computed(() => ({ sm: 18, md: 22, lg: 30 })[size]);
const dev = import.meta.env.MODE !== "production";
</script>

<style scoped>
.base-wordmark {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  user-select: none;
}
.mark-tile {
  fill: var(--base-mark);
}
.mark-road {
  /* paper, not --base-surface: the tile never inverts */
  fill: #fff;
  stroke: var(--base-mark);
  stroke-width: 2.5;
}
.mark-dash {
  stroke: var(--base-mark);
  stroke-width: 2.1;
  stroke-linecap: round;
}
.mark-dash-mid {
  stroke-width: 1.9;
}
.mark-dash-sm {
  stroke-width: 1.7;
}
.base-name {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--base-ink);
}
/* Echoes Hydrant's two-tone wordmark: --base-brand, not --base-accent, since
   accent goes silver in dark mode. */
.name-road {
  color: var(--base-brand);
}
.name-version {
  font-weight: 400;
  color: var(--base-ink-2);
}
.base-wordmark.sm .base-name {
  font: var(--text-body-lg);
  font-family: var(--font-display);
  font-weight: 600;
}
.base-wordmark.md .base-name {
  font-size: 1.25rem;
}
.base-wordmark.lg .base-name {
  font-size: 1.75rem;
  letter-spacing: var(--tracking-tight);
}
</style>
