// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CookieConsent from "../../../src/components/shell/CookieConsent.vue";
import { STORAGE_KEYS } from "../../../src/lib/appStorage";
import { newRoad } from "../../../src/lib/roads";
import { useAuthStore } from "../../../src/stores/auth";
import { useCourseDataStore } from "../../../src/stores/courseData";

/**
 * The consent flush (F1). Every road save before the banner is answered
 * is skipped by saveLocal's consent guard, and accepting used to write
 * only the consent marker. The whole first session (the onboarding
 * starting plan included) lived in memory only, and a reload after
 * clicking OK lost it.
 */
describe("CookieConsent accept", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  function entry(v: unknown): string {
    return JSON.stringify({ v, e: 0 });
  }

  it("writes the roads held in memory when consent is granted (F1)", async () => {
    const store = useCourseDataStore();
    useAuthStore();
    store.setRoad({ id: "$0$", road: newRoad("Pre-consent"), ignoreSet: true });

    const wrapper = mount(CookieConsent);
    expect(localStorage.getItem(STORAGE_KEYS.newRoads)).toBeNull();

    await wrapper.get("[data-cy=acceptCookies]").trigger("click");

    const raw = localStorage.getItem(STORAGE_KEYS.newRoads);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw as string).v as Record<
      string,
      { name: string }
    >;
    expect(saved["$0$"].name).toBe("Pre-consent");
    wrapper.unmount();
  });

  it("does not save on mount for a returning consented visitor", () => {
    // The stored-answer path runs during setup, before restoreFromStorage
    // has hydrated the roads. A flush here would overwrite the stored map
    // with the empty default road, so the accept click is the only path
    // that saves.
    localStorage.setItem(
      STORAGE_KEYS.newRoads,
      entry({ $0$: newRoad("Kept") }),
    );
    localStorage.setItem(STORAGE_KEYS.consent, entry("true"));
    const store = useCourseDataStore();
    useAuthStore();

    const wrapper = mount(CookieConsent);

    expect(store.cookiesAllowed).toBe(true);
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.newRoads) as string,
    ).v as Record<string, { name: string }>;
    expect(saved["$0$"].name).toBe("Kept");
    wrapper.unmount();
  });
});
