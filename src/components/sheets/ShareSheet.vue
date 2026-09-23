<template>
  <g-sheet
    :model-value="modelValue"
    label="Share road"
    width="640px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <header class="share-head">
      <h2 class="share-title">Share “{{ roadName }}”</h2>
    </header>

    <div class="share-preview">
      <!-- posterSvg is built by buildRoadPoster from catalog data with
                 every text value escaped (lib/poster.ts esc()); no raw user
                 input reaches the markup. -->
      <!-- role="img" names the poster as one picture; its SVG text would
           otherwise be read out as loose fragments. -->
      <!-- eslint-disable vue/no-v-html -->
      <div
        class="preview-frame"
        role="img"
        :aria-label="`Preview of the poster for ${roadName}`"
        v-html="posterSvg"
      />
      <!-- eslint-enable vue/no-v-html -->
    </div>

    <div class="share-options">
      <button class="share-option" @click="savePng">
        <g-icon
          :name="isTouchDevice ? 'shareMessage' : 'imageDown'"
          :size="16"
        />
        <span class="option-text">
          <strong>{{ isTouchDevice ? "Share" : "Save" }} as image</strong>
          <small>PNG image of the full road</small>
        </span>
      </button>
      <button class="share-option" @click="printPoster">
        <g-icon name="printer" :size="16" />
        <span class="option-text">
          <strong>Print / Save as PDF</strong>
          <small>Opens your browser's print dialog</small>
        </span>
      </button>
      <button
        class="share-option"
        data-cy="exportRoadFileButton"
        @click="saveRoadFile"
      >
        <g-icon name="download" :size="16" />
        <span class="option-text">
          <strong>Export .road file</strong>
          <small
            >You (or anyone else on CourseRoad) can import it back in</small
          >
        </span>
      </button>
    </div>
  </g-sheet>
</template>

<script setup lang="ts">
import { computed, watch, ref } from "vue";
import GIcon from "../../design/components/GIcon.vue";
import GSheet from "../../design/components/GSheet.vue";
import { toast } from "../../design/toast";
import { downloadRoadFile } from "../../lib/download";
import {
  buildRoadPoster,
  preparePosterFonts,
  rasterizeToPng,
  savePng as savePngFile,
} from "../../lib/poster";
import { useTouchDevice } from "../../composables/useIsMobile";
import { useCourseDataStore } from "../../stores/courseData";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const store = useCourseDataStore();

const isTouchDevice = useTouchDevice();

const road = computed(() => store.roads[store.activeRoad]);
const roadName = computed(() => road.value?.name ?? "");

const posterSvg = ref("");

watch(
  () => props.modelValue,
  (open) => {
    if (open && road.value) {
      posterSvg.value = buildRoadPoster(road.value, store.catalog, {
        userYear: store.userYear,
        dark: Boolean(store.isDarkMode),
        hideIAP: Boolean(store.hideIAP),
      });
      // Warm the font cache now so Save/Print don't wait on it.
      void preparePosterFonts();
    }
  },
);

/**
 * The preview renders in the right font as part of this document;
 * Save/Print open the SVG outside it, so the fonts must be embedded.
 * Rebuilding after the cache is warm is cheap.
 */
async function exportSvg(): Promise<string> {
  await preparePosterFonts();
  return buildRoadPoster(road.value, store.catalog, {
    userYear: store.userYear,
    dark: Boolean(store.isDarkMode),
    hideIAP: Boolean(store.hideIAP),
  });
}

async function savePng() {
  try {
    const png = await rasterizeToPng(await exportSvg(), 2);
    const outcome = await savePngFile(png, `${roadName.value}.png`);
    if (outcome !== "cancelled") {
      toast.ok(outcome === "shared" ? "Image ready to share" : "Image saved");
    }
  } catch {
    toast.danger("The image didn't render", "Try Print / Save as PDF instead.");
  }
}

async function printPoster() {
  const win = window.open("", "_blank");
  if (win === null) {
    toast.warn(
      "Pop-up blocked",
      "Allow pop-ups for this site, then try again.",
    );
    return;
  }
  try {
    const svg = await exportSvg();
    // The road name is assigned via document.title (plain text), never
    // interpolated into markup, so a hostile name cannot inject script
    // into this same-origin window. posterSvg escapes every text node.
    win.document.write(
      `<!doctype html><html><head>` +
        `<style>@page { margin: 12mm; } body { margin: 0; } svg { width: 100%; height: auto; }</style>` +
        `</head><body>${svg}</body></html>`,
    );
    win.document.close();
    win.document.title = roadName.value;
    // Give the SVG fonts a beat to lay out, then print.
    win.setTimeout(() => win.print(), 350);
  } catch {
    // road.value can go undefined mid-render (the active road switched
    // while this sheet was open); close the blank tab instead of leaving
    // it dangling.
    win.close();
    toast.danger("The poster didn't render", "Try again in a moment.");
  }
}

async function saveRoadFile() {
  if (road.value) {
    const outcome = await downloadRoadFile(
      road.value.name,
      road.value.contents,
    );
    if (outcome !== "cancelled") {
      toast.ok(
        outcome === "shared"
          ? "Road file ready to share"
          : `Exported “${roadName.value}.road”`,
      );
    }
  }
}
</script>

<style scoped>
.share-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--g-line);
}
.share-title {
  font: var(--text-title);
  margin: 0;
}

.share-preview {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  background: var(--g-bg);
  display: flex;
  justify-content: center;
}
.preview-frame {
  max-width: 100%;
  box-shadow: var(--shadow-2);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.preview-frame :deep(svg) {
  display: block;
  max-width: 100%;
  height: auto;
}

.share-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  border-top: 1px solid var(--g-line);
}
.share-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font: var(--text-body);
  color: var(--g-ink);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  cursor: pointer;
  text-align: left;
}
.share-option:hover {
  background: var(--g-surface-2);
}
.option-text {
  display: flex;
  flex-direction: column;
}
.option-text strong {
  font: var(--text-body-strong);
}
.option-text small {
  font: var(--text-small);
  color: var(--g-ink-3);
}
</style>
