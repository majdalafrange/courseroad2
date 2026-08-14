<template>
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {{ liveMessage }}
  </div>
</template>

<script setup lang="ts">
import { liveMessage } from "../announce";
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
