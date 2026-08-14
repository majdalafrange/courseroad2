<template>
  <g-sheet
    :model-value="modelValue"
    label="Share road"
    width="640px"
    :close-button="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <header class="share-head">
      <h2 class="share-title">Share “{{ roadName }}”</h2>
      <button class="share-close" aria-label="Close" @click="close">
        <g-icon name="close" :size="16" />
      </button>
    </header>

    <div class="share-preview">
      <!-- posterSvg is built by buildRoadPoster from catalog data with
                 every text value escaped (lib/poster.ts esc()); no raw user
                 input reaches the markup. -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="preview-frame" v-html="posterSvg" />
    </div>

    <div class="share-options">
      <button class="share-option" @click="savePng">
        <g-icon name="download" :size="16" />
        <span class="option-text">
          <strong>Save as image</strong>
          <small>PNG image of the full road</small>
        </span>
      </button>
      <button class="share-option" @click="printPoster">
        <g-icon name="info" :size="16" />
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
        <g-icon name="upload" :size="16" />
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
import { useIsMobile } from "../../composables/useIsMobile";
import { downloadRoadFile } from "../../lib/download";
import {
  buildRoadPoster,
  preparePosterFonts,
  rasterizeToPng,
  savePng as savePngFile,
} from "../../lib/poster";
import { useCourseDataStore } from "../../stores/courseData";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const store = useCourseDataStore();

const road = computed(() => store.roads[store.activeRoad]);
const roadName = computed(() => road.value?.name ?? "");
const isMobile = useIsMobile();

const posterSvg = ref("");

watch(
  () => props.modelValue,
  (open) => {
    if (open && road.value) {
      posterSvg.value = buildRoadPoster(road.value, store.catalog, {
        userYear: store.userYear,
        dark: Boolean(store.isDarkMode),
      });
      // Warm the embedded-font cache now (usually instant: same files
      // main.ts already loaded) so Save/Print don't wait on it later.
      void preparePosterFonts();
    }
  },
);

/**
 * The live preview (posterSvg, injected via v-html) already renders in
 * the right font since it's part of this document. Save/Print open
 * the SVG *outside* this document, so they need the fonts embedded in
 * it; rebuilding here (after the cache is warm) is cheap and guarantees
 * whichever path runs first still gets the embed.
 */
async function exportSvg(): Promise<string> {
  await preparePosterFonts();
  return buildRoadPoster(road.value, store.catalog, {
    userYear: store.userYear,
    dark: Boolean(store.isDarkMode),
  });
}

async function savePng() {
  try {
    const png = await rasterizeToPng(await exportSvg(), 2);
    const outcome = await savePngFile(
      png,
      `${roadName.value}.png`,
      isMobile.value,
    );
    if (outcome !== "cancelled") {
      toast.ok(
        outcome === "shared"
          ? "Your image is ready to save."
          : "Your image is saved!",
      );
    }
  } catch {
    toast.danger("We couldn't render the image", "Try the PDF option instead.");
  }
}

async function printPoster() {
  const win = window.open("", "_blank");
  if (win === null) {
    toast.warn("Pop-up blocked", "Allow pop-ups and we'll get this printing.");
    return;
  }
  const svg = await exportSvg();
  // The road name is NOT interpolated into markup: it is assigned via
  // document.title (plain text, never HTML-parsed) so a hostile road name
  // like `</title><img src=x onerror=…>` cannot inject script into this
  // same-origin window. posterSvg is safe by construction (poster.ts esc()s
  // every text node; colors are dictionary lookups).
  win.document.write(
    `<!doctype html><html><head>` +
      `<style>@page { margin: 12mm; } body { margin: 0; } svg { width: 100%; height: auto; }</style>` +
      `</head><body>${svg}</body></html>`,
  );
  win.document.close();
  win.document.title = roadName.value;
  // Give the SVG fonts a beat to lay out, then print.
  win.setTimeout(() => win.print(), 350);
}

function saveRoadFile() {
  if (road.value) {
    downloadRoadFile(road.value.name, road.value.contents);
    toast.ok(`Your road is exported as “${roadName.value}.road”`);
  }
}

function close() {
  emit("update:modelValue", false);
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
.share-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--g-ink-3);
  cursor: pointer;
}
.share-close:hover {
  background: var(--g-surface-sunken);
  color: var(--g-ink);
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
