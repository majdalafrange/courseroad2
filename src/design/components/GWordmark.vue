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
      <!-- three treads rising left to right; copied in public/favicon.svg,
           public/favicon.ico, and the poster header in src/lib/poster.ts -->
      <path d="M5 18.5 H9.8 V13.5 H14.6 V8.5 H19" class="mark-stroke" />
    </svg>
    <span class="g-name">CourseRoad</span>
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
.mark-stroke {
  /* paper, not --g-surface: the treads never invert, so the mark reads the
     same way on either theme's brand tile */
  stroke: #fff;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}
.g-name {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--g-ink);
  letter-spacing: -0.015em;
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
