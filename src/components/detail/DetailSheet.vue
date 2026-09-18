<template>
  <g-drawer
    :model-value="true"
    label="Class detail"
    @update:model-value="(open) => !open && emit('close')"
  >
    <slot />
  </g-drawer>
</template>

<script setup lang="ts">
/*
 * Mobile holder for ClassDetail: a bottom sheet over the shell. Mounted
 * and unmounted by the parent's v-if, so it is always open while it
 * exists; Escape, a swipe-down, or a scrim tap emit("close") rather than
 * tracking open state here.
 */
import GDrawer from "../../design/components/GDrawer.vue";

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>
