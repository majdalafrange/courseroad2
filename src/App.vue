<template>
  <div id="app-wrapper">
    <router-view />
    <g-toast-host />
    <g-live-region />
  </div>
</template>

<script setup lang="ts">
import GToastHost from "./design/components/GToastHost.vue";
import GLiveRegion from "./design/components/GLiveRegion.vue";
</script>
