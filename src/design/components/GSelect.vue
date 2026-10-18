<template>
  <g-field
    class="g-select"
    :label="label"
    :hint="hint"
    :error="error"
    :invalid="invalid"
    :disabled="disabled"
  >
    <SelectRoot v-model="model">
      <SelectTrigger
        class="g-select-trigger g-field-shell"
        :data-cy="dataCy"
        :aria-label="label ? undefined : ariaLabel"
      >
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
            <g-icon name="chevronUp" :size="13" />
          </SelectScrollUpButton>
          <SelectViewport class="g-select-viewport">
            <SelectItem
              v-for="option in options"
              :key="String(option.value)"
              class="g-select-item g-row"
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
  </g-field>
</template>

<script setup lang="ts" generic="T extends string | number">
/**
 * A single-choice field: typeahead, roving highlight, and popper
 * positioning are Reka UI's Select; a plain <select>'s dropdown cannot
 * be styled. The trigger takes its label, hint and error wiring from the
 * surrounding GField.
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
import GIcon from "./GIcon.vue";
import GField from "./GField.vue";

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
/* Not scoped: SelectContent is teleported (see GPopover.vue). */
.g-select-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  height: 34px;
  padding: 0 var(--space-3);
  font: var(--text-body);
  color: var(--g-ink);
  cursor: pointer;
}
.g-select[data-disabled] .g-select-trigger {
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
  /* Above GSheet's z-index 100, the highest a select nests inside
     (CompareRoads' road pickers). */
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
.g-select-item {
  border-radius: var(--radius-xs);
}
.g-select-item[data-state="checked"] {
  color: var(--g-ink);
  font-weight: 600;
}
.g-select-check {
  margin-left: auto;
  color: var(--g-accent);
  flex-shrink: 0;
  display: inline-flex;
}
</style>
