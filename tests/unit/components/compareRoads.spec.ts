// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CompareRoads from "../../../src/components/sheets/CompareRoads.vue";
import { newRoad } from "../../../src/lib/roads";
import { useCourseDataStore } from "../../../src/stores/courseData";

let wrapper: VueWrapper | undefined;

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

describe("CompareRoads", () => {
  // The shell lazy-loads this sheet, so a slow chunk mounts it already
  // open; the pickers must be filled then too, not only on open.
  it("picks two roads when it mounts already open", async () => {
    const store = useCourseDataStore();
    // The store starts with the default road, so this makes two.
    store.setRoad({ id: "a", road: newRoad("Road A"), ignoreSet: true });
    store.setActiveRoad("a");
    const other =
      store.roads[Object.keys(store.roads).find((id) => id !== "a")!];

    const errors: unknown[] = [];
    wrapper = mount(CompareRoads, {
      props: { modelValue: true },
      attachTo: document.body,
      global: {
        config: {
          errorHandler: (error) => {
            errors.push(error);
          },
        },
      },
    });
    await wrapper.vm.$nextTick();

    expect(errors).toEqual([]);
    expect(document.body.textContent).toContain("Only in Road A");
    expect(document.body.textContent).toContain(`Only in ${other.name}`);
  });
});
