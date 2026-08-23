import { onBeforeUnmount, onMounted, ref } from "vue";

const QUERY_WIDTH = "(max-width: 859px)";
const QUERY_TOUCH = "(pointer: coarse)";

/**
 * Reactive mobile/desktop split, matching the 860px breakpoint the shell
 * layout switches on everywhere else (MainPage's own viewport tracking,
 * ShellHeader's and TermCell's `@media (max-width: 859px)` rules).
 */
export function useIsMobile() {
  // jsdom doesn't implement matchMedia; fall back to a one-time width
  // check rather than crash. It won't track a resize, but nothing in that
  // environment can resize anyway.
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

export function useTouchDevice() {
  // same as above, but for touvh-pointer media query
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
