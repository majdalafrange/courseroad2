<template>
  <label class="g-input" :class="{ invalid, disabled }">
    <span v-if="label" class="g-input-label">{{ label }}</span>
    <span class="g-input-shell">
      <slot name="leading" />
      <input
        ref="inputEl"
        class="g-input-field"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :type="type"
        :autocomplete="autocomplete"
        v-bind="$attrs"
        @input="
          emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
      />
      <slot name="trailing" />
    </span>
    <span v-if="hint || error" class="g-input-hint" :class="{ invalid }">
      {{ invalid && error ? error : hint }}
    </span>
  </label>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    placeholder?: string;
    hint?: string;
    error?: string;
    invalid?: boolean;
    disabled?: boolean;
    type?: string;
    autocomplete?: string;
  }>(),
  {
    label: undefined,
    placeholder: undefined,
    hint: undefined,
    error: undefined,
    invalid: false,
    disabled: false,
    type: "text",
    autocomplete: "off",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const inputEl = ref<HTMLInputElement>();
defineExpose({
  focus: () => inputEl.value?.focus(),
  select: () => inputEl.value?.select(),
});
</script>

<style scoped>
.g-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.g-input-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.g-input-shell {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--g-surface);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--g-line-strong);
  padding: 0 var(--space-3);
  height: 34px;
  transition: box-shadow var(--motion-quick) var(--ease-out);
}
.g-input-shell:hover {
  box-shadow: inset 0 0 0 1px var(--g-ink-3);
}
.g-input:focus-within .g-input-shell {
  box-shadow:
    inset 0 0 0 1.5px var(--g-accent),
    0 0 0 3px var(--g-accent-tint);
}
.g-input.invalid .g-input-shell {
  box-shadow:
    inset 0 0 0 1.5px var(--g-danger),
    0 0 0 3px var(--g-danger-tint);
}
.g-input.disabled .g-input-shell {
  background: var(--g-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--g-line);
}
.g-input-field {
  font: var(--text-body);
  color: var(--g-ink);
  background: transparent;
  border: none;
  outline: none;
  flex: 1;
  min-width: 0;
  height: 100%;
}
.g-input-field::placeholder {
  color: var(--g-ink-3);
}
.g-input-hint {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.g-input-hint.invalid {
  color: var(--g-danger);
}
</style>
