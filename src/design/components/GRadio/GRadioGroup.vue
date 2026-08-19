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
 * A single-choice group of option rows: roving tabindex and arrow-key
 * selection are Reka UI's RadioGroup, in place of a plain button grid
 * (each option its own tab stop, no arrow-key movement between them).
 * Item content is fully up to the caller (GRadioGroupItem's default
 * slot); this only owns the group-level wiring.
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
