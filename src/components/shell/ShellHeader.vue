<template>
  <header class="shell-header">
    <!-- The page's one h1, for screen readers: the visible identity is the
         wordmark and the road switcher. Inside the banner landmark, so
         nothing on the page sits outside one. -->
    <h1 class="sr-only">{{ pageHeading }}</h1>
    <div class="header-left">
      <RouterLink to="/road" class="header-brand" aria-label="CourseRoad home">
        <BaseWordmark size="sm" />
      </RouterLink>
      <span class="header-sep" aria-hidden="true" />
      <RoadSwitcher
        @create-road="emit('create-road')"
        @switch-road="emit('switch-road', $event)"
        @duplicate-road="emit('duplicate-road', $event)"
        @delete-road="emit('delete-road', $event)"
        @open-import="emit('open-import')"
        @open-compare="emit('open-compare')"
        @open-share="emit('open-share')"
      />
      <span
        class="header-meta"
        :class="{ 'is-warn': saveState.tone === 'warn' }"
      >
        <span v-if="totalUnits > 0" class="header-units"
          >{{ totalUnits }} units</span
        >
        <span v-if="totalUnits > 0" class="meta-dot sep" aria-hidden="true"
          >·</span
        >
        <BaseTooltip
          :text="saveState.detail"
          placement="bottom"
          :delay="200"
          tap
        >
          <!-- Focusable so its tooltip (the detail) is reachable by
               keyboard, not only by hover. -->
          <span class="save-state" :class="saveState.tone" tabindex="0">
            <BaseIcon class="save-icon" :name="saveState.icon" :size="12" />
            <span class="save-label">{{ saveState.label }}</span>
          </span>
        </BaseTooltip>
      </span>
    </div>

    <div class="header-right">
      <BaseTooltip
        :text="
          history.canUndo ? `Undo: ${history.undoLabel}` : 'Nothing to undo'
        "
      >
        <BaseButton
          variant="ghost"
          size="sm"
          icon-only
          class="header-icon-btn"
          :disabled="!history.canUndo"
          aria-label="Undo"
          @click="emit('undo')"
        >
          <BaseIcon name="undo" :size="15" />
        </BaseButton>
      </BaseTooltip>
      <BaseTooltip
        :text="
          history.canRedo ? `Redo: ${history.redoLabel}` : 'Nothing to redo'
        "
      >
        <BaseButton
          variant="ghost"
          size="sm"
          icon-only
          class="header-icon-btn"
          :disabled="!history.canRedo"
          aria-label="Redo"
          @click="emit('redo')"
        >
          <BaseIcon name="redo" :size="15" />
        </BaseButton>
      </BaseTooltip>

      <BaseButton
        v-if="!isExplore"
        id="searchInputTF"
        variant="field"
        class="search-trigger"
        data-cy="classSearchInput"
        aria-label="Add classes"
        :aria-keyshortcuts="isMac() ? 'Meta+K' : 'Control+K'"
        @click.stop="emit('open-search')"
      >
        <BaseIcon name="search" :size="14" />
        <span class="search-trigger-text">Add classes</span>
        <BaseKbd
          class="search-trigger-kbd"
          :keys="paletteKeys.keys"
          :joiner="paletteKeys.joiner"
        />
      </BaseButton>

      <nav class="mode-switch" aria-label="Mode">
        <button
          class="mode-btn"
          :class="{ active: !isExplore }"
          :aria-current="!isExplore ? 'page' : undefined"
          @click="emit('navigate-mode', 'plan')"
        >
          Plan
        </button>
        <button
          class="mode-btn"
          :class="{ active: isExplore }"
          :aria-current="isExplore ? 'page' : undefined"
          data-cy="exploreButton"
          @click="emit('navigate-mode', 'explore')"
        >
          Explore
        </button>
      </nav>

      <BaseTooltip
        v-if="auth.loggedIn"
        class="header-feedback"
        text="Send feedback"
      >
        <BaseButton
          variant="ghost"
          size="sm"
          icon-only
          class="header-icon-btn"
          :href="feedbackFormUrl"
          external
          aria-label="Send feedback (opens in a new tab)"
          data-cy="feedbackButton"
        >
          <BaseIcon name="message" :size="15" />
        </BaseButton>
      </BaseTooltip>

      <BaseButton
        v-if="!auth.loggedIn"
        variant="ghost"
        size="sm"
        class="header-login"
        data-cy="loginButton"
        @click="auth.loginUser()"
      >
        Log in
      </BaseButton>

      <BaseTooltip class="header-settings" text="Settings">
        <BaseButton
          variant="ghost"
          size="sm"
          icon-only
          class="header-icon-btn"
          aria-label="Settings"
          data-cy="settingsButton"
          @click="emit('open-settings')"
        >
          <BaseIcon name="settings" :size="15" />
        </BaseButton>
      </BaseTooltip>

      <BaseMenu v-model="moreOpen" align="end">
        <template #trigger>
          <BaseButton
            variant="ghost"
            size="sm"
            icon-only
            class="header-icon-btn"
            aria-label="More"
          >
            <BaseIcon name="dots" :size="16" />
          </BaseButton>
        </template>
        <div class="more-menu">
          <BaseMenuItem @select="emit('open-about')">
            <BaseIcon name="info" :size="14" /> About CourseRoad
          </BaseMenuItem>
          <BaseMenuItem class="mobile-only" @select="emit('open-settings')">
            <BaseIcon name="settings" :size="14" /> Settings
          </BaseMenuItem>
          <BaseMenuItem v-if="auth.loggedIn" as-child>
            <a
              class="mobile-only"
              :href="feedbackFormUrl"
              target="_blank"
              rel="noopener"
            >
              <BaseIcon name="message" :size="14" /> Send feedback
              <span class="sr-only">(opens in a new tab)</span>
            </a>
          </BaseMenuItem>
          <BaseMenuSeparator v-if="auth.loggedIn" />
          <BaseMenuItem
            v-if="auth.loggedIn"
            data-cy="logoutButton"
            @select="auth.logoutUser()"
          >
            <BaseIcon name="logout" :size="14" /> Log out
          </BaseMenuItem>
          <BaseMenuItem v-else class="mobile-only" @select="auth.loginUser()">
            <BaseIcon name="login" :size="14" /> Log in
          </BaseMenuItem>
        </div>
      </BaseMenu>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import BaseButton from "../../design/components/BaseButton.vue";
import BaseIcon, { type IconName } from "../../design/components/BaseIcon.vue";
import BaseKbd from "../../design/components/BaseKbd.vue";
import {
  BaseMenu,
  BaseMenuItem,
  BaseMenuSeparator,
} from "../../design/components/BaseMenu";
import BaseTooltip from "../../design/components/BaseTooltip.vue";
import BaseWordmark from "../../design/components/BaseWordmark.vue";
import RoadSwitcher from "./RoadSwitcher.vue";
import { semesterInformation } from "../../lib/hours";
import { isMac, shortcutKeys } from "../../lib/platform";
import { history } from "../../stores/history";
import { useAuthStore } from "../../stores/auth";
import { useCourseDataStore } from "../../stores/courseData";

defineProps<{
  /** "Plan: <road name>" or "Explore: <road name>". */
  pageHeading: string;
}>();

const emit = defineEmits<{
  (e: "open-search"): void;
  (e: "undo"): void;
  (e: "redo"): void;
  (e: "create-road"): void;
  (e: "switch-road", roadID: string): void;
  (e: "duplicate-road", roadID: string): void;
  (e: "delete-road", roadID: string): void;
  (e: "open-import"): void;
  (e: "open-compare"): void;
  (e: "open-share"): void;
  (e: "open-about"): void;
  (e: "open-settings"): void;
  (e: "navigate-mode", mode: "plan" | "explore"): void;
}>();

const store = useCourseDataStore();
const auth = useAuthStore();
const route = useRoute();

const isExplore = computed(() => route.name === "/explore/[[road]]");
const moreOpen = ref(false);

const feedbackFormUrl = "https://forms.gle/VAY3E7RbjmUrw3ww5";

const paletteKeys = shortcutKeys("K");

const totalUnits = computed(() => {
  const road = store.roads[store.activeRoad];
  if (road === undefined) {
    return 0;
  }
  return road.contents.selectedSubjects.reduce(
    (sum, bucket) =>
      sum + semesterInformation(bucket, store.catalog).totalUnits,
    0,
  );
});

/* ---- save state: icon + one line; detail in the tooltip ---- */
interface SaveState {
  label: string;
  icon: IconName;
  detail: string;
  tone: "ok" | "busy" | "warn" | "muted";
}

const saveState = computed<SaveState>(() => {
  if (auth.gettingUserData) {
    return {
      label: "Loading...",
      icon: "cloudDownload",
      detail: "Loading your roads from FireRoad.",
      tone: "busy",
    };
  }
  if (auth.currentlySaving) {
    return {
      label: "Saving...",
      icon: auth.loggedIn ? "cloudSync" : "loader",
      detail: auth.loggedIn
        ? "Syncing your changes to FireRoad."
        : "Saving your changes in this browser.",
      tone: "busy",
    };
  }
  if (auth.saveWarnings.length > 0) {
    return {
      label: `${auth.saveWarnings.length} save issue${auth.saveWarnings.length > 1 ? "s" : ""}`,
      icon: "cloudAlert",
      detail: auth.saveWarnings.map((w) => `${w.name}: ${w.error}`).join("; "),
      tone: "warn",
    };
  }
  if (!auth.loggedIn) {
    if (store.cookiesAllowed === false) {
      return {
        label: "Not saved",
        icon: "saveOff",
        detail: "Cookies are off. Changes last only as long as this tab.",
        tone: "warn",
      };
    }
    return {
      label: "Saved in this browser",
      icon: "save",
      detail: "Log in to sync roads across devices.",
      tone: "muted",
    };
  }
  return {
    label: "Saved",
    icon: "cloudCheck",
    detail: "All changes saved to FireRoad.",
    tone: "ok",
  };
});
</script>

<style scoped>
.shell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0 var(--space-5);
  border-bottom: 1px solid var(--base-line);
  background: var(--base-bg);
  min-height: 52px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.header-brand {
  text-decoration: none;
  display: inline-flex;
  flex-shrink: 0;
  border-radius: var(--radius-xs);
}
.header-brand:focus-visible {
  outline: none;
  box-shadow: var(--base-focus-ring);
}
.header-sep {
  width: 1px;
  height: 20px;
  background: var(--base-line-strong);
  flex-shrink: 0;
}

.header-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--base-ink-3);
  white-space: nowrap;
}
.header-units {
  /* tabular digits keep the figure from shifting while it ticks */
  font-variant-numeric: tabular-nums;
}
.meta-dot {
  color: var(--base-line-strong);
}
.save-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: default;
  border-radius: var(--radius-xs);
}
.save-state:focus-visible {
  outline: none;
  box-shadow: var(--base-focus-ring);
}
.save-state.ok .save-icon {
  color: var(--base-ok);
}
.save-state.warn .save-icon,
.save-state.warn .save-label {
  color: var(--base-warn);
}
.save-state.busy .save-icon {
  color: var(--base-info);
  animation: pulse 1.2s var(--ease-in-out) infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .save-state.busy .save-icon {
    animation: none;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* BaseButton's "field": it reads as the search box it opens, placeholder
   ink included. Parent-prefixed to outrank BaseButton's own rules. */
.header-right .search-trigger {
  width: 260px;
  color: var(--base-ink-3);
}
.header-right .search-trigger:hover {
  color: var(--base-ink-2);
}
.search-trigger-text {
  flex: 1;
  text-align: left;
}
/* Plan/Explore is a mode, so it reads as a segmented control. */
.mode-switch {
  display: inline-flex;
  align-items: center;
  gap: var(--space-05);
  background: var(--base-surface-sunken);
  border-radius: var(--radius-sm);
  padding: var(--space-05);
}
.mode-btn {
  font: var(--text-small);
  font-weight: 500;
  color: var(--base-ink-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  height: 24px; /* track = 24 + 2+2 pad = 28, the compact-control tier */
  padding: 0 var(--space-3);
  cursor: pointer;
  transition:
    background-color var(--motion-quick) var(--ease-out),
    color var(--motion-quick) var(--ease-out),
    box-shadow var(--motion-quick) var(--ease-out);
}
.mode-btn:hover {
  color: var(--base-ink);
}
/* the thumb is a control: ringed, no shadow */
.mode-btn.active {
  background: var(--base-surface);
  color: var(--base-ink);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--base-line);
}
.mode-btn:focus-visible {
  outline: none;
  box-shadow: var(--base-focus-ring);
}

.more-menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-05);
  min-width: 190px;
}
.more-menu .base-menu-item {
  color: var(--base-ink);
}
.more-menu .mobile-only {
  display: none;
}

/* Narrower, the save state keeps its icon (label for screen readers):
   a failed sync has to stay visible. */
@media (max-width: 1120px) {
  .header-units,
  .meta-dot {
    display: none;
  }
  .save-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .header-right .search-trigger {
    width: 180px;
  }
  .search-trigger-kbd,
  .header-left :deep(.switch-count) {
    display: none;
  }
}

@media (max-width: 859px) {
  .shell-header {
    padding: 0 var(--space-3);
    /* 44px touch targets need more headroom than a 48px row gives. */
    min-height: 56px;
    gap: var(--space-2);
  }
  /* Four 44px targets side by side: each target is its own gap. */
  .header-right {
    gap: var(--space-1);
  }
  .header-brand :deep(.base-name) {
    display: none;
  }
  /* The mark alone is 18px; the link around it is the 44px target. */
  .header-brand {
    min-width: 44px;
    min-height: 44px;
    align-items: center;
    justify-content: center;
  }
  .header-left {
    gap: var(--space-1);
  }
  .header-sep {
    display: none;
  }
  /* No room for a steady "Saved" on a phone; the icon comes back only
     when something is wrong (the failure itself also toasts). */
  .header-meta:not(.is-warn) {
    display: none;
  }
  .header-left :deep(.switch-trigger) {
    /* Caps well under the desktop width so it ellipses instead of
       crowding the touch targets on the other side of the row. */
    max-width: 40vw;
    /* level with the search field beside it */
    height: 44px;
  }
  .header-right .search-trigger {
    width: auto;
    /* Icon-only here (text/kbd hidden below): a 44px touch target, not
       the icon's own size. */
    min-width: 44px;
    height: 44px;
    justify-content: center;
  }
  .search-trigger-text,
  .search-trigger-kbd {
    display: none;
  }
  /* Same 44px target; parent-prefixed to outrank BaseButton's sizes. */
  .header-right .base-button.header-icon-btn {
    width: 44px;
    height: 44px;
  }
  .mode-switch {
    display: none;
  }
  /* :global: these classes land on BaseTooltip's trigger span, which scoped
     CSS can't tag (Reka's TooltipProvider/Root have no DOM node to inherit
     the attribute onto). */
  .header-right :global(.header-feedback),
  .header-right :global(.header-settings) {
    display: none;
  }
  .header-right .header-login {
    display: none;
  }
  .more-menu .mobile-only {
    display: flex;
  }
}

/* On the narrowest phones the road name has no room; the brand mark is
   icon-only already, so it is the cheapest thing to drop. */
@media (max-width: 380px) {
  .header-brand {
    display: none;
  }
}
</style>
