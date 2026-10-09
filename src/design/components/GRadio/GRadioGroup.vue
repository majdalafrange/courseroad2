<template>
  <RadioGroupRoot
    class="g-radio-group"
    :model-value="model"
    :disabled="disabled"
    @update:model-value="(v) => (model = v as T)"
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

const { disabled = false } = defineProps<{
  disabled?: boolean;
}>();

const model = defineModel<T>({ required: true });
</script>
