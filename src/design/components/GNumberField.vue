<template>
  <div class="g-number-field" :class="{ invalid, disabled, compact }">
    <g-label v-if="label" :for="fieldId" class="g-number-field-label">{{
      label
    }}</g-label>
    <NumberFieldRoot
      :id="fieldId"
      v-model="model"
      class="g-number-field-shell"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
    >
      <NumberFieldDecrement class="g-number-field-btn">
        <g-icon name="chevronDown" :size="12" />
      </NumberFieldDecrement>
      <NumberFieldInput class="g-number-field-input" />
      <NumberFieldIncrement class="g-number-field-btn">
        <g-icon name="chevronDown" :size="12" class="g-number-field-up" />
      </NumberFieldIncrement>
    </NumberFieldRoot>
    <span v-if="hint || error" class="g-number-field-hint" :class="{ invalid }">
      {{ invalid && error ? error : hint }}
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * A numeric field: min/max clamping, arrow/Page/Home/End stepping, and
 * scroll-to-adjust are all Reka UI's NumberField, in place of a plain
 * `<input type="number">` whose min/max are advisory only (a typed value
 * outside range submits as-is; the browser's own up/down spinners are
 * the only enforcement, and only on click, not on typed input).
 */
import { useId } from "vue";
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
} from "reka-ui";
import GIcon from "./GIcon.vue";
import GLabel from "./GLabel.vue";

const model = defineModel<number | null>({ required: true });

withDefaults(
  defineProps<{
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
  }>(),
  {
    label: undefined,
    hint: undefined,
    error: undefined,
    invalid: false,
    disabled: false,
    min: undefined,
    max: undefined,
    step: 1,
    compact: false,
  },
);

const fieldId = `g-number-field-${useId()}`;
</script>

<style scoped>
.g-number-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.g-number-field-label {
  display: block;
}
.g-number-field-shell {
  display: flex;
  align-items: stretch;
  background: var(--g-surface);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--g-line-strong);
  height: 34px;
  overflow: hidden;
  transition: box-shadow var(--motion-quick) var(--ease-out);
}
.g-number-field-shell:hover {
  box-shadow: inset 0 0 0 1px var(--g-ink-3);
}
.g-number-field:focus-within .g-number-field-shell {
  box-shadow:
    inset 0 0 0 1.5px var(--g-accent),
    0 0 0 3px var(--g-accent-tint);
}
.g-number-field.invalid .g-number-field-shell {
  box-shadow:
    inset 0 0 0 1.5px var(--g-danger),
    0 0 0 3px var(--g-danger-tint);
}
.g-number-field.disabled .g-number-field-shell {
  background: var(--g-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--g-line);
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
.g-number-field-up {
  transform: rotate(180deg);
}
.g-number-field-hint {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.g-number-field-hint.invalid {
  color: var(--g-danger);
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
