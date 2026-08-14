// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import GSheet from "../../../src/design/components/GSheet.vue";

/**
 * The modal keyboard contract: Escape closes one layer, Tab stays
 * inside, focus returns to the opener. These are the behaviors the
 * eight scrim dialogs lost when each hand-rolled its own shell.
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

function pressOnDocument(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { ...init, cancelable: true });
  document.dispatchEvent(event);
  return event;
}

describe("GSheet", () => {
  it("renders role=dialog with aria-modal and the given name", () => {
    mountHost();
    expect(panel().getAttribute("role")).toBe("dialog");
    expect(panel().getAttribute("aria-modal")).toBe("true");
    expect(panel().getAttribute("aria-label")).toBe("Test sheet");
  });

  it("closes on Escape and marks the event consumed", async () => {
    const { openRef } = mountHost();
    const event = pressOnDocument({ key: "Escape" });
    await nextTick();
    expect(openRef.value).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves an already-consumed Escape alone (one Escape, one layer)", async () => {
    const { openRef } = mountHost();
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    event.preventDefault(); // an inner layer (popover) already took it
    document.dispatchEvent(event);
    await nextTick();
    expect(openRef.value).toBe(true);
  });

  it("closes on a scrim click but not on a panel click", async () => {
    const { openRef } = mountHost();
    panel().click();
    await nextTick();
    expect(openRef.value).toBe(true);
    document
      .querySelector<HTMLElement>(".g-sheet-scrim")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(openRef.value).toBe(false);
  });

  it("moves initial focus into the panel", async () => {
    mountHost();
    await nextTick();
    expect(document.activeElement).toBe(panel());
  });

  it("wraps Tab at the last focusable and Shift+Tab at the first", () => {
    mountHost();
    // The built-in close button is the panel's first focusable.
    const close = document.querySelector<HTMLElement>(".g-sheet-close");
    const last = document.querySelector<HTMLElement>("#last");
    last?.focus();
    const tab = pressOnDocument({ key: "Tab" });
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    close?.focus();
    const shiftTab = pressOnDocument({ key: "Tab", shiftKey: true });
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("returns focus to the opener on close", async () => {
    const { openRef } = mountHost(false);
    const opener = document.querySelector<HTMLElement>("#opener");
    opener?.focus();
    openRef.value = true;
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(panel());
    openRef.value = false;
    await nextTick();
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
    const event = pressOnDocument({ key: "Escape" });
    await nextTick();
    expect(openRef.value).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    document
      .querySelector<HTMLElement>(".g-sheet-scrim")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(openRef.value).toBe(true);
    expect(document.querySelector(".g-sheet-close")).toBeNull();
  });

  it("stops listening after close (no ghost Escape handling)", async () => {
    const { openRef } = mountHost();
    pressOnDocument({ key: "Escape" });
    await nextTick();
    expect(openRef.value).toBe(false);
    const second = pressOnDocument({ key: "Escape" });
    expect(second.defaultPrevented).toBe(false);
  });
});
