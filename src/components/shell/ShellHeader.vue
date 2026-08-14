<template>
  <header class="shell-header">
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
      />
      <span class="header-meta">
        <span v-if="totalUnits > 0" class="header-units"
          >{{ totalUnits }} units</span
        >
        <span v-if="totalUnits > 0" class="meta-dot" aria-hidden="true">·</span>
        <g-tooltip :text="saveState.detail" placement="bottom" :delay="200">
          <span class="save-state" :class="saveState.tone">
            <span class="save-dot" />
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
        <button
          class="header-icon-btn"
          :disabled="!history.canUndo"
          aria-label="Undo"
          @click="emit('undo')"
        >
          <g-icon name="undo" :size="15" />
        </button>
      </g-tooltip>
      <g-tooltip
        :text="
          history.canRedo ? `Redo: ${history.redoLabel}` : 'Nothing to redo'
        "
      >
        <button
          class="header-icon-btn"
          :disabled="!history.canRedo"
          aria-label="Redo"
          @click="emit('redo')"
        >
          <g-icon name="redo" :size="15" />
        </button>
      </g-tooltip>

      <button
        id="searchInputTF"
        class="search-trigger"
        data-cy="classSearchInput"
        aria-label="Add classes"
        @click.stop="emit('open-search')"
      >
        <g-icon name="search" :size="14" />
        <span class="search-trigger-text">Add classes</span>
        <g-kbd
          class="search-trigger-kbd"
          :keys="shortcut.keys"
          :joiner="shortcut.joiner"
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
        <a
          class="header-icon-btn"
          :href="feedbackFormUrl"
          target="_blank"
          rel="noopener"
          aria-label="Send feedback"
          data-cy="feedbackButton"
        >
          <g-icon name="message" :size="15" />
        </a>
      </g-tooltip>

      <button
        v-if="!auth.loggedIn"
        class="header-login"
        data-cy="loginButton"
        @click="auth.loginUser()"
      >
        Log in with MIT
      </button>

      <g-tooltip
        :text="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
      >
        <theme-toggle :dark="isDark" @toggle="emit('toggle-theme')" />
      </g-tooltip>

      <g-popover v-model="moreOpen" align="end" menu>
        <template #anchor>
          <button
            class="header-icon-btn"
            aria-label="More"
            aria-haspopup="menu"
            :aria-expanded="moreOpen"
            @click="moreOpen = !moreOpen"
          >
            <g-icon name="dots" :size="16" />
          </button>
        </template>
        <div class="more-menu" @click.stop>
          <button
            class="more-item"
            data-cy="shareRoadButton"
            @click="closeAnd('open-share')"
          >
            <g-icon name="upload" :size="14" /> Share this road…
          </button>
          <button class="more-item" @click="closeAnd('open-about')">
            <g-icon name="info" :size="14" /> About CourseRoad
          </button>
          <a
            v-if="auth.loggedIn"
            class="more-item mobile-only"
            :href="feedbackFormUrl"
            target="_blank"
            rel="noopener"
            @click="moreOpen = false"
          >
            <g-icon name="message" :size="14" /> Send feedback
          </a>
          <div v-if="auth.loggedIn" class="more-divider" />
          <button
            v-if="auth.loggedIn"
            class="more-item"
            data-cy="logoutButton"
            @click="
              moreOpen = false;
              auth.logoutUser();
            "
          >
            <g-icon name="logout" :size="14" /> Log out
          </button>
          <button
            v-else
            class="more-item mobile-only login"
            @click="
              moreOpen = false;
              auth.loginUser();
            "
          >
            <g-icon name="login" :size="14" /> Log in with MIT
          </button>
        </div>
      </g-popover>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import GIcon from "../../design/components/GIcon.vue";
import GKbd from "../../design/components/GKbd.vue";
import GPopover from "../../design/components/GPopover.vue";
import GTooltip from "../../design/components/GTooltip.vue";
import GWordmark from "../../design/components/GWordmark.vue";
import RoadSwitcher from "./RoadSwitcher.vue";
import ThemeToggle from "./ThemeToggle.vue";
import { semesterInformation } from "../../lib/hours";
import { shortcutKeys } from "../../lib/platform";
import { history } from "../../stores/history";
import { useAuthStore } from "../../stores/auth";
import { useCourseDataStore } from "../../stores/courseData";

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
  (e: "toggle-theme"): void;
  (e: "navigate-mode", mode: "plan" | "explore"): void;
}>();

const store = useCourseDataStore();
const auth = useAuthStore();
const route = useRoute();

const isExplore = computed(() => route.path === "/explore");
const isDark = computed(() => Boolean(store.isDarkMode));
const shortcut = shortcutKeys("K");
const moreOpen = ref(false);

/* Feedback and issue-report form. */
const feedbackFormUrl = "https://forms.gle/VAY3E7RbjmUrw3ww5";

function closeAnd(event: "open-share" | "open-about") {
  moreOpen.value = false;
  if (event === "open-share") {
    emit("open-share");
  } else {
    emit("open-about");
  }
}

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

/* ---- save-state whisper: one quiet line + dot; detail in the tooltip ---- */
interface SaveState {
  label: string;
  detail: string;
  tone: "ok" | "busy" | "warn" | "muted";
}

const saveState = computed<SaveState>(() => {
  if (auth.gettingUserData) {
    return {
      label: "Loading…",
      detail: "Grabbing your roads from FireRoad.",
      tone: "busy",
    };
  }
  if (auth.currentlySaving) {
    return {
      label: "Saving…",
      detail: auth.loggedIn
        ? "Syncing your changes to FireRoad."
        : "Saving your changes in this browser.",
      tone: "busy",
    };
  }
  if (auth.saveWarnings.length > 0) {
    return {
      label: `${auth.saveWarnings.length} save issue${auth.saveWarnings.length > 1 ? "s" : ""}`,
      detail: auth.saveWarnings.map((w) => `${w.name}: ${w.error}`).join(" · "),
      tone: "warn",
    };
  }
  if (!auth.loggedIn) {
    if (store.cookiesAllowed === false) {
      return {
        label: "Not saved",
        detail: "Cookies are off, so we can only keep changes in this tab.",
        tone: "warn",
      };
    }
    return {
      label: "Saved in this browser",
      detail: "Log in with MIT and we'll sync it across your devices.",
      tone: "muted",
    };
  }
  return {
    label: "Saved",
    detail: "You're all synced up with FireRoad.",
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
  /* the figure ticks up while editing; tabular digits keep it from dancing */
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
}
.save-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--g-ink-3);
  flex-shrink: 0;
}
.save-state.ok .save-dot {
  background: var(--g-ok);
}
.save-state.warn .save-dot {
  background: var(--g-warn);
}
.save-state.warn .save-label {
  color: var(--g-warn);
}
.save-state.busy .save-dot {
  background: var(--g-info);
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

.header-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--g-ink-2);
  cursor: pointer;
  text-decoration: none;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.header-icon-btn:hover:not(:disabled) {
  background: var(--g-accent-tint);
  color: var(--g-ink);
}
.header-icon-btn:disabled {
  color: var(--g-ink-disabled);
  cursor: default;
}
.header-icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
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
  box-shadow: inset 0 0 0 1px var(--g-line-strong);
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
/* Plan ⁄ Explore is a mode, so it reads as a segmented control, not a CTA. */
.mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: var(--g-surface-sunken);
  border-radius: var(--radius-sm);
  padding: 2px;
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
/* the thumb is a control, not a floating card; it sits, ringed, no shadow */
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

.header-login {
  font: var(--text-small);
  font-weight: 600;
  color: var(--g-brand);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  height: 28px;
  padding: 0 var(--space-2);
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.header-login:hover {
  background: var(--g-accent-tint);
}
.header-login:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}

.more-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 190px;
}
.more-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--text-body);
  color: var(--g-ink);
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  text-align: left;
  text-decoration: none;
  transition: background-color var(--motion-quick) var(--ease-out);
}
.more-item:hover {
  background: var(--g-accent-tint);
}
.more-item:focus-visible {
  outline: none;
  box-shadow: var(--g-focus-ring);
}
.more-divider {
  height: 1px;
  background: var(--g-line);
  margin: var(--space-1) var(--space-2);
}
.more-item.mobile-only {
  display: none;
}
.more-item.login {
  color: var(--g-brand);
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
    /* 40px touch targets need more headroom than the old 48px row gave. */
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
  .header-icon-btn {
    width: 40px;
    height: 40px;
  }
  .mode-switch {
    display: none;
  }
  .header-right .header-feedback {
    display: none;
  }
  .header-login {
    display: none;
  }
  .more-item.mobile-only {
    display: flex;
  }
}

/* On the narrowest phones the road name has almost no room left; the
   brand mark is icon-only already and the bottom nav covers navigation,
   so it's the cheapest thing to drop. */
@media (max-width: 380px) {
  .header-brand {
    display: none;
  }
}
</style>
