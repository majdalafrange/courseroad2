<template>
  <Label class="g-label" :as="as" :for="props.for">
    <slot />
  </Label>
</template>

<script setup lang="ts">
/**
 * A form field's caption. Reka's Label over a plain span/label mainly for
 * one thing a plain element can't do itself: pointed at a control via
 * `for` (not wrapping it), clicking the caption still focuses that
 * control, and a double-click doesn't select the caption text.
 */
import { Label } from "reka-ui";

const props = withDefaults(
  defineProps<{
    /** id of the control this labels, when not wrapping it directly. */
    for?: string;
    /** "span" when nested inside an element that's already a <label>
     *  itself (two nested <label>s is invalid HTML). */
    as?: "label" | "span";
  }>(),
  { for: undefined, as: "label" },
);
</script>

<style scoped>
.g-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}
</style>
