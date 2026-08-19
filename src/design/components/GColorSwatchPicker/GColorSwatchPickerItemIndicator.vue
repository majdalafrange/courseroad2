<template>
  <ColorSwatchPickerItemIndicator class="g-color-swatch-picker-item-indicator">
    <slot />
  </ColorSwatchPickerItemIndicator>
</template>

<script setup lang="ts">
/** Renders its slot only when this item is the picker's current value. */
import { ColorSwatchPickerItemIndicator } from "reka-ui";
</script>
