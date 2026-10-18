<template>
  <FieldRoot class="g-field" :invalid="invalid" :disabled="disabled">
    <FieldLabel v-if="label" class="g-field-label">{{ label }}</FieldLabel>
    <FieldWiring v-slot="wiring">
      <slot v-bind="wiring" />
    </FieldWiring>
    <FieldError
      v-if="error"
      class="g-field-hint is-error"
      as="span"
      role="alert"
    >
      {{ error }}
    </FieldError>
    <FieldDescription
      v-if="hint && !(invalid && error)"
      class="g-field-hint"
      as="span"
    >
      {{ hint }}
    </FieldDescription>
  </FieldRoot>
</template>

<script setup lang="ts">
/**
 * Caption, hint, and error for one control, wired by Reka's Field. A control
 * Reka's Field doesn't know (NumberField) takes the ids from the slot props.
 */
import "./field.css";
import { defineComponent } from "vue";
import {
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  injectFieldRootContext,
} from "reka-ui";

const {
  label = undefined,
  hint = undefined,
  error = undefined,
  invalid = false,
  disabled = false,
} = defineProps<{
  label?: string;
  hint?: string;
  /** Shown in place of the hint while `invalid`. */
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
}>();

defineSlots<{
  default(props: {
    /** The id the label's `for` points at. */
    id: string;
    labelledBy: string | undefined;
    describedBy: string | undefined;
    invalid: boolean;
  }): unknown;
}>();

/** Reads FieldRoot's context, which only its descendants can inject. */
const FieldWiring = defineComponent((_, { slots }) => {
  const field = injectFieldRootContext();
  return () =>
    slots.default?.({
      id: field.getControlId(),
      labelledBy: field.labelId.value,
      describedBy: field.describedBy.value,
      invalid: field.invalid.value,
    });
});
</script>

<style scoped>
.g-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.g-field-label {
  align-self: flex-start;
  font: var(--text-small);
  color: var(--g-ink-3);
}
.g-field-hint {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.g-field-hint.is-error {
  color: var(--g-danger);
}
</style>
