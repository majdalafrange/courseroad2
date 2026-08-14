<template>
  <kbd class="g-kbd">
    <template v-if="keys.length > 1">
      <template v-for="(key, i) in keys" :key="i">
        <span v-if="i > 0" class="g-kbd-joiner" aria-hidden="true">{{
          joiner
        }}</span>
        <kbd class="g-kbd-key">{{ key }}</kbd>
      </template>
    </template>
    <template v-else>{{ keys[0] }}</template>
  </kbd>
</template>

<script setup lang="ts">
/**
 * A keyboard-input reference. A single key ("esc") renders as one plain
 * <kbd>; more than one nests a <kbd> per key inside the outer one, per
 * the HTML spec's convention for a combination.
 */
withDefaults(
  defineProps<{
    /** Each key pressed together, in order, e.g. ["Ctrl", "K"]. */
    keys: string[];
    /** Text between nested keys: "+" on Windows/Linux, "" on Mac, where
        the convention shows keys back-to-back with no separator. */
    joiner?: string;
  }>(),
  { joiner: "+" },
);
</script>

<style scoped>
.g-kbd {
  font: var(--text-id-small);
  color: var(--g-ink-3);
  border: 1px solid var(--g-line-strong);
  border-radius: var(--radius-xs);
  padding: 1px var(--space-1) 0;
}
.g-kbd-key {
  font: inherit;
  color: inherit;
  border: none;
  padding: 0;
}
.g-kbd-joiner {
  margin: 0 1px;
}
</style>
