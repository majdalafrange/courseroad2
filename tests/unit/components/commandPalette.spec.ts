// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CommandPalette from "../../../src/components/palette/CommandPalette.vue";

/**
 * The palette's Escape contract. Escape used to be handled on the search
 * input alone, so a palette whose focus had moved off the input (clicking
 * a result row does that) stopped answering the key. It is handled at the
 * document now, and marked consumed so the window listeners in ClassDetail
 * and RoadCanvas skip the same keypress.
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
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

describe("CommandPalette Escape", () => {
  it("closes when Escape arrives with focus off the input", () => {
    wrapper = mount(CommandPalette, {
      props: { modelValue: true },
      attachTo: document.body,
    });
    // focus anywhere that is not the search input
    document.body.focus();
    expect(document.activeElement).not.toBe(
      document.querySelector(".palette-input"),
    );

    const event = pressEscape();

    expect(closeEmissions()).toEqual([false]);
    // marked consumed, so the canvas and the detail stack skip this keypress
    expect(event.defaultPrevented).toBe(true);
  });

  it("still closes when Escape arrives from the input", async () => {
    wrapper = mount(CommandPalette, {
      props: { modelValue: true },
      attachTo: document.body,
    });
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

  it("ignores Escape while closed, leaving it for the layer below", () => {
    wrapper = mount(CommandPalette, {
      props: { modelValue: false },
      attachTo: document.body,
    });

    const event = pressEscape();

    expect(closeEmissions()).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("CommandPalette filter-grammar hint", () => {
  it("shows the hint on an empty query and hides it once typing starts", async () => {
    // The old placement inside the empty state was unreachable: an empty
    // query always renders the base actions, so the empty state never
    // appeared and the grammar was documented nowhere.
    wrapper = mount(CommandPalette, {
      props: { modelValue: true },
      attachTo: document.body,
    });
    const hint = () => document.querySelector(".palette-hint");
    expect(hint()).not.toBeNull();
    expect(hint()?.textContent).toContain("hass-a");

    const input = document.querySelector<HTMLInputElement>(".palette-input");
    expect(input).not.toBeNull();
    input!.value = "8.01";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(hint()).toBeNull();
  });

  it("names the key that applies a filter (F3)", () => {
    // The hint used to read "try hass-a spring to compose filters", but
    // typed literally that query dead-ends: words never become filters on
    // their own. The hint has to state the mechanism, which is Tab.
    wrapper = mount(CommandPalette, {
      props: { modelValue: true },
      attachTo: document.body,
    });
    expect(document.querySelector(".palette-hint")?.textContent).toContain(
      "Tab",
    );
  });

  it("states the Tab mechanism at the dead end itself (F3)", async () => {
    // A query whose words are filter aliases matches nothing as text.
    // With a filter suggestion pending, the empty state has to say how
    // to apply it, not only that nothing matches.
    wrapper = mount(CommandPalette, {
      props: { modelValue: true },
      attachTo: document.body,
    });
    const input = document.querySelector<HTMLInputElement>(".palette-input");
    input!.value = "hass-a spring";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await wrapper.vm.$nextTick();

    const empty = document.querySelector(".palette-empty");
    expect(empty?.textContent).toContain("Nothing matches");
    expect(empty?.textContent).toContain("Tab applies the suggested filter");

    // Without a pending suggestion the plain sentence stands alone.
    input!.value = "zzzz";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(document.querySelector(".palette-empty")?.textContent).not.toContain(
      "Tab",
    );
  });
});
