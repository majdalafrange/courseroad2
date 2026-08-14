<template>
  <div class="g-card" :class="[`e-${elevation}`, { hoverable, sunken }]">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 0 = flat outline, 1 = resting, 2 = raised. */
    elevation?: 0 | 1 | 2;
    /** Lifts on hover (use for clickable cards). */
    hoverable?: boolean;
    /** Recessed well (empty states, drop zones). */
    sunken?: boolean;
  }>(),
  { elevation: 1, hoverable: false, sunken: false },
);
</script>

<style scoped>
.g-card {
  background: var(--g-surface);
  border-radius: var(--radius-md);
  transition:
    box-shadow var(--motion-quick) var(--ease-out),
    transform var(--motion-quick) var(--ease-out);
}
.e-0 {
  box-shadow: inset 0 0 0 1px var(--g-line);
}
.e-1 {
  box-shadow: var(--shadow-1);
}
.e-2 {
  box-shadow: var(--shadow-2);
}
.hoverable:hover {
  box-shadow: var(--shadow-15);
  transform: translateY(-1px);
}
.sunken {
  background: var(--g-surface-sunken);
  box-shadow:
    var(--shadow-well),
    inset 0 0 0 1px var(--g-line);
}
</style>
