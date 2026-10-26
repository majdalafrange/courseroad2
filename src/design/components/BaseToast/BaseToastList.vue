<template>
  <ToastRoot
    v-for="t in toasts"
    :key="t.id"
    :toast="t"
    class="base-toast"
    :class="t.data?.variant"
  >
    <BaseIcon
      v-if="t.data && TONE_ICON[t.data.variant]"
      :name="TONE_ICON[t.data.variant]!"
      :size="15"
      class="base-toast-icon"
    />
    <div class="base-toast-body">
      <ToastTitle as="span" class="base-toast-message" />
      <ToastDescription as="span" class="base-toast-detail" />
    </div>
    <ToastAction class="base-toast-action" />
    <ToastClose class="base-toast-dismiss" aria-label="Dismiss">
      <BaseIcon name="close" :size="10" />
    </ToastClose>
  </ToastRoot>
</template>

<script setup lang="ts">
/* useToastManager reads the nearest ToastProvider, so the list is its own
   component inside BaseToastHost's provider. Styles live in BaseToastHost. */
import {
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRoot,
  ToastTitle,
  useToastManager,
} from "reka-ui";
import BaseIcon from "../BaseIcon.vue";
import type { ToastData } from "../../toast.ts";

const { toasts } = useToastManager<ToastData>();

/* The tone in shape as well as color; a neutral toast has none. */
const TONE_ICON: Partial<Record<ToastData["variant"], string>> = {
  ok: "check",
  warn: "warn",
  danger: "notice",
};
</script>
