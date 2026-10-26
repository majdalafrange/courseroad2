<template>
  <CollapsibleContent>
    <slot />
  </CollapsibleContent>
</template>

<script setup lang="ts">
/** What a BaseCollapsibleRoot shows and hides; mounted only while open. */
import { CollapsibleContent } from "reka-ui";
</script>
