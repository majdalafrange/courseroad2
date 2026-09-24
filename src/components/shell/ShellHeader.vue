<template>
  <header class="shell-header">
    <!-- The page's one h1, for screen readers: the visible identity is the
         wordmark and the road switcher. Inside the banner landmark, so
         nothing on the page sits outside one. -->
    <h1 class="sr-only">{{ pageHeading }}</h1>
    <div class="header-left">
      <router-link to="/road" class="header-brand" aria-label="CourseRoad home">
        <g-wordmark size="sm" />
      </router-link>
      <span class="header-sep" aria-hidden="true" />
      <road-switcher
        @create-road="emit('create-road')"
        @switch-road="emit('switch-road', $event)"
        @duplicate-road="emit('duplicate-road', $event)"
        @delete-road="emit('delete-road', $event)"
        @open-import="emit('open-import')"
        @open-compare="emit('open-compare')"
        @open-share="emit('open-share')"
      />
      <span class="header-meta">
        <span v-if="totalUnits > 0" class="header-units"
          >{{ totalUnits }} units</span
        >
        <span v-if="totalUnits > 0" class="meta-dot sep" aria-hidden="true"
          >·</span
        >
        <g-tooltip :text="saveState.detail" placement="bottom" :delay="200">
          <!-- Focusable so its tooltip (the detail) is reachable by
               keyboard, not only by hover. -->
          <span class="save-state" :class="saveState.tone" tabindex="0">
            <g-icon class="save-icon" :name="saveState.icon" :size="12" />
            <span class="save-label">{{ saveState.label }}</span>
          </span>
        </g-tooltip>
      </span>
    </div>

    <div class="header-right">
      <g-tooltip
        :text="
          history.canUndo ? `Undo: ${history.undoLabel}` : 'Nothing to undo'
        "
      >
        <g-button
          variant="ghost"
          size="sm"
          icon-only
          class="header-icon-btn"
          :disabled="!history.canUndo"
          aria-label="Undo"
          @click="emit('undo')"
        >
          <g-icon name="undo" :size="15" />
        </g-button>
      </g-tooltip>
      <g-tooltip
        :text="
          history.canRedo ? `Redo: ${history.redoLabel}` : 'Nothing to redo'
        "
      >
        <g-button
          variant="ghost"
          size="sm"
          icon-only
          class="header-icon-btn"
          :disabled="!history.canRedo"
          aria-label="Redo"
          @click="emit('redo')"
        >
          <g-icon name="redo" :size="15" />
        </g-button>
      </g-tooltip>

      <button
        id="searchInputTF"
        class="search-trigger"
        data-cy="classSearchInput"
        aria-label="Add classes"
        :aria-keyshortcuts="isMac() ? 'Meta+K' : 'Control+K'"
        @click.stop="emit('open-search')"
      >
        <g-icon name="search" :size="14" />
        <span class="search-trigger-text">Add classes</span>
        <g-kbd
          class="search-trigger-kbd"
          :keys="paletteKeys.keys"
          :joiner="paletteKeys.joiner"
        />
      </button>

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

      <g-tooltip
        v-if="auth.loggedIn"
        class="header-feedback"
        text="Send feedback"
      >
        <g-button
          variant="ghost"
          size="sm"
          icon-only
          class="header-icon-btn"
          :href="feedbackFormUrl"
          external
          aria-label="Send feedback (opens in a new tab)"
          data-cy="feedbackButton"
        >
          <g-icon name="message" :size="15" />
        </g-button>
      </g-tooltip>

      <g-button
        v-if="!auth.loggedIn"
        variant="ghost"
        size="sm"
        class="header-login"
        data-cy="loginButton"
        @click="auth.loginUser()"
      >
        Log in
      </g-button>

      <g-menu v-model="moreOpen" align="end">
        <template #trigger>
          <g-button
            variant="ghost"
            size="sm"
            icon-only
            class="header-icon-btn"
            aria-label="More"
          >
            <g-icon name="dots" :size="16" />
          </g-button>
        </template>
        <div class="more-menu">
          <g-menu-item @select="emit('open-about')">
            <g-icon name="info" :size="14" /> About CourseRoad
          </g-menu-item>
          <g-menu-item data-cy="settingsButton" @select="emit('open-settings')">
            <g-icon name="settings" :size="14" /> Settings
          </g-menu-item>
          <g-menu-item v-if="auth.loggedIn" as-child>
            <a
              class="mobile-only"
              :href="feedbackFormUrl"
              target="_blank"
              rel="noopener"
            >
              <g-icon name="message" :size="14" /> Send feedback
              <span class="sr-only">(opens in a new tab)</span>
            </a>
          </g-menu-item>
          <g-menu-separator v-if="auth.loggedIn" />
          <g-menu-item
            v-if="auth.loggedIn"
            data-cy="logoutButton"
            @select="auth.logoutUser()"
          >
            <g-icon name="logout" :size="14" /> Log out
          </g-menu-item>
          <g-menu-item
            v-else
            class="mobile-only login"
            @select="auth.loginUser()"
          >
            <g-icon name="login" :size="14" /> Log in
          </g-menu-item>
        </div>
      </g-menu>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import GButton from "../../design/components/GButton.vue";
import GIcon, { type IconName } from "../../design/components/GIcon.vue";
import GKbd from "../../design/components/GKbd.vue";
import {
  GMenu,
  GMenuItem,
  GMenuSeparator,
} from "../../design/components/GMenu";
import GTooltip from "../../design/components/GTooltip.vue";
import GWordmark from "../../design/components/GWordmark.vue";
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

/* Feedback and issue-report form. */
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

/* ---- save state: one line + dot; detail in the tooltip ---- */
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
  border-bottom: 1px solid var(--g-line);
  background: var(--g-bg);
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
  box-shadow: var(--g-focus-ring);
}
.header-sep {
  width: 1px;
  height: 20px;
  background: var(--g-line-strong);
  flex-shrink: 0;
}

.header-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-small);
  color: var(--g-ink-3);
  white-space: nowrap;
}
.header-units {
  /* tabular digits keep the figure from shifting while it ticks */
  font-variant-numeric: tabular-nums;
}
.meta-dot {
  color: var(--g-line-strong);
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
  box-shadow: var(--g-focus-ring);
}
.save-state.ok .save-icon {
  color: var(--g-ok);
}
.save-state.warn .save-icon,
.save-state.warn .save-label {
  color: var(--g-warn);
}
.save-state.busy .save-icon {
  color: var(--g-info);
  animation: pulse 1.2s var(--ease-in-out) infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .save-state.busy .save-dot {
    animation: none;
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.search-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: 260px;
  height: 34px;
  padding: 0 var(--space-3);
  font: var(--text-body);
  color: var(--g-ink-3);
  background: var(--g-surface);
  border: none;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--g-line-control);
  cursor: pointer;
  transition: box-shadow var(--motion-quick) var(--ease-out);
}
.search-trigger:hover {
  box-shadow: inset 0 0 0 1px var(--g-ink-3);
  color: var(--g-ink-2);
}
.search-trigger:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
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
  background: var(--g-surface-sunken);
  border-radius: var(--radius-sm);
  padding: var(--space-05);
}
.mode-btn {
  font: var(--text-small);
  font-weight: 500;
  color: var(--g-ink-2);
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
  color: var(--g-ink);
}
/* the thumb is a control: ringed, no shadow */
.mode-btn.active {
  background: var(--g-surface);
  color: var(--g-ink);
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--g-line);
}
.mode-btn:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

.more-menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-05);
  min-width: 190px;
}
.more-menu .g-menu-item {
  color: var(--g-ink);
}
.more-menu .mobile-only {
  display: none;
}
.more-menu .login {
  color: var(--g-accent);
  font-weight: 600;
}

@media (max-width: 1120px) {
  .header-meta {
    display: none;
  }
}

@media (max-width: 859px) {
  .shell-header {
    padding: 0 var(--space-3);
    /* 40px touch targets need more headroom than a 48px row gives. */
    min-height: 56px;
    gap: var(--space-2);
  }
  .header-brand :deep(.g-name) {
    display: none;
  }
  .header-sep {
    display: none;
  }
  .header-left :deep(.switch-trigger) {
    /* Caps well under the desktop width so it ellipses instead of
       crowding the touch targets on the other side of the row. */
    max-width: 40vw;
    /* level with the search field beside it */
    height: 40px;
  }
  .search-trigger {
    width: auto;
    /* Icon-only here (text/kbd hidden below): widen toward the 44px
       touch-target guideline instead of sizing to the icon alone. */
    min-width: 40px;
    height: 40px;
  }
  .search-trigger-text,
  .search-trigger-kbd {
    display: none;
  }
  /* Undo/redo/feedback/more: same reasoning as .search-trigger. (Theme
     toggle is sized in its own component, ThemeToggle.vue.) */
  /* Parent-prefixed to outrank GButton's own size rules. */
  .header-right .g-button.header-icon-btn {
    width: 40px;
    height: 40px;
  }
  .mode-switch {
    display: none;
  }
  /* :global: these classes land on GTooltip's trigger span, which scoped
     CSS can't tag (Reka's TooltipProvider/Root have no DOM node to inherit
     the attribute onto). */
  .header-right :global(.header-feedback) {
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
