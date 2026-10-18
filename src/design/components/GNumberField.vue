<template>
  <g-field
    v-slot="{ id, labelledBy, describedBy, invalid: fieldInvalid }"
    class="g-number-field"
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
      class="g-number-field-shell g-field-shell"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
    >
      <NumberFieldDecrement class="g-number-field-btn">
        <g-icon name="chevronDown" :size="12" />
      </NumberFieldDecrement>
      <NumberFieldInput
        class="g-number-field-input"
        :aria-label="label ? undefined : ariaLabel"
        :aria-labelledby="labelledBy"
        :aria-describedby="describedBy"
        :aria-invalid="(fieldInvalid && !disabled) || undefined"
      />
      <NumberFieldIncrement class="g-number-field-btn">
        <g-icon name="chevronUp" :size="12" />
      </NumberFieldIncrement>
    </NumberFieldRoot>
  </g-field>
</template>

<script setup lang="ts">
/**
 * A numeric field: min/max clamping, arrow/Page/Home/End stepping, and
 * scroll-to-adjust are Reka UI's NumberField; a plain `<input
 * type="number">` only enforces min/max on its spinners. Reka's Field
 * doesn't know NumberField, so the input takes GField's wiring from its
 * slot props.
 */
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui";
import GIcon from "./GIcon.vue";
import GField from "./GField.vue";

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
.g-number-field-shell {
  display: flex;
  align-items: stretch;
  height: 34px;
  overflow: hidden;
}
.g-number-field-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  font: var(--text-body);
  color: var(--g-ink);
  background: transparent;
  border: none;
  outline: none;
  text-align: center;
  padding: 0 var(--space-1);
}
.g-number-field-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
}
.g-number-field-btn:hover:not(:disabled) {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}
.g-number-field-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.g-number-field.compact .g-number-field-shell {
  height: 26px;
  border-radius: var(--radius-xs);
}
.g-number-field.compact .g-number-field-input {
  font: var(--text-id);
  padding: 0;
}
.g-number-field.compact .g-number-field-btn {
  width: 20px;
}
</style>
