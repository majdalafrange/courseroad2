<template>
  <TabsTrigger class="g-tabs-trigger" :value="value" :disabled="disabled">
    <slot />
  </TabsTrigger>
</template>

<script setup lang="ts" generic="T extends string | number">
import { TabsTrigger } from "reka-ui";

withDefaults(
  defineProps<{
    value: T;
    disabled?: boolean;
  }>(),
  { disabled: false },
);
</script>
