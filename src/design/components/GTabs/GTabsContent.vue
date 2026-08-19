<template>
  <TabsContent class="g-tabs-content" :value="value">
    <slot />
  </TabsContent>
</template>

<script setup lang="ts" generic="T extends string | number">
import { TabsContent } from "reka-ui";

defineProps<{
  value: T;
}>();
</script>
