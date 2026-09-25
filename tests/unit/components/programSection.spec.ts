// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { ReqListEntry } from "../../../src/lib/types";
import { reqTree, type PartialReqNode } from "../lib/fixtures";

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

/** A program whose progress request failed renders a terminal state with a retry. */

let wrapper: VueWrapper | undefined;

beforeEach(() => {
  setActivePinia(createPinia());
  mocks.getProgress.mockReset();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

function listEntry(
  key: string,
  mediumTitle: string,
  titleNoDegree: string,
): ReqListEntry {
  return {
    key,
    "short-title": key,
    "medium-title": mediumTitle,
    title: mediumTitle,
    "title-no-degree": titleNoDegree,
  };
}

describe("ProgramSection failure state", () => {
  it("shows the failed state and retries the one program", async () => {
    const audit = useAuditStore();
    audit.failedPrograms = { major18: true };
    mocks.getProgress.mockResolvedValue({ data: { fulfilled: false } });

    wrapper = mount(ProgramSection, {
      props: { programKey: "major18", tree: null },
    });
    expect(wrapper.text()).toContain("Progress didn't load");
    expect(wrapper.text()).not.toContain("Computing...");

    await wrapper.find('[data-cy="programRetryButton"]').trigger("click");
    // The retry recomputes exactly this program (the default road exists,
    // so the request goes out immediately).
    expect(mocks.getProgress).toHaveBeenCalledTimes(1);
    expect(mocks.getProgress.mock.calls[0][0]).toBe("major18");
  });

  it("keeps 'computing...' for a program still in flight", () => {
    wrapper = mount(ProgramSection, {
      props: { programKey: "major6-3", tree: null },
    });
    expect(wrapper.text()).toContain("Computing...");
    expect(wrapper.text()).not.toContain("Progress didn't load");
  });
});

/**
 * The header's sub-label names the state the tree is in. "Computing..."
 * belongs to a program whose tree has not arrived; once it has, a percent
 * FireRoad reports as "N/A", or one that is not a number, is not stated,
 * and the ring draws no arc for it.
 */
describe("ProgramSection sub-label", () => {
  function subLabel(tree: PartialReqNode | null) {
    wrapper = mount(ProgramSection, {
      props: {
        programKey: "major6-2",
        tree: tree === null ? null : reqTree(tree),
      },
    });
    return wrapper.find(".program-sub").text();
  }

  it("states nothing for an N/A percent once the tree has arrived", () => {
    expect(subLabel({ percent_fulfilled: "N/A", reqs: [] })).toBe("");
  });

  it("never states NaN for a percent that is not a number", () => {
    expect(
      subLabel({ percent_fulfilled: "unknown" as unknown as number, reqs: [] }),
    ).toBe("");
  });

  it("still states a numeric percent, and Complete over it", () => {
    expect(subLabel({ percent_fulfilled: 41.6, reqs: [] })).toBe(
      "42% complete",
    );
    wrapper?.unmount();
    expect(subLabel({ percent_fulfilled: 97, fulfilled: true, reqs: [] })).toBe(
      "Complete",
    );
  });

  it("draws no arc for a percent it does not state", () => {
    // A NaN dash array is invalid and would draw the full ring.
    subLabel({ percent_fulfilled: "unknown" as unknown as number, reqs: [] });
    const dash = wrapper
      ?.find(".program-ring circle[stroke-dasharray]")
      .attributes("stroke-dasharray");
    expect(Number(dash?.split(" ")[0])).toBe(0);
  });
});

describe("ProgramSection official link", () => {
  it("links the program's official page from its definition", () => {
    const audit = useAuditStore();
    audit.reqList = [listEntry("minor6", "6 Minor", "Computer Science")];
    audit.programUrls = { minor6: "https://www.eecs.mit.edu/csminor" };
    wrapper = mount(ProgramSection, {
      props: {
        programKey: "minor6",
        tree: reqTree({ reqs: [] }),
        startOpen: true,
      },
    });
    const link = wrapper.find('a[href="https://www.eecs.mit.edu/csminor"]');
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain("Official 6 Minor requirements");
  });
});

describe("ProgramSection titles", () => {
  it("names the program from the requirements list, with its subtitle", () => {
    useAuditStore().reqList = [
      listEntry("major6-3", "6-3 Major", "Computer Science"),
    ];
    wrapper = mount(ProgramSection, {
      props: { programKey: "major6-3", tree: null },
    });
    expect(wrapper.find(".program-title").text()).toBe("6-3 Major");
    expect(wrapper.find(".program-name").text()).toBe("Computer Science");
  });

  it("falls back to the key, with no subtitle, before the list loads", () => {
    wrapper = mount(ProgramSection, {
      props: { programKey: "major6-3", tree: null },
    });
    expect(wrapper.find(".program-title").text()).toBe("major6-3");
    expect(wrapper.find(".program-name").exists()).toBe(false);
  });

  it("shows no subtitle for a program without one", () => {
    useAuditStore().reqList = [listEntry("girs", "GIRs", "")];
    wrapper = mount(ProgramSection, {
      props: { programKey: "girs", tree: null },
    });
    expect(wrapper.find(".program-name").exists()).toBe(false);
  });
});

describe("ProgramSection expand all", () => {
  it("offers Expand all while its groups start closed, then Collapse all", async () => {
    const tree = reqTree({
      "list-id": "major6-3",
      reqs: [
        { "list-id": "major6-3.0", reqs: [{ req: "6.1010" }] },
        { "list-id": "major6-3.1", reqs: [{ req: "6.1200" }] },
      ],
    });
    wrapper = mount(ProgramSection, {
      props: { programKey: "major6-3", tree, startOpen: true },
    });
    const toggle = () => wrapper!.find(".program-expandall");
    expect(toggle().text()).toBe("Expand all");
    expect(wrapper.findAll(".branch-row .branch-chevron")).toHaveLength(2);
    expect(wrapper.text()).not.toContain("6.1010");

    await toggle().trigger("click");
    expect(toggle().text()).toBe("Collapse all");
    expect(wrapper.text()).toContain("6.1010");
  });
});
