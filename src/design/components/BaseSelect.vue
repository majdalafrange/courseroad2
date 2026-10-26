<template>
  <BaseField
    class="base-select"
    :label="label"
    :hint="hint"
    :error="error"
    :invalid="invalid"
    :disabled="disabled"
  >
    <SelectRoot v-model="model">
      <SelectTrigger
        class="base-select-trigger base-field-shell"
        :data-cy="dataCy"
        :aria-label="label ? undefined : ariaLabel"
      >
        <SelectValue class="base-select-value" :placeholder="placeholder" />
        <SelectIcon as-child>
          <BaseIcon name="chevronDown" :size="13" class="base-select-chevron" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="base-select-content"
          position="popper"
          :side-offset="6"
          :collision-padding="8"
        >
          <SelectScrollUpButton class="base-select-scroll">
            <BaseIcon name="chevronUp" :size="13" />
          </SelectScrollUpButton>
          <SelectViewport class="base-select-viewport">
            <SelectItem
              v-for="option in options"
              :key="String(option.value)"
              class="base-select-item base-row"
              :value="option.value"
            >
              <SelectItemText>{{ option.label }}</SelectItemText>
              <SelectItemIndicator class="base-select-check">
                <BaseIcon name="check" :size="12" />
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
          <SelectScrollDownButton class="base-select-scroll">
            <BaseIcon name="chevronDown" :size="13" />
          </SelectScrollDownButton>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </BaseField>
</template>

<script setup lang="ts" generic="T extends string | number">
/**
 * A single-choice field: typeahead, roving highlight, and popper
 * positioning are Reka UI's Select; a plain <select>'s dropdown cannot
 * be styled. The trigger takes its label, hint and error wiring from the
 * surrounding BaseField.
 */
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";
import "./rows.css";
import BaseIcon from "./BaseIcon.vue";
import BaseField from "./BaseField.vue";

const model = defineModel<T>({ required: true });
const {
  label = undefined,
  placeholder = "",
  hint = undefined,
  error = undefined,
  invalid = false,
  disabled = false,
  dataCy = undefined,
  ariaLabel = undefined,
} = defineProps<{
  options: { value: T; label: string }[];
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  dataCy?: string;
  /** Accessible name when no visible label fits (the context names it). */
  ariaLabel?: string;
}>();
</script>

<style>
/* Not scoped: SelectContent is teleported (see BasePopover.vue). */
.base-select-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  height: 34px;
  padding: 0 var(--space-3);
  font: var(--text-body);
  color: var(--base-ink);
  cursor: pointer;
}
.base-select[data-disabled] .base-select-trigger {
  cursor: not-allowed;
}
.base-select-value {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.base-select-value[data-placeholder] {
  color: var(--base-ink-3);
}
.base-select-chevron {
  flex-shrink: 0;
  color: var(--base-ink-3);
}

.base-select-content {
  /* Above BaseSheet's z-index 100, the highest a select nests inside
     (CompareRoads' road pickers). */
  z-index: 105;
  min-width: var(--reka-select-trigger-width);
  max-height: min(320px, var(--reka-select-content-available-height));
  background: var(--base-surface);
  border: 1px solid var(--base-overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  padding: var(--space-1);
  transform-origin: var(--reka-select-content-transform-origin);
}
.base-select-content[data-state="open"] {
  animation: base-select-in var(--motion-quick) var(--ease-out);
}
@keyframes base-select-in {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(-3px);
  }
  to {
    transform: none;
  }
}
.base-select-viewport {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.base-select-scroll {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  color: var(--base-ink-3);
  cursor: default;
}
.base-select-item {
  border-radius: var(--radius-xs);
}
.base-select-item[data-state="checked"] {
  color: var(--base-ink);
  font-weight: 600;
}
.base-select-check {
  margin-left: auto;
  color: var(--base-accent);
  flex-shrink: 0;
  display: inline-flex;
}
</style>
