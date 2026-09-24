<template>
  <label
    class="g-checkbox"
    :class="[{ disabled }, rootAttrs.class]"
    :style="rootAttrs.style"
  >
    <CheckboxRoot
      v-bind="boxAttrs"
      class="g-checkbox-box"
      :model-value="modelValue"
      :disabled="disabled"
      @update:model-value="(v) => emit('update:modelValue', v === true)"
    >
      <CheckboxIndicator class="g-checkbox-indicator">
        <g-icon name="check" :size="12" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <span class="g-checkbox-label"><slot /></span>
  </label>
</template>

<script setup lang="ts">
/**
 * A checkbox with its caption. role="checkbox" and aria-checked are Reka
 * UI's Checkbox; the <label> around both makes the caption its name and
 * a second place to click. The caller's container sets the font and
 * color. A class or style goes to the row; other attrs (data-cy,
 * listeners) go to the box.
 */
import { computed, useAttrs } from "vue";
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
import GIcon from "./GIcon.vue";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const rootAttrs = computed(() => ({ class: attrs.class, style: attrs.style }));
const boxAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([key]) => key !== "class" && key !== "style"),
  ),
);

const { disabled = false } = defineProps<{
  modelValue: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();
</script>

<style scoped>
.g-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 24px;
  cursor: pointer;
}
.g-checkbox.disabled {
  cursor: default;
  color: var(--g-ink-disabled);
}
.g-checkbox-box {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: var(--radius-xs);
  background: var(--g-surface);
  /* The Inputs standard's rest ring (tokens.css), at 3:1 (WCAG 1.4.11). */
  box-shadow: inset 0 0 0 1px var(--g-line-control);
  color: var(--g-on-accent);
  cursor: inherit;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    box-shadow var(--motion-quick) var(--ease-out);
}
.g-checkbox:hover .g-checkbox-box:not([data-disabled]) {
  box-shadow: inset 0 0 0 1px var(--g-accent);
}
.g-checkbox-box[data-state="checked"] {
  background: var(--g-accent-fill);
  box-shadow: none;
}
.g-checkbox:hover .g-checkbox-box[data-state="checked"]:not([data-disabled]) {
  background: var(--g-accent-fill-hover);
  box-shadow: none;
}
.g-checkbox-box[data-disabled] {
  background: var(--g-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--g-line);
}
.g-checkbox-box:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.g-checkbox-indicator {
  display: inline-flex;
}
</style>
