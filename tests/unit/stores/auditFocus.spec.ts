import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import {
  clearAuditOrigin,
  rememberAuditOrigin,
  returnToAuditOrigin,
} from "../../../src/stores/auditFocus";

/**
 * Closing a class detail puts focus back on the audit row it was opened
 * from, once, and only when that row is still in the document and focus
 * has nowhere live to be.
 */

let row: HTMLElement;
let scrollIntoView: Mock<Element["scrollIntoView"]>;

beforeEach(() => {
  row = document.createElement("div");
  row.tabIndex = 0;
  document.body.append(row);
  // jsdom has no layout, so no scrollIntoView to call.
  scrollIntoView = vi.fn<Element["scrollIntoView"]>();
  row.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  clearAuditOrigin();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("returnToAuditOrigin", () => {
  it("focuses the remembered row without scrolling, then brings it into view", () => {
    const focus = vi.spyOn(row, "focus");
    rememberAuditOrigin(row);

    returnToAuditOrigin();

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(row);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("returns once, then forgets the row", () => {
    rememberAuditOrigin(row);
    returnToAuditOrigin();
    row.blur();

    returnToAuditOrigin();

    expect(document.activeElement).toBe(document.body);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a row that left the document", () => {
    rememberAuditOrigin(row);
    // A road switch or a removed program unmounts the row.
    row.remove();

    expect(() => returnToAuditOrigin()).not.toThrow();
    expect(document.activeElement).toBe(document.body);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("leaves focus where the student moved it", () => {
    const card = document.createElement("button");
    document.body.append(card);
    rememberAuditOrigin(row);
    card.focus();

    returnToAuditOrigin();

    expect(document.activeElement).toBe(card);
    expect(scrollIntoView).not.toHaveBeenCalled();
    // The row is forgotten all the same.
    card.blur();
    returnToAuditOrigin();
    expect(document.activeElement).toBe(document.body);
  });

  it("does nothing after the origin is cleared, or with none", () => {
    returnToAuditOrigin();
    rememberAuditOrigin(null);
    returnToAuditOrigin();
    rememberAuditOrigin(row);
    clearAuditOrigin();
    returnToAuditOrigin();

    expect(document.activeElement).toBe(document.body);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
