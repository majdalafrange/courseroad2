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
 * A grid of preset colors: roving tabindex, arrow keys, and a color name
 * per swatch are Reka UI's ColorSwatchPicker. It renders an as-child
 * ListboxRoot onto a nested ListboxContent, so a caller's class on this
 * component needs :deep().
 */
import { ColorSwatchPickerRoot } from "reka-ui";

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>
