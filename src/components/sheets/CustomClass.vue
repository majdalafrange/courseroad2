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
          <g-input v-model="form.units" label="Units" type="number" />
          <g-input
            v-model="form.inClassHours"
            label="In-class h/wk"
            type="number"
          />
          <g-input
            v-model="form.outOfClassHours"
            label="Out-of-class h/wk"
            type="number"
          />
        </div>

        <span class="cc-label">Color</span>
        <div class="cc-colors">
          <button
            class="cc-swatch default"
            :class="{ selected: form.colorChosen === 'default' }"
            :style="{
              background: rawColor(
                courseColorClassFromId(form.shortTitle ?? ''),
              ),
            }"
            aria-label="Department color"
            @click="form.colorChosen = 'default'"
          >
            <g-icon
              v-if="form.colorChosen === 'default'"
              name="check"
              :size="14"
            />
          </button>
          <button
            v-for="i in 42"
            :key="i - 1"
            class="cc-swatch"
            :class="{ selected: form.colorChosen === `@${i - 1}` }"
            :style="{ background: rawColor(`custom_color-${i - 1}`) }"
            :aria-label="`Color ${i}`"
            @click="form.colorChosen = `@${i - 1}`"
          >
            <g-icon
              v-if="form.colorChosen === `@${i - 1}`"
              name="check"
              :size="12"
            />
          </button>
        </div>
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
import GButton from "../../design/components/GButton.vue";
import GSheet from "../../design/components/GSheet.vue";
import GIcon from "../../design/components/GIcon.vue";
import GInput from "../../design/components/GInput.vue";
import { courseColorClassFromId, rawColor } from "../../lib/colors";
import type { Subject } from "../../lib/types";
import { useCourseDataStore } from "../../stores/courseData";

const store = useCourseDataStore();

const dialog = ref(false);
const touched = ref(false);

const form = reactive({
  shortTitle: "",
  fullTitle: "",
  units: "",
  inClassHours: "",
  outOfClassHours: "",
  colorChosen: "default" as string,
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
  form.units = String(classEditing.units ?? "");
  form.inClassHours = String(classEditing.in_class_hours ?? "");
  form.outOfClassHours = String(classEditing.out_of_class_hours ?? "");
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
    // min="0" is advisory only; a typed "-5" survives Number() as a
    // truthy value the || 0 fallback never catches.
    total_units: Math.max(0, Number(form.units) || 0),
    in_class_hours: Math.max(0, Number(form.inClassHours) || 0),
    out_of_class_hours: Math.max(0, Number(form.outOfClassHours) || 0),
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
  form.units = "12";
  form.inClassHours = "0";
  form.outOfClassHours = "10";
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
.cc-colors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.cc-swatch {
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
}
.cc-swatch.default {
  width: auto;
  padding: 0 var(--space-3);
  font: var(--text-small);
  font-weight: 600;
}
.cc-swatch.selected {
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
