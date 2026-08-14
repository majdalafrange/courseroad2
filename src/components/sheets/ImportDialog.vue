<template>
  <g-sheet
    :model-value="modelValue"
    label="Import road"
    width="480px"
    :close-button="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="import-sheet">
      <div class="import-head">
        <h2 class="import-title">Import a road</h2>
        <button class="import-close" aria-label="Close" @click="close">
          <g-icon name="close" :size="14" />
        </button>
      </div>

      <g-input
        v-model="roadtitle"
        label="Road name"
        placeholder="Junior spring draft"
        data-cy="importRoadTitle"
        :invalid="nameError !== undefined"
        :error="nameError"
        @keyup.enter="importRoad"
      />

      <label class="import-file">
        <input
          id="file"
          type="file"
          accept=".road"
          data-cy="importRoadFileInput"
          @input="onFileChange"
        />
        <span class="import-file-label">
          <g-icon name="upload" :size="14" />
          {{ fileName ?? "Choose a .road file" }}
        </span>
      </label>

      <label class="import-paste">
        <span class="import-paste-label">…or paste a road here</span>
        <textarea
          v-model="inputtext"
          class="import-textarea"
          data-cy="importRoadText"
          rows="5"
          spellcheck="false"
        />
      </label>

      <p v-if="badinput" class="import-error">
        That didn't look like a valid <code>.road</code> file. Make sure the
        road has a unique name and the file came from CourseRoad.
      </p>

      <div class="import-actions">
        <g-button variant="ghost" @click="close">Cancel</g-button>
        <g-button
          variant="primary"
          :disabled="nameError !== undefined || inputtext === ''"
          data-cy="importRoadSubmitButton"
          @click="importRoad"
        >
          Import road
        </g-button>
      </div>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import GButton from "../../design/components/GButton.vue";
import GSheet from "../../design/components/GSheet.vue";
import GIcon from "../../design/components/GIcon.vue";
import GInput from "../../design/components/GInput.vue";
import { toast } from "../../design/toast";
import { parseRoadFile, uniqueRoadName } from "../../lib/roads";
import type { SelectedSubject } from "../../lib/types";
import { useCourseDataStore } from "../../stores/courseData";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (
    e: "add-road",
    name: string,
    coursesOfStudy: string[],
    selectedSubjects: SelectedSubject[][],
    progressOverrides: Record<string, number>,
  ): void;
}>();

const store = useCourseDataStore();

const inputtext = ref("");
const roadtitle = ref("");
const badinput = ref(false);
const fileName = ref<string>();
/** The name this dialog filled in, so a later file pick may replace it. */
const suggestedName = ref("");

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      inputtext.value = "";
      // Naming is not a gate anywhere else (a new road is created as
      // "Untitled road", and picking a file names the road after it), so
      // pasting must not stall on an empty field either.
      suggestedName.value = uniqueRoadName(store.roads, "Imported road");
      roadtitle.value = suggestedName.value;
      badinput.value = false;
      fileName.value = undefined;
    }
  },
);

const hasDuplicateName = computed(() => {
  if (!roadtitle.value) {
    return false;
  }
  return Object.keys(store.roads).some(
    (road) =>
      store.roads[road].name.toLowerCase() === roadtitle.value.toLowerCase(),
  );
});

/**
 * Why the import cannot run, as far as the name goes. The button reads
 * this too, so a disabled button always has its reason on screen.
 */
const nameError = computed(() => {
  if (roadtitle.value === "") {
    return "A road name is required.";
  }
  if (hasDuplicateName.value) {
    return "There's already a road with this name.";
  }
  return undefined;
});

function close() {
  emit("update:modelValue", false);
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }
  if (file.name.substring(file.name.length - 5) !== ".road") {
    flagBadInput();
    return;
  }
  fileName.value = file.name;
  // The file's own name wins over the suggestion, but never over a name
  // the student typed.
  if (roadtitle.value === "" || roadtitle.value === suggestedName.value) {
    roadtitle.value = file.name.substring(0, file.name.length - 5);
  }
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    inputtext.value = (loadEvent.target?.result as string) ?? "";
  };
  reader.readAsText(file);
}

function importRoad() {
  if (nameError.value !== undefined || inputtext.value === "") {
    // Enter can reach this while the button is disabled. The field
    // already carries the reason, and the file-format message below
    // would name a different cause than the real one.
    return;
  }
  try {
    const parsed = parseRoadFile(inputtext.value, store.catalog);
    emit(
      "add-road",
      roadtitle.value,
      parsed.coursesOfStudy,
      parsed.selectedSubjects,
      parsed.progressOverrides,
    );
    if (parsed.droppedSubjects.length > 0) {
      const listed = parsed.droppedSubjects.slice(0, 4).join(", ");
      const more =
        parsed.droppedSubjects.length > 4
          ? ` and ${parsed.droppedSubjects.length - 4} more`
          : "";
      toast.warn(
        parsed.droppedSubjects.length === 1
          ? "One entry was left out"
          : `${parsed.droppedSubjects.length} entries were left out`,
        `Not in the subject catalog: ${listed}${more}.`,
      );
    }
    badinput.value = false;
    close();
  } catch (error) {
    console.error("import failed with error:", error);
    flagBadInput();
  }
}

function flagBadInput() {
  badinput.value = true;
  setTimeout(() => {
    badinput.value = false;
  }, 7000);
}
</script>

<style scoped>
.import-sheet {
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow-y: auto;
}
.import-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.import-title {
  font: var(--text-title);
  margin: 0;
}
.import-close {
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
.import-close:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
}

.import-file input[type="file"] {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.import-file-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-body);
  color: var(--g-ink-2);
  border: 1.5px dashed var(--g-line-strong);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  cursor: pointer;
  transition: border-color var(--motion-quick) var(--ease-out);
}
.import-file-label:hover {
  border-color: var(--g-accent);
  color: var(--g-ink);
}

.import-paste {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.import-paste-label {
  font: var(--text-small);
  color: var(--g-ink-3);
}
.import-textarea {
  font: var(--text-id-small);
  color: var(--g-ink);
  background: var(--g-surface);
  border: none;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--g-line-strong);
  padding: var(--space-2) var(--space-3);
  resize: vertical;
  outline: none;
}
.import-textarea:focus {
  box-shadow:
    inset 0 0 0 1.5px var(--g-accent),
    0 0 0 3px var(--g-accent-tint);
}

.import-error {
  font: var(--text-small);
  color: var(--g-danger);
  margin: 0;
}

.import-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
