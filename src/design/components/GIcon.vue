<template>
  <svg
    class="g-icon"
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

/**
 * The shell's hand-drawn 16px stroke icon set. Deliberately small: if an
 * icon isn't here, ask whether the surface really needs one.
 */
const ICONS: Record<string, string[]> = {
  plus: ["M8 3.5 V12.5", "M3.5 8 H12.5"],
  close: ["M4 4 L12 12", "M12 4 L4 12"],
  dots: [
    "M8 3.5 a0.1 0.1 0 1 0 0.001 0",
    "M8 8 a0.1 0.1 0 1 0 0.001 0",
    "M8 12.5 a0.1 0.1 0 1 0 0.001 0",
  ],
  pencil: ["M3 13 L3.6 10.6 L11 3.2 a1.2 1.2 0 0 1 1.8 1.8 L5.4 12.4 L3 13Z"],
  trash: [
    "M3.5 5 H12.5",
    "M6.5 5 V3.5 H9.5 V5",
    "M4.5 5 L5 13 H11 L11.5 5",
    "M6.7 7.5 V10.7",
    "M9.3 7.5 V10.7",
  ],
  copy: ["M6 6 H12.5 V13 H6 Z", "M4 10.5 H3.5 V3.5 H10.5 V4"],
  sun: [
    "M8 5.2 a2.8 2.8 0 1 0 0.001 0",
    "M8 1.8 V3",
    "M8 13 V14.2",
    "M1.8 8 H3",
    "M13 8 H14.2",
    "M3.6 3.6 L4.5 4.5",
    "M11.5 11.5 L12.4 12.4",
    "M3.6 12.4 L4.5 11.5",
    "M11.5 4.5 L12.4 3.6",
  ],
  moon: ["M13 9.5 A5.5 5.5 0 1 1 6.5 3 A4.5 4.5 0 0 0 13 9.5 Z"],
  info: [
    "M8 4.3 a0.2 0.2 0 1 0 0.001 0",
    "M8 7.2 V11.2",
    "M8 14.2 a6.2 6.2 0 1 1 0.001 0",
  ],
  notice: [
    "M8 4.5 V9",
    "M8 11.3 a0.1 0.1 0 1 0 0.001 0",
    "M8 14.2 a6.2 6.2 0 1 1 0.001 0",
  ],
  download: ["M8 2.5 V10", "M5 7.5 L8 10.5 L11 7.5", "M3 13 H13"],
  upload: ["M8 10.5 V3", "M5 5.5 L8 2.5 L11 5.5", "M3 13 H13"],
  search: ["M7 2.5 a4.5 4.5 0 1 0 0.001 0", "M10.3 10.3 L14 14"],
  undo: ["M3 6.5 H10 a3.5 3.5 0 0 1 0 7 H6", "M5.5 4 L3 6.5 L5.5 9"],
  redo: ["M13 6.5 H6 a3.5 3.5 0 0 0 0 7 H10", "M10.5 4 L13 6.5 L10.5 9"],
  login: [
    "M6.5 8 H14",
    "M11.5 5.5 L14 8 L11.5 10.5",
    "M9.5 2.5 H3.5 V13.5 H9.5",
  ],
  logout: ["M9.5 8 H2", "M4.5 5.5 L2 8 L4.5 10.5", "M6.5 2.5 H12.5 V13.5 H6.5"],
  check: ["M3 8.5 L6.5 12 L13 4.5"],
  cloud: [
    "M5 12.5 a3 3 0 1 1 0.4 -5.97 A3.8 3.8 0 0 1 12.7 7.6 A2.6 2.6 0 0 1 12 12.5 Z",
  ],
  warn: [
    "M8 2.5 L14.5 13.5 H1.5 Z",
    "M8 6.5 V9.5",
    "M8 11.5 a0.1 0.1 0 1 0 0.001 0",
  ],
  chevronDown: ["M4 6 L8 10 L12 6"],
  chevronRight: ["M6 4 L10 8 L6 12"],
  map: [
    "M2.5 4 L6 2.5 L10 4.5 L13.5 3 V12 L10 13.5 L6 11.5 L2.5 13 Z",
    "M6 2.5 V11.5",
    "M10 4.5 V13.5",
  ],
  graph: [
    "M2.7 5 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0",
    "M10.7 4 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0",
    "M7.7 12 a1.3 1.3 0 1 0 2.6 0 a1.3 1.3 0 1 0 -2.6 0",
    "M5.3 4.8 L10.7 4.2",
    "M4.6 6.2 L8.4 10.8",
    "M11.4 5.2 L9.7 10.8",
  ],
  message: ["M2.5 3.5 H13.5 V10.5 H7.5 L4.5 13 V10.5 H2.5 Z"],
  settings: [
    "M8 3.7 a4.3 4.3 0 1 0 0.001 0",
    "M8 6.4 a1.6 1.6 0 1 0 0.001 0",
    "M8 3.7 V2.1",
    "M8 12.3 V13.9",
    "M3.7 8 H2.1",
    "M12.3 8 H13.9",
    "M5 5 L3.8 3.8",
    "M11 11 L12.2 12.2",
    "M5 11 L3.8 12.2",
    "M11 5 L12.2 3.8",
  ],
  monitor: ["M2.5 3.5 H13.5 V10.5 H2.5 Z", "M8 10.5 V12.8", "M5.3 13.5 H10.7"],
  panelLeft: ["M2.5 3.5 H13.5 V12.5 H2.5 Z", "M6.5 3.5 V12.5"],
  panelRight: ["M2.5 3.5 H13.5 V12.5 H2.5 Z", "M9.5 3.5 V12.5"],
};

const props = withDefaults(
  defineProps<{
    name: keyof typeof ICONS | string;
    size?: number;
  }>(),
  { size: 16 },
);

const paths = computed(() => ICONS[props.name] ?? []);
</script>

<style scoped>
.g-icon {
  flex-shrink: 0;
  display: block;
}
</style>
