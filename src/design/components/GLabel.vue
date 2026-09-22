<template>
  <Label class="g-label" :as="as" :for="forId">
    <slot />
  </Label>
</template>

<script setup lang="ts">
/**
 * A form field's caption. Reka's Label: pointed at a control via `for`,
 * clicking the caption focuses the control and a double-click doesn't
 * select the text.
 */
import { Label } from "reka-ui";

const { forId = undefined, as = "label" } = defineProps<{
  /** id of the control this labels, when not wrapping it directly. */
  forId?: string;
  /** "span" when nested inside an element that's already a <label>
   *  itself (two nested <label>s is invalid HTML). */
  as?: "label" | "span";
}>();
</script>

<style scoped>
.g-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}
</style>
