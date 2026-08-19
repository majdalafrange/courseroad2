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
 * Mobile holder for ClassDetail: a bottom sheet over the whole shell.
 * This is mounted (and unmounted) by the parent's v-if, so it's always
 * open while it exists; closing is the parent removing it, which is why
 * model-value is a bare `true` here instead of a prop, and why Escape,
 * a swipe-down, or a scrim tap just ask the parent to do that via
 * emit("close") rather than tracking any open state of its own.
 */
import GDrawer from "../../design/components/GDrawer.vue";

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>
