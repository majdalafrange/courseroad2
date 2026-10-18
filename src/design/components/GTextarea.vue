<template>
  <g-field
    class="g-textarea"
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
      class="g-textarea-field g-field-shell"
      :model-value="model"
      :placeholder="placeholder"
      :rows="rows"
      :maxlength="maxlength"
      v-bind="$attrs"
      @update:model-value="(v) => (model = String(v ?? ''))"
    />
  </g-field>
</template>

<script setup lang="ts">
/**
 * A multi-line text field: a <textarea> wearing the field shell
 * (field.css), in a GField. Attrs (aria-label, listeners) go to the
 * <textarea>.
 */
import { useTemplateRef } from "vue";
import { FieldControl } from "reka-ui";
import GField from "./GField.vue";

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

// As in GInput: FieldControl updates on every input event, where v-model
// on a bare <textarea> would wait out IME composition.
const model = defineModel<string>({ required: true });

const fieldEl = useTemplateRef<{ $el: HTMLTextAreaElement }>("fieldEl");
defineExpose({
  focus: () => fieldEl.value?.$el.focus(),
});
</script>

<style scoped>
.g-textarea-field {
  font: var(--text-body);
  color: var(--g-ink);
  padding: var(--space-2) var(--space-3);
  resize: vertical;
}
.g-textarea.monospace .g-textarea-field {
  font: var(--text-id-small);
}
</style>
