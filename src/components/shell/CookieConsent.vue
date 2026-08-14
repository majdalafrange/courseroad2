<template>
  <transition name="consent">
    <div
      v-if="visible"
      class="cookie-consent"
      role="region"
      aria-label="Cookies"
    >
      <p class="consent-text">
        We use cookies and local storage in this browser to save your roads and
        keep you logged in. Opt out and we won't be able to keep your changes
        past this tab.
      </p>
      <div class="consent-actions">
        <g-button
          variant="primary"
          size="sm"
          data-cy="acceptCookies"
          @click="accept"
        >
          OK
        </g-button>
        <g-button variant="ghost" size="sm" @click="optOut">Opt out</g-button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import GButton from "../../design/components/GButton.vue";
import {
  STORAGE_KEYS,
  clearAppStorage,
  readValue,
  writeValue,
} from "../../lib/appStorage";
import { clearCachedCatalog } from "../../lib/catalogCache";
import { clearExplorationSnapshot } from "../../lib/connections/persist";
import { cookies } from "../../lib/cookies";
import { useAuthStore } from "../../stores/auth";
import { useCourseDataStore } from "../../stores/courseData";

const store = useCourseDataStore();
const auth = useAuthStore();

// "true" = accepted, "optout" = declined. Either answer keeps the banner
// dismissed across sessions; the opt-out marker is the one entry kept so
// the question is not re-asked.
const answer = readValue<string>(STORAGE_KEYS.consent);

const dismissed = ref(answer === "true" || answer === "optout");

if (answer === "true") {
  store.allowCookies();
} else if (answer === "optout") {
  store.disallowCookies();
}

const visible = computed(() => !dismissed.value);

function accept() {
  store.allowCookies();
  dismissed.value = true;
  writeValue(STORAGE_KEYS.consent, "true");
  // Every save before this click was skipped by saveLocal's consent
  // guard, so the roads on screen exist in memory only. Write them now,
  // or the first session survives only if something edits a road after
  // this point. Only the click path flushes: the stored-answer path above
  // runs before restoreFromStorage has hydrated the roads, and a save
  // there would overwrite the stored map with the empty default.
  auth.saveLocal();
}

function optOut() {
  store.disallowCookies();
  dismissed.value = true;
  clearAppStorage();
  clearExplorationSnapshot();
  void clearCachedCatalog();
  // The app no longer stores state in cookies, but a browser carrying
  // some from an older version should not keep them.
  for (const key of cookies.keys()) {
    cookies.remove(key);
  }
  writeValue(STORAGE_KEYS.consent, "optout");
}
</script>

<style scoped>
.cookie-consent {
  position: fixed;
  bottom: var(--space-4);
  left: var(--space-4);
  z-index: 90;
  width: 340px;
  max-width: calc(100vw - 32px);
  background: var(--g-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.consent-text {
  font: var(--text-small);
  color: var(--g-ink-2);
  margin: 0;
}
.consent-actions {
  display: flex;
  gap: var(--space-2);
}

.consent-enter-active {
  transition:
    opacity var(--motion-deliberate) var(--ease-out),
    transform var(--motion-deliberate) var(--ease-out);
}
.consent-leave-active {
  transition: opacity var(--motion-quick) var(--ease-in);
}
.consent-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.consent-leave-to {
  opacity: 0;
}
</style>
