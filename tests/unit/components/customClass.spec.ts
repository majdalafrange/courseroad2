// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CustomClass from "../../../src/components/sheets/CustomClass.vue";
import { useCourseDataStore } from "../../../src/stores/courseData";

/**
 * The number fields carry real prefilled values, not placeholders. The
 * placeholders read as defaults but submitted as zero, so an untouched
 * form saved an activity contributing nothing to units or hours.
 */

let wrapper: VueWrapper | undefined;

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

describe("CustomClass defaults", () => {
  it("prefills the numbers it used to only suggest, and saves them", async () => {
    wrapper = mount(CustomClass, { attachTo: document.body });
    (wrapper.vm as unknown as { openNewClass: () => void }).openNewClass();
    await wrapper.vm.$nextTick();

    // GNumberField's input carries role="spinbutton" (Reka's NumberField),
    // not type="number": the value is real, no string<->number parsing.
    const numbers = [
      ...document.querySelectorAll<HTMLInputElement>(
        '.g-number-field-input[role="spinbutton"]',
      ),
    ];
    expect(numbers.map((input) => input.value)).toEqual(["12", "0", "10"]);

    // Fill the required text fields and submit without touching a number.
    const texts = [
      ...document.querySelectorAll<HTMLInputElement>(".g-input-field"),
    ];
    texts[0].value = "UROP";
    texts[0].dispatchEvent(new Event("input", { bubbles: true }));
    texts[1].value = "Research";
    texts[1].dispatchEvent(new Event("input", { bubbles: true }));
    await wrapper.vm.$nextTick();

    const addButton = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Add activity"),
    );
    expect(addButton).toBeDefined();
    addButton!.click();
    await wrapper.vm.$nextTick();

    const store = useCourseDataStore();
    expect(store.itemAdding?.subject_id).toBe("UROP");
    expect(store.itemAdding?.total_units).toBe(12);
    expect(store.itemAdding?.in_class_hours).toBe(0);
    expect(store.itemAdding?.out_of_class_hours).toBe(10);
  });

  it("names every color swatch, the department default included (F6)", async () => {
    // The palette swatches carry "Color 1" through "Color 42"; the
    // department-default swatch rendered as a bare button, so a screen
    // reader announced nothing for it.
    wrapper = mount(CustomClass, { attachTo: document.body });
    (wrapper.vm as unknown as { openNewClass: () => void }).openNewClass();
    await wrapper.vm.$nextTick();

    const unnamed = [
      ...document.querySelectorAll<HTMLButtonElement>(".cc-swatch"),
    ].filter(
      (swatch) =>
        (swatch.getAttribute("aria-label") ?? "").trim() === "" &&
        swatch.textContent?.trim() === "",
    );
    expect(unnamed).toEqual([]);
  });
});
