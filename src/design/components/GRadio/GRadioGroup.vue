<template>
  <RadioGroupRoot
    class="g-radio-group"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="(v) => emit('update:modelValue', v as T)"
  >
    <slot />
  </RadioGroupRoot>
</template>

<script setup lang="ts" generic="T extends string | number">
/**
 * A single-choice group: roving tabindex and arrow-key selection are Reka
 * UI's RadioGroup. Item content is the caller's (GRadioGroupItem's
 * default slot).
 */
import { RadioGroupRoot } from "reka-ui";

withDefaults(
  defineProps<{
    modelValue?: T;
    disabled?: boolean;
  }>(),
  { modelValue: undefined, disabled: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: T): void;
}>();
</script>
