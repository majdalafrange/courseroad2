/* eslint-disable vue/one-component-per-file */
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import GSheet from "../../../src/design/components/GSheet.vue";

/**
 * The modal keyboard contract: Escape closes one layer, Tab stays
 * inside, focus returns to the opener. These are the behaviors the
 * eight scrim dialogs lost when each hand-rolled its own shell; Reka
 * UI's Dialog owns the mechanics now, so these tests drive it the way
 * it actually listens (window for Escape, document for a scrim
 * pointerdown, bubbling from the focused element for Tab) rather than
 * the old single document-level keydown listener.
 */

let wrapper: VueWrapper | undefined;

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

/** Host with an opener button and a two-field sheet, mounted to body. */
function mountHost(open = true) {
  const openRef = ref(open);
  const host = defineComponent({
    setup() {
      return () =>
        h("div", [
          h("button", { id: "opener" }, "open"),
          h(
            GSheet,
            {
              modelValue: openRef.value,
              "onUpdate:modelValue": (v: boolean) => (openRef.value = v),
              label: "Test sheet",
            },
            {
              default: () => [
                h("input", { id: "first" }),
                h("button", { id: "last" }, "ok"),
              ],
            },
          ),
        ]);
    },
  });
  wrapper = mount(host, { attachTo: document.body });
  return { openRef };
}

function panel(): HTMLElement {
  const el = document.querySelector<HTMLElement>(".g-sheet-panel");
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

/** Reka's DismissableLayer listens for Escape on window (VueUse's
 *  onKeyStroke default target), not document. */
function pressEscape(): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    cancelable: true,
    bubbles: true,
  });
  window.dispatchEvent(event);
  return event;
}

/** FocusScope's Tab trap is a plain @keydown on the panel itself, so it
 *  only fires for a keydown that bubbles up from something inside it. */
function pressTabFromFocused(shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    cancelable: true,
    bubbles: true,
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
}

/** Outside-pointerdown detection listens on document, registered after a
 *  setTimeout(0) (so the very click that opened a dialog isn't itself
 *  read as "outside"); a real macrotask wait is needed, not just a
 *  microtask flush. */
async function clickScrim(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  document
    .querySelector<HTMLElement>(".g-sheet-scrim")
    ?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
}

describe("GSheet", () => {
  it("renders role=dialog naming the sheet via aria-labelledby", async () => {
    mountHost();
    // Reka's Teleport defers to a mounted ref (an SSR-safety guard), so
    // the content doesn't land in the DOM until a tick after mount.
    await flushPromises();
    expect(panel().getAttribute("role")).toBe("dialog");
    const labelledBy = panel().getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe(
      "Test sheet",
    );
  });

  it("closes on Escape and marks the event consumed", async () => {
    const { openRef } = mountHost();
    await flushPromises();
    const event = pressEscape();
    await flushPromises();
    expect(openRef.value).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves an already-consumed Escape alone (one Escape, one layer)", async () => {
    const { openRef } = mountHost();
    await flushPromises();
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
      bubbles: true,
    });
    event.preventDefault(); // an inner layer (popover) already took it
    window.dispatchEvent(event);
    await nextTick();
    expect(openRef.value).toBe(true);
  });

  it("closes on a scrim click but not on a panel click", async () => {
    const { openRef } = mountHost();
    await flushPromises();
    panel().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(openRef.value).toBe(true);
    await clickScrim();
    await flushPromises();
    expect(openRef.value).toBe(false);
  });

  it("moves initial focus onto the panel's first focusable", async () => {
    mountHost();
    await flushPromises();
    // The built-in close button is the panel's first focusable, Reka's
    // FocusScope default (the old shell focused the panel container
    // itself instead; either way, focus starts inside the trap).
    expect(document.activeElement).toBe(
      document.querySelector(".g-sheet-close"),
    );
    expect(panel().contains(document.activeElement)).toBe(true);
  });

  it("wraps Tab at the last focusable and Shift+Tab at the first", async () => {
    mountHost();
    await flushPromises();
    const close = document.querySelector<HTMLElement>(".g-sheet-close");
    const last = document.querySelector<HTMLElement>("#last");
    last?.focus();
    const tab = pressTabFromFocused();
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    close?.focus();
    const shiftTab = pressTabFromFocused(true);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("returns focus to the opener on close", async () => {
    const { openRef } = mountHost(false);
    const opener = document.querySelector<HTMLElement>("#opener");
    opener?.focus();
    openRef.value = true;
    await flushPromises();
    expect(panel().contains(document.activeElement)).toBe(true);
    openRef.value = false;
    await flushPromises();
    expect(document.activeElement).toBe(opener);
  });

  it("a non-dismissible sheet ignores Escape and the scrim", async () => {
    const openRef = ref(true);
    wrapper = mount(
      defineComponent({
        setup() {
          return () =>
            h(
              GSheet,
              {
                modelValue: openRef.value,
                "onUpdate:modelValue": (v: boolean) => (openRef.value = v),
                label: "Forced choice",
                dismissible: false,
              },
              { default: () => h("button", { id: "keep" }, "keep") },
            );
        },
      }),
      { attachTo: document.body },
    );
    await flushPromises();
    const event = pressEscape();
    await flushPromises();
    expect(openRef.value).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    await clickScrim();
    await flushPromises();
    expect(openRef.value).toBe(true);
    expect(document.querySelector(".g-sheet-close")).toBeNull();
  });

  it("stops listening after close (no ghost Escape handling)", async () => {
    const { openRef } = mountHost();
    await flushPromises();
    pressEscape();
    await flushPromises();
    expect(openRef.value).toBe(false);
    const second = pressEscape();
    expect(second.defaultPrevented).toBe(false);
  });
});
