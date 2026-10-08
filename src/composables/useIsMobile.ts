import { onBeforeUnmount, onMounted, ref } from "vue";

const QUERY_WIDTH = "(max-width: 859px)";
const QUERY_TOUCH = "(pointer: coarse)";

/** Reactive mobile/desktop split at the 860px breakpoint the shell layout uses. */
export function useIsMobile() {
  // jsdom has no matchMedia; fall back to a one-time width check.
  if (typeof window.matchMedia !== "function") {
    return ref(window.innerWidth < 860);
  }
  const query = window.matchMedia(QUERY_WIDTH);
  const isMobile = ref(query.matches);

  function onChange(event: MediaQueryListEvent) {
    isMobile.value = event.matches;
  }

  onMounted(() => {
    query.addEventListener("change", onChange);
  });
  onBeforeUnmount(() => {
    query.removeEventListener("change", onChange);
  });

  return isMobile;
}

/** A one-time read of useTouchDevice's query, for code outside a component. */
export function isTouchDevice(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia(QUERY_TOUCH).matches
  );
}

export function useTouchDevice() {
  if (typeof window.matchMedia !== "function") {
    return ref(false);
  }
  const query = window.matchMedia(QUERY_TOUCH);
  const isTouchDevice = ref(query.matches);

  function onChange(event: MediaQueryListEvent) {
    isTouchDevice.value = event.matches;
  }

  onMounted(() => {
    query.addEventListener("change", onChange);
  });
  onBeforeUnmount(() => {
    query.removeEventListener("change", onChange);
  });

  return isTouchDevice;
}
