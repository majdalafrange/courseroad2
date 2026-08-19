<template>
  <div class="g-select" :class="{ invalid, disabled }">
    <g-label v-if="label" :for="fieldId" class="g-select-label">{{
      label
    }}</g-label>
    <SelectRoot :id="fieldId" v-model="model" :disabled="disabled">
      <SelectTrigger class="g-select-trigger" :data-cy="dataCy">
        <SelectValue class="g-select-value" :placeholder="placeholder" />
        <SelectIcon as-child>
          <g-icon name="chevronDown" :size="13" class="g-select-chevron" />
        </SelectIcon>
      </SelectTrigger>
      <SelectPortal>
        <SelectContent
          class="g-select-content"
          position="popper"
          :side-offset="6"
          :collision-padding="8"
        >
          <SelectScrollUpButton class="g-select-scroll">
            <g-icon name="chevronDown" :size="13" class="g-select-scroll-up" />
          </SelectScrollUpButton>
          <SelectViewport class="g-select-viewport">
            <SelectItem
              v-for="option in options"
              :key="String(option.value)"
              class="g-select-item"
              :value="option.value"
            >
              <SelectItemText>{{ option.label }}</SelectItemText>
              <SelectItemIndicator class="g-select-check">
                <g-icon name="check" :size="12" />
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
          <SelectScrollDownButton class="g-select-scroll">
            <g-icon name="chevronDown" :size="13" />
          </SelectScrollDownButton>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
    <span v-if="hint || error" class="g-select-hint" :class="{ invalid }">
      {{ invalid && error ? error : hint }}
    </span>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
/**
 * A single-choice field: typeahead, roving highlight, and the popper
 * positioning are all Reka UI's Select, in place of a plain <select>
 * whose only styling hook browsers give is the outer box (the dropdown
 * panel itself renders however the OS wants).
 */
import { useId } from "vue";
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
import GIcon from "./GIcon.vue";
import GLabel from "./GLabel.vue";

const model = defineModel<T>({ required: true });

withDefaults(
  defineProps<{
    options: { value: T; label: string }[];
    label?: string;
    placeholder?: string;
    hint?: string;
    error?: string;
    invalid?: boolean;
    disabled?: boolean;
    dataCy?: string;
  }>(),
  {
    label: undefined,
    placeholder: "",
    hint: undefined,
    error: undefined,
    invalid: false,
    disabled: false,
    dataCy: undefined,
  },
);

const fieldId = `g-select-${useId()}`;
</script>

<style>
/* Not scoped: see GPopover.vue's note. SelectContent is teleported
   through several layers of Reka's own components, and Vue's scoped-CSS
   attribute doesn't reliably survive that chain. */
.g-select {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.g-select-label {
  display: block;
}
.g-select-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  height: 34px;
  padding: 0 var(--space-3);
  font: var(--text-body);
  color: var(--g-ink);
  background: var(--g-surface);
  border: none;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--g-line-strong);
  cursor: pointer;
  transition: box-shadow var(--motion-quick) var(--ease-out);
}
.g-select-trigger:hover {
  box-shadow: inset 0 0 0 1px var(--g-ink-3);
}
.g-select-trigger:focus-visible {
  outline: none;
  box-shadow:
    inset 0 0 0 1.5px var(--g-accent),
    0 0 0 3px var(--g-accent-tint);
}
.g-select.invalid .g-select-trigger {
  box-shadow:
    inset 0 0 0 1.5px var(--g-danger),
    0 0 0 3px var(--g-danger-tint);
}
.g-select.disabled .g-select-trigger {
  background: var(--g-surface-sunken);
  box-shadow: inset 0 0 0 1px var(--g-line);
  cursor: not-allowed;
}
.g-select-value {
  flex: 1;
  min-width: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.g-select-value[data-placeholder] {
  color: var(--g-ink-3);
}
.g-select-chevron {
  flex-shrink: 0;
  color: var(--g-ink-3);
}

.g-select-content {
  /* Above GSheet's z-index: 100, the highest a select nests inside
     (CompareRoads' road pickers sit in one; the year picker sits in a
     GPopover at 50). Below that, its own scrim swallowed every click on
     an option. */
  z-index: 105;
  min-width: var(--reka-select-trigger-width);
  max-height: min(320px, var(--reka-select-content-available-height));
  background: var(--g-surface);
  border: 1px solid var(--g-overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  padding: var(--space-1);
  transform-origin: var(--reka-select-content-transform-origin);
}
.g-select-content[data-state="open"] {
  animation: g-select-in var(--motion-quick) var(--ease-out);
}
@keyframes g-select-in {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(-3px);
  }
  to {
    transform: none;
  }
}
.g-select-viewport {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.g-select-scroll {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  color: var(--g-ink-3);
  cursor: default;
}
.g-select-scroll-up {
  transform: rotate(180deg);
}
.g-select-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font: var(--text-body);
  color: var(--g-ink-2);
  border-radius: var(--radius-xs);
  cursor: pointer;
  outline: none;
}
.g-select-item[data-highlighted] {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}
.g-select-item[data-state="checked"] {
  color: var(--g-ink);
  font-weight: 600;
}
.g-select-item[data-disabled] {
  opacity: 0.4;
  cursor: not-allowed;
}
.g-select-check {
  margin-left: auto;
  color: var(--g-accent);
  flex-shrink: 0;
  display: inline-flex;
}

.g-select-hint {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.g-select-hint.invalid {
  color: var(--g-danger);
}
</style>
