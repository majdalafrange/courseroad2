import { onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import { TOUCH_QUERY } from "../lib/platform";

/** A media query's match state, kept live while the component is mounted.
 *  `fallback` stands in where matchMedia is missing (jsdom). */
function useMediaQuery(query: string, fallback: () => boolean): Ref<boolean> {
  if (typeof window.matchMedia !== "function") {
    return ref(fallback());
  }
  const list = window.matchMedia(query);
  const matches = ref(list.matches);

  function onChange(event: MediaQueryListEvent) {
    matches.value = event.matches;
  }

  onMounted(() => {
    list.addEventListener("change", onChange);
  });
  onBeforeUnmount(() => {
    list.removeEventListener("change", onChange);
  });

  return matches;
}

/** Reactive mobile/desktop split at the 860px breakpoint the shell layout uses. */
export function useIsMobile(): Ref<boolean> {
  return useMediaQuery("(max-width: 859px)", () => window.innerWidth < 860);
}

/** Reactive touch-pointer check; outside a component use isTouchDevice(). */
export function useTouchDevice(): Ref<boolean> {
  return useMediaQuery(TOUCH_QUERY, () => false);
}
