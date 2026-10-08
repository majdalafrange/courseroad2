<template>
  <g-sheet
    :model-value="modelValue"
    label="Settings"
    width="420px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="settings-content">
      <h2 class="settings-title">Settings</h2>

      <div
        v-for="setting in settings"
        :key="setting.id"
        class="settings-section"
      >
        <span :id="`${setting.id}Label`" class="settings-label">
          {{ setting.label }}
        </span>
        <g-radio-group
          class="option-list"
          :style="{ '--option-count': setting.options.length }"
          :model-value="setting.value"
          :disabled="setting.disabledHint !== undefined"
          :aria-labelledby="`${setting.id}Label`"
          :aria-describedby="`${setting.id}Hint`"
          @update:model-value="setting.set"
        >
          <g-radio-group-item
            v-for="option in setting.options"
            :key="option.value"
            class="option-row"
            :value="option.value"
            :data-cy="`${setting.id}Option-${option.value}`"
          >
            <g-icon :name="option.icon" :size="16" />
            <span class="option-label">{{ option.label }}</span>
          </g-radio-group-item>
        </g-radio-group>
        <p :id="`${setting.id}Hint`" class="settings-hint">
          {{ setting.disabledHint ?? selectedDetail(setting) }}
        </p>
      </div>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import { computed } from "vue";
import GIcon, { type IconName } from "../../design/components/GIcon.vue";
import { GRadioGroup, GRadioGroupItem } from "../../design/components/GRadio";
import GSheet from "../../design/components/GSheet.vue";
import { useTheme } from "../../composables/useTheme";
import { useIsMobile } from "../../composables/useIsMobile";
import {
  persistPanelSide,
  persistPrereqHighlight,
  persistRoadLayout,
  type PanelSide,
  type PrereqHighlight,
  type RoadLayout,
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

interface Option {
  value: string;
  label: string;
  detail: string;
  icon: IconName;
}

interface Setting {
  /** Prefixes the label/hint ids and each option's data-cy. */
  id: string;
  label: string;
  value: string;
  set: (value: string) => void;
  options: Option[];
  /** Replaces the hint and disables the group. */
  disabledHint?: string;
}

/**
 * Apply a choice, then write it at once: the beforeunload snapshot only
 * runs for logged-in students.
 */
function persisted<T extends string>(
  apply: (value: T) => void,
  persist: (value: T) => void,
): (value: string) => void {
  return (value) => {
    apply(value as T);
    if (store.cookiesAllowed) {
      persist(value as T);
    }
  };
}

function selectedDetail(setting: Setting): string {
  return setting.options.find((o) => o.value === setting.value)?.detail ?? "";
}

const settings = computed<Setting[]>(() => [
  {
    id: "theme",
    label: "Theme",
    value: store.themeMode,
    // useTheme persists the theme itself.
    set: (value) => setThemeMode(value as ThemeMode),
    options: [
      {
        value: "system",
        label: "System",
        detail: "Matches your device",
        icon: "monitor",
      },
      { value: "light", label: "Light", detail: "Always light", icon: "sun" },
      { value: "dark", label: "Dark", detail: "Always dark", icon: "moon" },
    ],
  },
  {
    id: "roadLayout",
    label: "Plan layout",
    value: store.roadLayout,
    set: persisted<RoadLayout>(store.setRoadLayout, persistRoadLayout),
    options: [
      {
        value: "grid",
        label: "Year grid",
        detail: "Each year's terms side by side",
        icon: "columns",
      },
      {
        value: "classic",
        label: "Classic",
        detail: "One row per term, like the original CourseRoad",
        icon: "rows",
      },
    ],
  },
  {
    id: "prereqHighlight",
    label: "Prerequisite highlight",
    value: store.prereqHighlight,
    set: persisted<PrereqHighlight>(
      store.setPrereqHighlight,
      persistPrereqHighlight,
    ),
    options: [
      {
        value: "hover",
        label: "On hover",
        detail:
          "Pointing at a class lights up its prerequisites and what it unlocks",
        icon: "pointer",
      },
      {
        value: "open",
        label: "Selected",
        detail: "Only for the class open in the detail panel",
        icon: "panelRight",
      },
      {
        value: "off",
        label: "Off",
        detail: "Class details still list prerequisites and what they unlock",
        icon: "eyeOff",
      },
    ],
  },
  {
    id: "panelSide",
    label: "Audit & connections panel",
    value: store.panelSide,
    set: persisted<PanelSide>(store.setPanelSide, persistPanelSide),
    disabledHint: isMobile.value
      ? "Not available on mobile: one pane shows at a time either way."
      : undefined,
    options: [
      {
        value: "left",
        label: "Left",
        detail: "Panel on the left, plan on the right",
        icon: "panelLeft",
      },
      {
        value: "right",
        label: "Right",
        detail: "Panel on the right, plan on the left",
        icon: "panelRight",
      },
    ],
  },
]);
</script>

<style scoped>
.settings-content {
  overflow-y: auto;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  container: settings / inline-size;
}
@media (max-width: 859px) {
  .settings-content {
    padding: var(--space-4);
  }
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
.settings-hint {
  font: var(--text-small);
  color: var(--g-ink-3);
  margin: 0;
}
.option-list {
  display: grid;
  grid-template-columns: repeat(var(--option-count), minmax(0, 1fr));
  gap: var(--space-2);
}
/* :deep(): GRadioGroupItem forwards this class to Reka's own RadioGroupItem
   internals, a grandchild scoped CSS can't otherwise reach. */
:deep(.option-row) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: 0;
  min-height: 36px;
  font: var(--text-small);
  font-weight: 600;
  color: var(--g-ink-2);
  background: var(--g-surface-2);
  border: 1.5px solid var(--g-line);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  cursor: pointer;
  transition:
    border-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out);
}
@media (max-width: 859px) and (pointer: coarse) {
  :deep(.option-row) {
    min-height: 44px;
  }
}
:deep(.option-row:hover) {
  border-color: var(--g-line-strong);
  color: var(--g-ink);
}
:deep(.option-row:focus-visible) {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
:deep(.option-row[data-state="checked"]) {
  border-color: var(--g-accent);
  color: var(--g-ink);
  background: var(--g-accent-tint);
}
/* Forced colors flatten every border and fill, so the choice would
   vanish. A thick Highlight border marks it; the outline is focus's. */
@media (forced-colors: active) {
  :deep(.option-row[data-state="checked"]) {
    border: 3px solid Highlight;
  }
}
:deep(.option-row:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
}
.option-label {
  min-width: 0;
  text-align: center;
}
/* Too narrow for icon and label side by side (three options need about
   360px): the icon stacks above, and a label wraps rather than clips. */
@container settings (max-width: 360px) {
  :deep(.option-row) {
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-1);
  }
}
</style>
