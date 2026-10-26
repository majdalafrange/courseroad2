<template>
  <BaseField
    class="base-input"
    :label="label"
    :hint="hint"
    :error="error"
    :invalid="invalid"
    :disabled="disabled"
  >
    <span
      class="base-input-shell base-field-shell"
      @mousedown="onShellMousedown"
    >
      <slot name="leading" />
      <FieldControl
        ref="inputEl"
        class="base-input-field"
        :model-value="model"
        :placeholder="placeholder"
        :type="type"
        :autocomplete="autocomplete"
        v-bind="$attrs"
        @update:model-value="(v) => (model = String(v ?? ''))"
      />
      <slot name="trailing" />
    </span>
  </BaseField>
</template>

<script setup lang="ts">
/**
 * A single-line text field in a BaseField. Attrs (aria-label, data-cy,
 * listeners) go to the <input>.
 */
import { useTemplateRef } from "vue";
import { FieldControl } from "reka-ui";
import BaseField from "./BaseField.vue";

defineOptions({ inheritAttrs: false });

const {
  label = undefined,
  placeholder = undefined,
  hint = undefined,
  error = undefined,
  invalid = false,
  disabled = false,
  type = "text",
  autocomplete = "off",
} = defineProps<{
  label?: string;
  placeholder?: string;
  hint?: string;
  /** Shown in place of the hint while `invalid`. */
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  type?: string;
  autocomplete?: string;
}>();

// FieldControl updates on every input event; v-model on a bare <input>
// would wait out IME composition.
const model = defineModel<string>({ required: true });

const inputEl = useTemplateRef<{ $el: HTMLInputElement }>("inputEl");
defineExpose({
  focus: () => inputEl.value?.$el.focus(),
  select: () => inputEl.value?.$el.select(),
});

/** The shell's padding and leading icon focus the field, as a label would. */
function onShellMousedown(event: MouseEvent) {
  const input = inputEl.value?.$el;
  if (
    !input ||
    input.disabled ||
    event.target === input ||
    (event.target as Element).closest("button, a, input")
  ) {
    return;
  }
  event.preventDefault();
  input.focus();
}
</script>

<style scoped>
.base-input-shell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  height: 34px;
  cursor: text;
}
.base-input[data-disabled] .base-input-shell {
  cursor: default;
}
.base-input-field {
  font: var(--text-body);
  color: var(--base-ink);
  background: transparent;
  border: none;
  outline: none;
  flex: 1;
  min-width: 0;
  height: 100%;
}
</style>
