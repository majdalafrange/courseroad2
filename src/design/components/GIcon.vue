<template>
  <Icon
    class="g-icon"
    :icon="data"
    :width="size"
    :height="size"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue/offline";
import { LUCIDE_ICONS } from "../lucideIcons";

/**
 * The shell's icon set: Lucide, via @iconify/vue's offline renderer (no
 * network calls; LUCIDE_ICONS is a generated, trimmed-down copy of just
 * the icons this app uses, see scripts/generate-lucide-icons.mjs). Names
 * here are the app's own semantic labels, mapped to their Lucide icon.
 */
const NAME_TO_LUCIDE: Record<string, string> = {
  plus: "plus",
  close: "x",
  dots: "more-vertical",
  pencil: "pencil",
  trash: "trash-2",
  copy: "copy",
  sun: "sun",
  moon: "moon",
  info: "info",
  notice: "alert-circle",
  download: "download",
  upload: "upload",
  search: "search",
  undo: "undo-2",
  redo: "redo-2",
  login: "log-in",
  logout: "log-out",
  check: "check",
  cloud: "cloud",
  warn: "triangle-alert",
  chevronDown: "chevron-down",
  chevronRight: "chevron-right",
  map: "map",
  graph: "share-2",
  message: "message-square",
  settings: "settings",
  monitor: "monitor",
  panelLeft: "panel-left",
  panelRight: "panel-right",
  external: "external-link",
  star: "star",
  back: "arrow-left",
  swap: "arrow-left-right",
};

const props = withDefaults(
  defineProps<{
    name: keyof typeof NAME_TO_LUCIDE | string;
    size?: number;
  }>(),
  { size: 16 },
);

const data = computed(() => LUCIDE_ICONS[NAME_TO_LUCIDE[props.name] ?? ""]);
</script>

<style scoped>
.g-icon {
  flex-shrink: 0;
  display: block;
}
</style>
