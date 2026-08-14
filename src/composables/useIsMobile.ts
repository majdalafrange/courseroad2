import { onBeforeUnmount, onMounted, ref } from "vue";

const QUERY = "(max-width: 859px)";

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
  const query = window.matchMedia(QUERY);
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
