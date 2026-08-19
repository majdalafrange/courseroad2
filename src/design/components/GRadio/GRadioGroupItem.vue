<template>
  <RadioGroupItem
    class="g-radio-group-item"
    :value="value"
    :disabled="disabled"
  >
    <template #default="{ checked }">
      <slot :checked="checked" />
    </template>
  </RadioGroupItem>
</template>

<script setup lang="ts" generic="T extends string | number">
/**
 * One option in a GRadioGroup. Content (icon, label, check mark, ...)
 * is entirely the caller's via the default slot's `checked` state. The
 * item element itself is a grandchild from the caller's view (Reka's
 * own RadioGroupItem/Radio internals sit in between), so a caller's own
 * class on it needs :deep() to be reachable from scoped CSS.
 */
import { RadioGroupItem } from "reka-ui";

withDefaults(
  defineProps<{
    value: T;
    disabled?: boolean;
  }>(),
  { disabled: false },
);
</script>
