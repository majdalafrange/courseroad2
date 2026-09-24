<template>
  <div class="g-textarea" :class="{ disabled, monospace }">
    <!-- As in GInput: the label wraps the caption and the field only, so
         the hint is not read as part of the field's name. -->
    <label class="g-textarea-labelled">
      <span v-if="label" class="g-textarea-label">{{ label }}</span>
      <textarea
        ref="fieldEl"
        class="g-textarea-field"
        :value="modelValue"
        :placeholder="placeholder"
        :rows="rows"
        :maxlength="maxlength"
        :disabled="disabled"
        :aria-describedby="hint ? hintId : undefined"
        v-bind="$attrs"
        @input="
          emit(
            'update:modelValue',
            ($event.target as HTMLTextAreaElement).value,
          )
        "
      />
    </label>
    <span v-if="hint" :id="hintId" class="g-textarea-hint">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * A multi-line text field: GInput's shell (rest, hover, focus, disabled
 * rings from the Inputs standard in tokens.css) around a <textarea>.
 * Attrs (aria-label, listeners) go to the <textarea>.
 */
import { useId, useTemplateRef } from "vue";

defineOptions({ inheritAttrs: false });

const {
  label = undefined,
  placeholder = undefined,
  hint = undefined,
  rows = 3,
  maxlength = undefined,
  disabled = false,
  monospace = false,
} = defineProps<{
  modelValue: string;
  label?: string;
  placeholder?: string;
  hint?: string;
  rows?: number;
  maxlength?: number;
  disabled?: boolean;
  /** Set in the identifier face: pasted data or code, not prose. */
  monospace?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const hintId = `g-textarea-hint-${useId()}`;
const fieldEl = useTemplateRef("fieldEl");
defineExpose({
  focus: () => fieldEl.value?.focus(),
});
</script>

<style scoped>
.g-textarea {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.g-textarea-labelled {
  display: contents;
}
.g-textarea-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.g-textarea-field {
  font: var(--text-body);
  color: var(--g-ink);
  background: var(--g-surface);
  border: none;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--g-line-control);
  padding: var(--space-2) var(--space-3);
  resize: vertical;
  outline: none;
  transition: box-shadow var(--motion-quick) var(--ease-out);
}
.g-textarea-field:hover {
  box-shadow: inset 0 0 0 1px var(--g-ink-3);
}
.g-textarea-field:focus {
  box-shadow:
    inset 0 0 0 1.5px var(--g-accent),
    0 0 0 3px var(--g-accent-tint);
}
.g-textarea-field::placeholder {
  color: var(--g-ink-3);
}
.g-textarea.disabled .g-textarea-field {
  background: var(--g-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--g-line);
}
.g-textarea.monospace .g-textarea-field {
  font: var(--text-id-small);
}
.g-textarea-hint {
  font: var(--text-small);
  color: var(--g-ink-3);
}
</style>
