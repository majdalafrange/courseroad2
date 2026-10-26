<template>
  <BaseField
    v-slot="{ id, labelledBy, describedBy, invalid: fieldInvalid }"
    class="base-number-field"
    :class="{ compact }"
    :label="label"
    :hint="hint"
    :error="error"
    :invalid="invalid"
    :disabled="disabled"
  >
    <NumberFieldRoot
      :id="id"
      v-model="model"
      class="base-number-field-shell base-field-shell"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
    >
      <NumberFieldDecrement class="base-number-field-btn">
        <BaseIcon name="chevronDown" :size="12" />
      </NumberFieldDecrement>
      <NumberFieldInput
        class="base-number-field-input"
        :aria-label="label ? undefined : ariaLabel"
        :aria-labelledby="labelledBy"
        :aria-describedby="describedBy"
        :aria-invalid="(fieldInvalid && !disabled) || undefined"
      />
      <NumberFieldIncrement class="base-number-field-btn">
        <BaseIcon name="chevronUp" :size="12" />
      </NumberFieldIncrement>
    </NumberFieldRoot>
  </BaseField>
</template>

<script setup lang="ts">
/**
 * A numeric field: min/max clamping, arrow/Page/Home/End stepping, and
 * scroll-to-adjust are Reka UI's NumberField; a plain `<input
 * type="number">` only enforces min/max on its spinners. Reka's Field
 * doesn't know NumberField, so the input takes BaseField's wiring from its
 * slot props.
 */
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui";
import BaseIcon from "./BaseIcon.vue";
import BaseField from "./BaseField.vue";

const model = defineModel<number | null>({ required: true });

const {
  label = undefined,
  hint = undefined,
  error = undefined,
  invalid = false,
  disabled = false,
  min = undefined,
  max = undefined,
  step = 1,
  compact = false,
  ariaLabel = undefined,
} = defineProps<{
  label?: string;
  hint?: string;
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** Smaller shell, narrower spinner buttons: an inline field next to
   *  other context (a suffix, a heading) that already names it. */
  compact?: boolean;
  /** Accessible name for a compact field with no visible label. */
  ariaLabel?: string;
}>();
</script>

<style scoped>
.base-number-field-shell {
  display: flex;
  align-items: stretch;
  height: 34px;
  overflow: hidden;
}
.base-number-field-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  font: var(--text-body);
  color: var(--base-ink);
  background: transparent;
  border: none;
  outline: none;
  text-align: center;
  padding: 0 var(--space-1);
}
.base-number-field-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--base-ink-3);
  cursor: pointer;
}
.base-number-field-btn:hover:not(:disabled) {
  background: var(--base-surface-sunken);
  color: var(--base-ink);
}
.base-number-field-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.base-number-field.compact .base-number-field-shell {
  height: 26px;
  border-radius: var(--radius-xs);
}
.base-number-field.compact .base-number-field-input {
  font: var(--text-id);
  padding: 0;
}
.base-number-field.compact .base-number-field-btn {
  width: 20px;
}
</style>
