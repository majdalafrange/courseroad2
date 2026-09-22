<template>
  <ColorSwatchPickerItem class="g-color-swatch-picker-item" :value="value">
    <ColorSwatch
      class="g-color-swatch-picker-item-fill"
      :class="fillClass"
      :color="color ?? value"
    />
    <GColorSwatchPickerItemIndicator
      class="g-color-swatch-picker-item-check"
      :class="checkClass"
    >
      <slot />
    </GColorSwatchPickerItemIndicator>
  </ColorSwatchPickerItem>
</template>

<script setup lang="ts">
/**
 * One preset in a GColorSwatchPickerRoot. `value` is the item's identity
 * and (unless `color` overrides it) its fill. The fill and check mark are
 * grandchildren from the caller's view, so a caller's class on them
 * needs :deep().
 */
import { ColorSwatch, ColorSwatchPickerItem } from "reka-ui";
import GColorSwatchPickerItemIndicator from "./GColorSwatchPickerItemIndicator.vue";

const {
  color = undefined,
  fillClass = undefined,
  checkClass = undefined,
} = defineProps<{
  value: string;
  color?: string;
  fillClass?: string | Record<string, boolean> | unknown[];
  checkClass?: string | Record<string, boolean> | unknown[];
}>();
</script>
