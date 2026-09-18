<template>
  <Icon
    class="g-icon"
    :icon="data"
    :width="size"
    :height="size"
    :aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue/offline";
import type { IconifyIcon } from "@iconify/vue/offline";

import plus from "@iconify-icons/lucide/plus";
import minus from "@iconify-icons/lucide/minus";
import x from "@iconify-icons/lucide/x";
import moreVertical from "@iconify-icons/lucide/more-vertical";
import pencil from "@iconify-icons/lucide/pencil";
import trash2 from "@iconify-icons/lucide/trash-2";
import copy from "@iconify-icons/lucide/copy";
import sun from "@iconify-icons/lucide/sun";
import moon from "@iconify-icons/lucide/moon";
import info from "@iconify-icons/lucide/info";
import alertCircle from "@iconify-icons/lucide/alert-circle";
import download from "@iconify-icons/lucide/download";
import upload from "@iconify-icons/lucide/upload";
import search from "@iconify-icons/lucide/search";
import undo2 from "@iconify-icons/lucide/undo-2";
import redo2 from "@iconify-icons/lucide/redo-2";
import logIn from "@iconify-icons/lucide/log-in";
import logOut from "@iconify-icons/lucide/log-out";
import check from "@iconify-icons/lucide/check";
import cloud from "@iconify-icons/lucide/cloud";
import triangleAlert from "@iconify-icons/lucide/triangle-alert";
import chevronDown from "@iconify-icons/lucide/chevron-down";
import chevronRight from "@iconify-icons/lucide/chevron-right";
import map from "@iconify-icons/lucide/map";
import share2 from "@iconify-icons/lucide/share-2";
import messageSquare from "@iconify-icons/lucide/message-square";
import settings from "@iconify-icons/lucide/settings";
import monitor from "@iconify-icons/lucide/monitor";
import panelLeft from "@iconify-icons/lucide/panel-left";
import panelRight from "@iconify-icons/lucide/panel-right";
import externalLink from "@iconify-icons/lucide/external-link";
import star from "@iconify-icons/lucide/star";
import arrowLeft from "@iconify-icons/lucide/arrow-left";
import arrowLeftRight from "@iconify-icons/lucide/arrow-left-right";
import cloudDownload from "@iconify-icons/lucide/cloud-download";
import cloudSync from "@iconify-icons/lucide/cloud-sync";
import loader from "@iconify-icons/lucide/loader";
import cloudAlert from "@iconify-icons/lucide/cloud-alert";
import saveOff from "@iconify-icons/lucide/save-off";
import save from "@iconify-icons/lucide/save";
import cloudCheck from "@iconify-icons/lucide/cloud-check";
import messageSquareShare from "@iconify-icons/lucide/message-square-share";
import imageDown from "@iconify-icons/lucide/image-down";
import printer from "@iconify-icons/lucide/printer";

/**
 * The shell's icon set: Lucide via @iconify/vue's offline renderer and
 * @iconify-icons/lucide's per-icon exports, so each import pulls in one
 * icon's data. Names are the app's own semantic labels.
 */
const NAME_TO_LUCIDE = {
  plus,
  minus,
  close: x,
  dots: moreVertical,
  pencil,
  trash: trash2,
  copy,
  sun,
  moon,
  info,
  notice: alertCircle,
  download,
  upload,
  search,
  undo: undo2,
  redo: redo2,
  login: logIn,
  logout: logOut,
  check,
  cloud,
  warn: triangleAlert,
  chevronDown,
  chevronRight,
  map,
  graph: share2,
  message: messageSquare,
  settings,
  monitor,
  panelLeft,
  panelRight,
  external: externalLink,
  star,
  back: arrowLeft,
  swap: arrowLeftRight,
  cloudDownload,
  cloudSync,
  loader,
  cloudAlert,
  saveOff,
  save,
  cloudCheck,
  shareMessage: messageSquareShare,
  imageDown,
  printer,
} as const satisfies Record<string, IconifyIcon>;

export type IconName = keyof typeof NAME_TO_LUCIDE;

const props = withDefaults(
  defineProps<{
    name: IconName;
    size?: number;
  }>(),
  { size: 16 },
);

const data = computed(() => NAME_TO_LUCIDE[props.name]);
</script>

<style scoped>
.g-icon {
  flex-shrink: 0;
  display: block;
}
</style>
