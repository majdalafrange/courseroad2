<template>
  <BaseField
    class="base-textarea"
    :class="{ monospace }"
    :label="label"
    :hint="hint"
    :error="error"
    :invalid="invalid"
    :disabled="disabled"
  >
    <FieldControl
      ref="fieldEl"
      as="textarea"
      class="base-textarea-field base-field-shell"
      :model-value="model"
      :placeholder="placeholder"
      :rows="rows"
      :maxlength="maxlength"
      v-bind="$attrs"
      @update:model-value="(v) => (model = String(v ?? ''))"
    />
  </BaseField>
</template>

<script setup lang="ts">
/**
 * A multi-line text field: a <textarea> wearing the field shell
 * (field.css), in a BaseField. Attrs (aria-label, listeners) go to the
 * <textarea>.
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
  rows = 3,
  maxlength = undefined,
  disabled = false,
  monospace = false,
} = defineProps<{
  label?: string;
  placeholder?: string;
  hint?: string;
  /** Shown in place of the hint while `invalid`. */
  error?: string;
  invalid?: boolean;
  rows?: number;
  maxlength?: number;
  disabled?: boolean;
  /** Set in the identifier face: pasted data or code, not prose. */
  monospace?: boolean;
}>();

// As in BaseInput: FieldControl updates on every input event, where v-model
// on a bare <textarea> would wait out IME composition.
const model = defineModel<string>({ required: true });

const fieldEl = useTemplateRef<{ $el: HTMLTextAreaElement }>("fieldEl");
defineExpose({
  focus: () => fieldEl.value?.$el.focus(),
});
</script>

<style scoped>
.base-textarea-field {
  font: var(--text-body);
  color: var(--base-ink);
  padding: var(--space-2) var(--space-3);
  resize: vertical;
}
.base-textarea.monospace .base-textarea-field {
  font: var(--text-id-small);
}
</style>
