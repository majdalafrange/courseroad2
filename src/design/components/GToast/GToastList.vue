<template>
  <ToastRoot
    v-for="t in toasts"
    :key="t.id"
    :toast="t"
    class="g-toast"
    :class="t.data?.variant"
  >
    <g-icon
      v-if="t.data && TONE_ICON[t.data.variant]"
      :name="TONE_ICON[t.data.variant]!"
      :size="15"
      class="g-toast-icon"
    />
    <div class="g-toast-body">
      <ToastTitle as="span" class="g-toast-message" />
      <ToastDescription as="span" class="g-toast-detail" />
    </div>
    <ToastAction class="g-toast-action" />
    <ToastClose class="g-toast-dismiss" aria-label="Dismiss">
      <g-icon name="close" :size="10" />
    </ToastClose>
  </ToastRoot>
</template>

<script setup lang="ts">
/* useToastManager reads the nearest ToastProvider, so the list is its own
   component inside GToastHost's provider. Styles live in GToastHost. */
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRoot,
  ToastTitle,
  useToastManager,
} from "reka-ui";
import GIcon from "../GIcon.vue";
import type { ToastData } from "../../toast.ts";

const { toasts } = useToastManager<ToastData>();

/* The tone in shape as well as color; a neutral toast has none. */
const TONE_ICON: Partial<Record<ToastData["variant"], string>> = {
  ok: "check",
  warn: "warn",
  danger: "notice",
};
</script>
