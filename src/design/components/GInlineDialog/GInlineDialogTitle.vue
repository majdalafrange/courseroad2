<template>
  <DialogTitle :as="as">
    <slot />
  </DialogTitle>
</template>

<script setup lang="ts">
/** The accessible name of a GInlineDialog (required). */
import { DialogTitle } from "reka-ui";

const { as = "h2" } = defineProps<{
  as?: string;
}>();
</script>
