<template>
  <g-sheet
    :model-value="modelValue"
    label="Settings"
    width="420px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="settings-content">
      <h2 class="settings-title">Settings</h2>

      <div class="settings-section">
        <span id="themeLabel" class="settings-label">Theme</span>
        <div class="option-list" role="radiogroup" aria-labelledby="themeLabel">
          <button
            v-for="option in THEME_OPTIONS"
            :key="option.mode"
            class="option-row"
            :class="{ selected: store.themeMode === option.mode }"
            role="radio"
            :aria-checked="store.themeMode === option.mode"
            :data-cy="`themeOption-${option.mode}`"
            @click="setThemeMode(option.mode)"
          >
            <g-icon :name="option.icon" :size="18" />
            <span class="option-text">
              <span class="option-label">{{ option.label }}</span>
              <span class="option-detail">{{ option.detail }}</span>
            </span>
            <g-icon
              v-if="store.themeMode === option.mode"
              name="check"
              :size="14"
              class="option-check"
            />
          </button>
        </div>
      </div>

      <div class="settings-section">
        <span id="panelSideLabel" class="settings-label">
          Audit &amp; connections panel
        </span>
        <span
          v-if="isMobile"
          class="settings-label"
          style="font-weight: 400; color: var(--g-ink-3)"
        >
          Panels are not not available on mobile!
        </span>
        <div
          class="option-list"
          role="radiogroup"
          aria-labelledby="panelSideLabel"
        >
          <button
            v-for="option in PANEL_SIDE_OPTIONS"
            :key="option.side"
            :disabled="isMobile"
            class="option-row"
            :class="{ selected: store.panelSide === option.side }"
            role="radio"
            :aria-checked="store.panelSide === option.side"
            :data-cy="`panelSideOption-${option.side}`"
            @click="setPanelSide(option.side)"
          >
            <g-icon :name="option.icon" :size="18" />
            <span class="option-text">
              <span class="option-label">{{ option.label }}</span>
              <span class="option-detail">{{ option.detail }}</span>
            </span>
            <g-icon
              v-if="store.panelSide === option.side"
              name="check"
              :size="14"
              class="option-check"
            />
          </button>
        </div>
      </div>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import GIcon from "../../design/components/GIcon.vue";
import GSheet from "../../design/components/GSheet.vue";
import { useTheme } from "../../composables/useTheme";
import { useIsMobile } from "../../composables/useIsMobile";
import {
  persistPanelSide,
  type PanelSide,
  type ThemeMode,
} from "../../lib/persistedStore";
import { useCourseDataStore } from "../../stores/courseData";

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const store = useCourseDataStore();
const { setThemeMode } = useTheme();
const isMobile = useIsMobile();

function setPanelSide(side: PanelSide): void {
  store.setPanelSide(side);
  // Written immediately, same reasoning as the theme: the beforeunload
  // snapshot only runs for logged-in students.
  if (store.cookiesAllowed) {
    persistPanelSide(side);
  }
}

const THEME_OPTIONS: {
  mode: ThemeMode;
  label: string;
  detail: string;
  icon: "sun" | "moon" | "monitor";
}[] = [
  {
    mode: "system",
    label: "System Default",
    detail: "Matches your device",
    icon: "monitor",
  },
  { mode: "light", label: "Light", detail: "Always light", icon: "sun" },
  { mode: "dark", label: "Dark", detail: "Always dark", icon: "moon" },
];

const PANEL_SIDE_OPTIONS: {
  side: PanelSide;
  label: string;
  detail: string;
  icon: "panelLeft" | "panelRight";
}[] = [
  {
    side: "left",
    label: "Left",
    detail: "Panel on the left, plan on the right",
    icon: "panelLeft",
  },
  {
    side: "right",
    label: "Right",
    detail: "Panel on the right, plan on the left",
    icon: "panelRight",
  },
];
</script>

<style scoped>
.settings-content {
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.settings-title {
  font: var(--text-heading);
  color: var(--g-ink);
  margin: 0;
}
.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.settings-label {
  font: var(--text-small);
  font-weight: 600;
  color: var(--g-ink-2);
}
.option-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.option-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  font: var(--text-body);
  color: var(--g-ink-2);
  background: var(--g-surface-2);
  border: 1.5px solid var(--g-line);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  cursor: pointer;
  text-align: left;
  transition:
    border-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out);
}
.option-row:hover {
  border-color: var(--g-line-strong);
}
.option-row:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.option-row.selected {
  border-color: var(--g-accent);
  color: var(--g-ink);
  background: var(--g-accent-tint);
}
.option-row:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.option-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.option-label {
  font-weight: 600;
  color: var(--g-ink);
}
.option-detail {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.option-check {
  color: var(--g-accent);
  flex-shrink: 0;
}
</style>
