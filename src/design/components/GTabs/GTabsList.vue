<template>
  <TabsList class="g-tabs-list">
    <slot />
  </TabsList>
</template>

<script setup lang="ts">
/** The tab strip. A single real element, so aria-label and any other
 *  attrs a caller passes fall through to it normally. */
import { TabsList } from "reka-ui";
</script>
