// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import SuggestionStrip from "../../../src/components/audit/SuggestionStrip.vue";
import { useAuditStore } from "../../../src/stores/audit";
import { useCourseDataStore } from "../../../src/stores/courseData";
import type { RequirementNode, Subject } from "../../../src/lib/types";
import { makeSubject } from "../lib/fixtures";

/**
 * The strip's explanation control: present next to the heading, opens the
 * popover naming the mechanism, and Escape closes one layer.
 */

let wrapper: VueWrapper | undefined;

/** A catalog subject that fills HASS-A in any target season. */
const hassSubject: Subject = makeSubject({
  subject_id: "21M.301",
  title: "Harmony and Counterpoint I",
  hass_attribute: "HASS-A",
  offered_fall: true,
  offered_IAP: true,
  offered_spring: true,
  rating: 6.5,
  in_class_hours: 3,
  out_of_class_hours: 6,
});

/** One program tree with a single open HASS-A leaf. */
const openHassTree: RequirementNode = {
  reqs: [{ req: "HASS-A", fulfilled: false } as RequirementNode],
} as RequirementNode;

beforeEach(() => {
  setActivePinia(createPinia());
  const courseData = useCourseDataStore();
  courseData.subjectsInfo = [hassSubject];
  const audit = useAuditStore();
  audit.reqTrees = { "major6-3": openHassTree };
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = "";
});

describe("SuggestionStrip explanation control", () => {
  it("opens the explanation and closes it on Escape", async () => {
    wrapper = mount(SuggestionStrip, { attachTo: document.body });

    // the fixture gap renders the strip at all
    expect(wrapper.text()).toContain("Suggestions");

    const control = wrapper.get('[data-cy="suggestionsInfo"]');
    expect(control.attributes("aria-label")).toBe(
      "How suggestions are produced",
    );
    expect(control.attributes("aria-expanded")).toBe("false");

    await control.trigger("click");
    const popover = document.querySelector(".g-popover");
    expect(popover).not.toBeNull();
    // the copy names the mechanism and the one network dependency
    expect(popover?.textContent).toContain("fixed rules");
    expect(popover?.textContent).toContain("FireRoad");
    expect(control.attributes("aria-expanded")).toBe("true");

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
    );
    await nextTick();
    expect(document.querySelector(".g-popover")).toBeNull();
  });
});
