// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CommandPalette from "../../../src/components/palette/CommandPalette.vue";

/**
 * The palette's Escape contract: closes it wherever focus is (clicking a
 * result row can move focus off the input) and marked consumed so the
 * window listeners in ClassDetail and RoadCanvas skip the same keypress.
 * The palette is a Reka Dialog around a Reka Combobox: the dialog renders
 * a tick after mount, and the listbox scrolls its highlight into view,
 * which jsdom (no layout) doesn't implement.
 */

let wrapper: VueWrapper | undefined;

function pressEscape(): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
}

/** What the palette emitted for v-model, if anything. */
function closeEmissions(): boolean[] {
  return ((wrapper?.emitted("update:modelValue") ?? []) as boolean[][]).map(
    (args) => args[0],
  );
}

beforeEach(() => {
  setActivePinia(createPinia());
  Element.prototype.scrollIntoView = () => {};
});

/** Mount the palette and let the dialog render. */
async function mountPalette(modelValue = true): Promise<void> {
  wrapper = mount(CommandPalette, {
    props: { modelValue },
    attachTo: document.body,
  });
  await flushPromises();
}

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

describe("CommandPalette Escape", () => {
  it("closes when Escape arrives with focus off the input", async () => {
    await mountPalette();
    // focus anywhere that is not the search input
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).not.toBe(
      document.querySelector(".palette-input"),
    );

    const event = pressEscape();

    expect(closeEmissions()).toEqual([false]);
    // marked consumed, so the canvas and the detail stack skip this keypress
    expect(event.defaultPrevented).toBe(true);
  });

  it("still closes when Escape arrives from the input", async () => {
    await mountPalette();
    const input = document.querySelector<HTMLElement>(".palette-input");
    expect(input).not.toBeNull();
    input?.focus();

    input?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(closeEmissions()).toEqual([false]);
  });

  it("ignores Escape while closed, leaving it for the layer below", async () => {
    await mountPalette(false);

    const event = pressEscape();

    expect(closeEmissions()).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("CommandPalette filter-grammar hint", () => {
  it("shows the hint on an empty query and hides it once typing starts", async () => {
    // An empty query always renders the base actions, so the empty state
    // never appears; the grammar has to be documented elsewhere.
    await mountPalette();
    const hint = () => document.querySelector(".palette-hint");
    expect(hint()).not.toBeNull();
    expect(hint()?.textContent).toContain("hass-a");

    const input = document.querySelector<HTMLInputElement>(".palette-input");
    expect(input).not.toBeNull();
    input!.value = "8.01";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    expect(hint()).toBeNull();
  });

  it("names the key that applies a filter", async () => {
    // Typed literally, "hass-a spring" dead-ends: words never become
    // filters on their own. The hint has to state the mechanism, Tab.
    await mountPalette();
    expect(document.querySelector(".palette-hint")?.textContent).toContain(
      "Tab",
    );
  });

  it("states the Tab mechanism at the dead end itself", async () => {
    // A query whose words are filter aliases matches nothing as text.
    // With a filter suggestion pending, the empty state has to say how
    // to apply it, not only that nothing matches.
    await mountPalette();
    const input = document.querySelector<HTMLInputElement>(".palette-input");
    input!.value = "hass-a spring";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();

    const empty = document.querySelector(".palette-empty");
    expect(empty?.textContent).toContain("Nothing matches");
    expect(empty?.textContent).toContain("Tab applies the suggested filter");

    // Without a pending suggestion the plain sentence stands alone.
    input!.value = "zzzz";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
    expect(document.querySelector(".palette-empty")?.textContent).not.toContain(
      "Tab",
    );
  });
});
