<template>
  <g-sheet
    v-model="dialog"
    label="Custom activity"
    width="480px"
    :close-button="false"
  >
    <div class="cc-sheet">
      <header class="cc-head">
        <h2 class="cc-title">
          {{ editing !== undefined ? "Edit" : "New" }} custom activity
        </h2>
        <button class="cc-close" aria-label="Close" @click="dialog = false">
          <g-icon name="close" :size="14" />
        </button>
      </header>

      <div class="cc-body">
        <p class="cc-hint">
          Anything that takes time but isn't in the catalog: a UROP, a sport, a
          job. It'll count toward your units and hours, just like a class.
        </p>

        <g-input
          v-model="form.shortTitle"
          label="Short code"
          placeholder="UROP"
          :error="shortError"
          :invalid="shortError !== undefined && touched"
        />
        <g-input
          v-model="form.fullTitle"
          label="Title"
          placeholder="Research in the Soft Robotics lab"
          :error="fullError"
          :invalid="fullError !== undefined && touched"
        />

        <!-- Real values, not placeholders: a placeholder number read as a
             default but submitted as zero, so an untouched form saved an
             activity that counted nothing. -->
        <div class="cc-numbers">
          <g-number-field v-model="form.units" label="Units" :min="0" />
          <g-number-field
            v-model="form.inClassHours"
            label="In-class h/wk"
            :min="0"
          />
          <g-number-field
            v-model="form.outOfClassHours"
            label="Out-of-class h/wk"
            :min="0"
          />
        </div>

        <span id="ccColorLabel" class="cc-label">Color</span>
        <g-color-swatch-picker-root
          v-model="pickerColor"
          class="cc-colors"
          aria-labelledby="ccColorLabel"
        >
          <g-color-swatch-picker-item
            :value="DEFAULT_COLOR_VALUE"
            :color="rawColor(courseColorClassFromId(form.shortTitle ?? ''))"
            class="cc-swatch default"
            fill-class="cc-swatch-fill"
            check-class="cc-swatch-check"
          >
            <g-icon name="check" :size="14" />
          </g-color-swatch-picker-item>
          <g-color-swatch-picker-item
            v-for="hex in SWATCH_HEXES"
            :key="hex"
            :value="hex"
            class="cc-swatch"
            fill-class="cc-swatch-fill"
            check-class="cc-swatch-check"
          >
            <g-icon name="check" :size="12" />
          </g-color-swatch-picker-item>
        </g-color-swatch-picker-root>
      </div>

      <footer class="cc-foot">
        <g-button variant="ghost" @click="dialog = false">Cancel</g-button>
        <g-button variant="primary" @click="submit">
          {{ editing !== undefined ? "Save" : "Add" }} activity
        </g-button>
      </footer>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import {
  GColorSwatchPickerItem,
  GColorSwatchPickerRoot,
} from "../../design/components/GColorSwatchPicker";
import GButton from "../../design/components/GButton.vue";
import GSheet from "../../design/components/GSheet.vue";
import GIcon from "../../design/components/GIcon.vue";
import GInput from "../../design/components/GInput.vue";
import GNumberField from "../../design/components/GNumberField.vue";
import { courseColorClassFromId, rawColor } from "../../lib/colors";
import type { Subject } from "../../lib/types";
import { useCourseDataStore } from "../../stores/courseData";

const store = useCourseDataStore();

const dialog = ref(false);
const touched = ref(false);

const form = reactive({
  shortTitle: "",
  fullTitle: "",
  units: null as number | null,
  inClassHours: null as number | null,
  outOfClassHours: null as number | null,
  colorChosen: "default" as string,
});

// The palette's 42 preset hexes, index-matched to the "@N" scheme saved
// roads persist. GColorSwatchPickerItem's value doubles as its own
// display color, so the picker operates on these hexes directly; this
// bridges that back to form.colorChosen's "default" | "@N" values.
const SWATCH_HEXES = Array.from({ length: 42 }, (_, i) =>
  rawColor(`custom_color-${i}`),
);
// A picker value naming the item instead of coloring it: the "default"
// entry's fill isn't one of the 42 presets, so it can't double as one.
const DEFAULT_COLOR_VALUE = "Department color";
const pickerColor = computed<string>({
  get() {
    if (form.colorChosen === "default") {
      return DEFAULT_COLOR_VALUE;
    }
    const index = Number(form.colorChosen.slice(1));
    return SWATCH_HEXES[index] ?? DEFAULT_COLOR_VALUE;
  },
  set(hex) {
    const index = SWATCH_HEXES.indexOf(hex);
    form.colorChosen = index >= 0 ? `@${index}` : "default";
  },
});

const shortError = computed(() => {
  if (!form.shortTitle.trim()) return "A short code is required.";
  if (form.shortTitle.length > 8) return "Keep it to 8 characters.";
  return undefined;
});
const fullError = computed(() =>
  !form.fullTitle.trim() ? "A title is required." : undefined,
);

const editing = computed(() => store.customClassEditing);

watch(editing, (classEditing) => {
  if (classEditing === undefined) {
    return;
  }
  form.shortTitle = classEditing.subject_id ?? "";
  form.fullTitle = classEditing.title ?? "";
  form.units = classEditing.units ?? 0;
  form.inClassHours = classEditing.in_class_hours ?? 0;
  form.outOfClassHours = classEditing.out_of_class_hours ?? 0;
  form.colorChosen = classEditing.custom_color || "default";
  touched.value = false;
  dialog.value = true;
});

watch(dialog, (open) => {
  if (!open) {
    store.cancelEditCustomClass();
  }
});

function submit() {
  touched.value = true;
  if (shortError.value !== undefined || fullError.value !== undefined) {
    return;
  }
  let color: string | undefined = form.colorChosen;
  if (color === "default") {
    color = undefined;
  }
  const newClass = {
    subject_id: form.shortTitle,
    title: form.fullTitle,
    // GNumberField's own min="0" already clamps these; null only when
    // the field was emptied out, hence the fallback.
    total_units: form.units ?? 0,
    in_class_hours: form.inClassHours ?? 0,
    out_of_class_hours: form.outOfClassHours ?? 0,
    custom_color: color,
    public: false,
    offered_fall: true,
    offered_IAP: true,
    offered_spring: true,
    offered_summer: true,
  } as Subject;
  dialog.value = false;
  if (editing.value !== undefined) {
    store.finishEditCustomClass(newClass);
  } else {
    store.addFromCard(newClass);
  }
}

function openNewClass() {
  form.shortTitle = "";
  form.fullTitle = "";
  // The former placeholder numbers, now prefilled so what the form shows
  // is what submitting saves.
  form.units = 12;
  form.inClassHours = 0;
  form.outOfClassHours = 10;
  form.colorChosen = "default";
  touched.value = false;
  dialog.value = true;
}

defineExpose({ openNewClass });
</script>

<style scoped>
.cc-sheet {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--g-line);
}
.cc-title {
  font: var(--text-title);
  margin: 0;
}
.cc-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
}
.cc-close:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}
.cc-body {
  overflow-y: auto;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.cc-hint {
  font: var(--text-small);
  color: var(--g-ink-2);
  margin: 0;
}
.cc-numbers {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-2);
}
.cc-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}
/* :deep(): ColorSwatchPickerRoot renders its ListboxRoot as-child onto a
   further-nested ListboxContent, a chain that (unlike a plain single-
   root child) doesn't carry this component's scope id along with it. */
:deep(.cc-colors) {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.cc-swatch {
  position: relative;
  width: 28px;
  height: 28px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  /* The palette guarantees contrast against --dept-on per theme. */
  color: var(--dept-on);
  padding: 0;
  overflow: hidden;
}
.cc-swatch:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.cc-swatch.default {
  width: auto;
  padding: 0 var(--space-3);
  font: var(--text-small);
  font-weight: 600;
}
/* ColorSwatch is unstyled by design; the fill sits behind the check
   indicator and takes the item's own shape (square or, for "default",
   the wider pill), whatever that is. :deep(): both are GColorSwatchPickerItem's
   own elements, grandchildren from here. */
:deep(.cc-swatch-fill) {
  position: absolute;
  inset: 0;
  background: var(--reka-color-swatch-color);
}
:deep(.cc-swatch-check) {
  position: relative;
  display: inline-flex;
}
.cc-swatch[data-state="checked"] {
  border-color: var(--g-ink);
  box-shadow: 0 0 0 2px var(--g-bg);
}
.cc-foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--g-line);
}
</style>
