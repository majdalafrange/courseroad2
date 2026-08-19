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
 * One preset in a GColorSwatchPickerRoot. `value` is both the item's
 * selectable identity and (unless `color` overrides it) what it's
 * filled with; the two only need to differ for an item whose swatch
 * isn't a fixed color (CustomClass's "department color" entry, whose
 * fill tracks whatever the student is typing).
 *
 * The fill and check mark are grandchildren from the caller's view
 * (this component's own template sits between), so a caller's own
 * class on them via fillClass/checkClass needs :deep() to apply.
 */
import { ColorSwatch, ColorSwatchPickerItem } from "reka-ui";
import GColorSwatchPickerItemIndicator from "./GColorSwatchPickerItemIndicator.vue";

withDefaults(
  defineProps<{
    value: string;
    color?: string;
    fillClass?: string | Record<string, boolean> | unknown[];
    checkClass?: string | Record<string, boolean> | unknown[];
  }>(),
  { color: undefined, fillClass: undefined, checkClass: undefined },
);
</script>
