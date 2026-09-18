<template>
  <RadioGroupItem
    class="g-radio-group-item"
    :value="value"
    :disabled="disabled"
  >
    <template #default="{ checked }">
      <RadioGroupIndicator as-child>
        <slot name="indicator" />
      </RadioGroupIndicator>
      <slot :checked="checked" />
    </template>
  </RadioGroupItem>
</template>

<script setup lang="ts" generic="T extends string | number">
/**
 * One option in a GRadioGroup. Content is the caller's via the default
 * slot's `checked`. The item element is a grandchild (Reka's
 * RadioGroupItem/Radio sit between), so a caller's class on it needs
 * :deep().
 */
import { RadioGroupItem, RadioGroupIndicator } from "reka-ui";

withDefaults(
  defineProps<{
    value: T;
    disabled?: boolean;
  }>(),
  { disabled: false },
);
</script>
