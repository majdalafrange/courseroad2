<template>
  <DialogDescription :as="as">
    <slot />
  </DialogDescription>
</template>

<script setup lang="ts">
/**
 * The description of a BaseInlineDialog. Set the dialog's `describedBy`
 * while this is rendered.
 */
import { DialogDescription } from "reka-ui";

const { as = "p" } = defineProps<{
  as?: string;
}>();
</script>
