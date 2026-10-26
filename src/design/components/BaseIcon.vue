<template>
  <!-- The external-link mark only ever sits in a link that opens a new
       tab, so it says so for a screen reader too. One root either way, so
       as-child callers (Reka slots) still get a single element. -->
  <span v-if="name === 'external'" class="base-icon-external" v-bind="$attrs">
    <Icon
      class="base-icon"
      :icon="data"
      :width="size"
      :height="size"
      :aria-hidden="true"
    />
    <span class="sr-only">(opens in a new tab)</span>
  </span>
  <Icon
    v-else
    class="base-icon"
    :icon="data"
    :width="size"
    :height="size"
    :aria-hidden="true"
    v-bind="$attrs"
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
import importIcon from "@iconify-icons/lucide/import";
import file from "@iconify-icons/lucide/file";
import share from "@iconify-icons/lucide/share";
import search from "@iconify-icons/lucide/search";
import undo2 from "@iconify-icons/lucide/undo-2";
import redo2 from "@iconify-icons/lucide/redo-2";
import logIn from "@iconify-icons/lucide/log-in";
import logOut from "@iconify-icons/lucide/log-out";
import check from "@iconify-icons/lucide/check";
import triangleAlert from "@iconify-icons/lucide/triangle-alert";
import chevronDown from "@iconify-icons/lucide/chevron-down";
import chevronRight from "@iconify-icons/lucide/chevron-right";
import chevronUp from "@iconify-icons/lucide/chevron-up";
import workflow from "@iconify-icons/lucide/workflow";
import messageSquare from "@iconify-icons/lucide/message-square";
import settings from "@iconify-icons/lucide/settings";
import monitor from "@iconify-icons/lucide/monitor";
import panelLeft from "@iconify-icons/lucide/panel-left";
import panelRight from "@iconify-icons/lucide/panel-right";
import externalLink from "@iconify-icons/lucide/external-link";
import star from "@iconify-icons/lucide/star";
import arrowLeft from "@iconify-icons/lucide/arrow-left";
import arrowRight from "@iconify-icons/lucide/arrow-right";
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
import pin from "@iconify-icons/lucide/pin";
import columns3 from "@iconify-icons/lucide/columns-3";
import rows3 from "@iconify-icons/lucide/rows-3";
import mousePointer2 from "@iconify-icons/lucide/mouse-pointer-2";
import eyeOff from "@iconify-icons/lucide/eye-off";
import calendar from "@iconify-icons/lucide/calendar";
import scan from "@iconify-icons/lucide/scan";
import chartGantt from "@iconify-icons/lucide/chart-gantt";
import columns2 from "@iconify-icons/lucide/columns-2";
import listChecks from "@iconify-icons/lucide/list-checks";
import chartNoAxesColumnIncreasing from "@iconify-icons/lucide/chart-no-axes-column-increasing";
import cloudOff from "@iconify-icons/lucide/cloud-off";

/**
 * Lucide, one import per icon so only used icons ship. Keys are the app's
 * semantic names; one Lucide icon can back several of them.
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
  import: importIcon,
  file,
  share,
  search,
  undo: undo2,
  redo: redo2,
  login: logIn,
  logout: logOut,
  check,
  warn: triangleAlert,
  chevronDown,
  chevronRight,
  chevronUp,
  graph: workflow,
  message: messageSquare,
  settings,
  monitor,
  panelLeft,
  panelRight,
  external: externalLink,
  star,
  back: arrowLeft,
  forward: arrowRight,
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
  pin,
  columns: columns3,
  rows: rows3,
  pointer: mousePointer2,
  eyeOff,
  calendar,
  fitView: scan,
  plan: chartGantt,
  compare: columns2,
  progress: listChecks,
  match: chartNoAxesColumnIncreasing,
  offline: cloudOff,
} as const satisfies Record<string, IconifyIcon>;

export type IconName = keyof typeof NAME_TO_LUCIDE;

// The external mark wraps its icon, so attrs (a class, a style) are bound
// to whichever root renders, by hand.
defineOptions({ inheritAttrs: false });

const { name, size = 16 } = defineProps<{
  name: IconName;
  size?: number;
}>();

const data = computed(() => NAME_TO_LUCIDE[name]);
</script>

<style scoped>
.base-icon {
  flex-shrink: 0;
  display: block;
}
/* The external mark sits inline in link text, as the bare icon did. */
.base-icon-external {
  display: inline-flex;
  flex-shrink: 0;
}
</style>
