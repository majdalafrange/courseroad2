<template>
  <label
    class="base-checkbox"
    :class="[{ disabled }, rootAttrs.class]"
    :style="rootAttrs.style"
  >
    <CheckboxRoot
      v-bind="boxAttrs"
      class="base-checkbox-box"
      :model-value="model"
      :disabled="disabled"
      @update:model-value="(v) => (model = v === true)"
    >
      <CheckboxIndicator class="base-checkbox-indicator">
        <BaseIcon name="check" :size="12" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <span class="base-checkbox-label"><slot /></span>
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
import BaseIcon from "./BaseIcon.vue";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const rootAttrs = computed(() => ({ class: attrs.class, style: attrs.style }));
const boxAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([key]) => key !== "class" && key !== "style"),
  ),
);

const { disabled = false } = defineProps<{
  disabled?: boolean;
}>();

const model = defineModel<boolean>({ required: true });
</script>

<style scoped>
.base-checkbox {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 24px;
  cursor: pointer;
}
.base-checkbox.disabled {
  cursor: default;
  color: var(--base-ink-disabled);
}
.base-checkbox-box {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: var(--radius-xs);
  background: var(--base-surface);
  /* The Inputs standard's rest ring (tokens.css), at 3:1 (WCAG 1.4.11). */
  box-shadow: inset 0 0 0 1px var(--base-line-control);
  color: var(--base-on-accent);
  cursor: inherit;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    box-shadow var(--motion-quick) var(--ease-out);
}
.base-checkbox:hover .base-checkbox-box:not([data-disabled]) {
  box-shadow: inset 0 0 0 1px var(--base-accent);
}
.base-checkbox-box[data-state="checked"] {
  background: var(--base-accent-fill);
  box-shadow: none;
}
.base-checkbox:hover
  .base-checkbox-box[data-state="checked"]:not([data-disabled]) {
  background: var(--base-accent-fill-hover);
  box-shadow: none;
}
.base-checkbox-box[data-disabled] {
  background: var(--base-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--base-line);
}
.base-checkbox-box:focus-visible {
  outline: none;
  box-shadow: var(--base-focus-ring);
}
.base-checkbox-indicator {
  display: inline-flex;
}
</style>
