<template>
  <ColorSwatchPickerRoot
    class="g-color-swatch-picker"
    :model-value="model"
    @update:model-value="(v) => (model = v as string)"
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

const model = defineModel<string>({ required: true });
</script>
