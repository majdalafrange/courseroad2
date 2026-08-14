import { beforeEach, describe, expect, it } from "vitest";
import { history } from "../../../src/stores/history";

beforeEach(() => {
  history.clear();
});

describe("history.drop", () => {
  it("removes a buried entry by identity", () => {
    // The road-delete toast restores out-of-band when its entry is no
    // longer on top; the buried entry must leave the stack, or a later
    // redo replays the deletion.
    history.record(
      "Deleted road",
      () => {},
      () => {},
    );
    const deletion = history.state.undoStack[0];
    history.record(
      "Added 6.006",
      () => {},
      () => {},
    );
    history.drop(deletion);
    expect(history.state.undoStack.map((e) => e.label)).toEqual([
      "Added 6.006",
    ]);
  });

  it("is a no-op for an entry no longer present", () => {
    history.record(
      "Deleted road",
      () => {},
      () => {},
    );
    const deletion = history.state.undoStack[0];
    history.undo();
    expect(() => history.drop(deletion)).not.toThrow();
    expect(history.canRedo).toBe(true);
  });

  it("leaves undo/redo working around the removal", () => {
    let value = 0;
    history.record(
      "first",
      () => (value -= 1),
      () => (value += 1),
    );
    const first = history.state.undoStack[0];
    history.record(
      "second",
      () => (value -= 10),
      () => (value += 10),
    );
    history.drop(first);
    expect(history.undo()).toBe("second");
    expect(value).toBe(-10);
    expect(history.undo()).toBeUndefined();
  });
});
