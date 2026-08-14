// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const mocks = vi.hoisted(() => ({
  getProgress: vi.fn(),
}));

vi.mock("../../../src/stores/fireroadClient", () => ({
  setFireroadToken: vi.fn(),
  fireroad: {
    getProgress: mocks.getProgress,
  },
}));

import ProgramSection from "../../../src/components/audit/ProgramSection.vue";
import { useAuditStore } from "../../../src/stores/audit";

/**
 * A program whose progress request failed renders a terminal state with
 * a retry, instead of reading "computing…" forever (N9).
 */

let wrapper: VueWrapper | undefined;

beforeEach(() => {
  setActivePinia(createPinia());
  mocks.getProgress.mockReset();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("ProgramSection failure state", () => {
  it("shows the failed state and retries the one program", async () => {
    const audit = useAuditStore();
    audit.failedPrograms = { major18: true };
    mocks.getProgress.mockResolvedValue({ data: { fulfilled: false } });

    wrapper = mount(ProgramSection, {
      props: { programKey: "major18", tree: null, title: "18 Major" },
    });
    expect(wrapper.text()).toContain("progress didn't load");
    expect(wrapper.text()).not.toContain("computing…");

    await wrapper.find('[data-cy="programRetryButton"]').trigger("click");
    // The retry recomputes exactly this program (the default road exists,
    // so the request goes out immediately).
    expect(mocks.getProgress).toHaveBeenCalledTimes(1);
    expect(mocks.getProgress.mock.calls[0][0]).toBe("major18");
  });

  it("keeps 'computing…' for a program still in flight", () => {
    wrapper = mount(ProgramSection, {
      props: { programKey: "major6-3", tree: null, title: "6-3 Major" },
    });
    expect(wrapper.text()).toContain("computing…");
    expect(wrapper.text()).not.toContain("progress didn't load");
  });
});
