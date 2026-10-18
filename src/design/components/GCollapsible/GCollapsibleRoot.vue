<template>
  <CollapsibleRoot v-model:open="open" :as="as">
    <slot :open="open" />
  </CollapsibleRoot>
</template>

<script setup lang="ts">
/** A disclosure (Reka's Collapsible); the content unmounts while closed. */
import { CollapsibleRoot } from "reka-ui";

const { as = "div" } = defineProps<{
  /** The root element, e.g. "section" for a section that collapses. */
  as?: string;
}>();

const open = defineModel<boolean>("open", { required: true });
</script>
