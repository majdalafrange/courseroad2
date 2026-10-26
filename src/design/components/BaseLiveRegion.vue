<template>
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
    {{ liveMessage }}
  </div>
</template>

<script setup lang="ts">
import { liveMessage } from "../announce";
</script>
