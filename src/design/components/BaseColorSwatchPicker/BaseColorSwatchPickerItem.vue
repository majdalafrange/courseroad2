<template>
  <ColorSwatchPickerItem class="base-color-swatch-picker-item" :value="value">
    <ColorSwatch
      class="base-color-swatch-picker-item-fill"
      :class="fillClass"
      :color="color ?? value"
    />
    <BaseColorSwatchPickerItemIndicator
      class="base-color-swatch-picker-item-check"
      :class="checkClass"
    >
      <slot />
    </BaseColorSwatchPickerItemIndicator>
  </ColorSwatchPickerItem>
</template>

<script setup lang="ts">
/**
 * One preset in a BaseColorSwatchPickerRoot. `value` is the item's identity
 * and (unless `color` overrides it) its fill. The fill and check mark are
 * grandchildren from the caller's view, so a caller's class on them
 * needs :deep().
 */
import { ColorSwatch, ColorSwatchPickerItem } from "reka-ui";
import BaseColorSwatchPickerItemIndicator from "./BaseColorSwatchPickerItemIndicator.vue";

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
