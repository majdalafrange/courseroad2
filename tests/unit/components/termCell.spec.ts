// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TermCell from "../../../src/components/canvas/TermCell.vue";
import { termYearLabel } from "../../../src/lib/offering";
import { emptySelectedSubjects } from "../../../src/lib/roads";

/**
 * Placement targets name their term (F7). Every target read "Add here"
 * from its visible text, so a screen reader heard fifteen identical
 * buttons and the term was recoverable only from the enclosing region.
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

function mountCell(
  placementStatusKind: "ok" | "maybe",
  index: number,
): VueWrapper {
  return mount(TermCell, {
    props: {
      index,
      roadID: "$0$",
      subjects: [],
      allSubjects: emptySelectedSubjects(),
      baseYear: 2026,
      placementStatusKind,
      moveSource: null,
      moveTarget: false,
    },
    attachTo: document.body,
  });
}

describe("TermCell placement target", () => {
  it("carries its term in the accessible name (F7)", () => {
    wrapper = mountCell("ok", 4);
    const slot = document.querySelector<HTMLButtonElement>(".place-slot");
    expect(slot).not.toBeNull();
    expect(slot?.getAttribute("aria-label")).toBe(
      `Add to ${termYearLabel(4, 2026)}`,
    );
  });

  it("keeps the offering caveat alongside the term", () => {
    wrapper = mountCell("maybe", 7);
    const slot = document.querySelector<HTMLButtonElement>(".place-slot");
    expect(slot?.getAttribute("aria-label")).toBe(
      `May not be offered. Add to ${termYearLabel(7, 2026)} anyway`,
    );
  });
});
