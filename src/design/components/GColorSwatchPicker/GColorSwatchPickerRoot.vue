<template>
  <ColorSwatchPickerRoot
    class="g-color-swatch-picker"
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v as string)"
  >
    <slot />
  </ColorSwatchPickerRoot>
</template>

<script setup lang="ts">
/**
 * A grid of preset colors to pick from: roving tabindex, arrow-key
 * movement, and a real color name read out per swatch (via each item's
 * value) are Reka UI's ColorSwatchPicker, in place of a caller hand-
 * rolling a button grid.
 *
 * ColorSwatchPickerRoot renders an as-child ListboxRoot onto a further-
 * nested ListboxContent rather than a single root of its own, so a
 * caller's own class on this component needs :deep() to be reachable
 * from scoped CSS (unlike a plain single-root wrapper).
 */
import { ColorSwatchPickerRoot } from "reka-ui";

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>
