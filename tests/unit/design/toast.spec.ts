import { afterEach, describe, expect, it } from "vitest";
import { toast } from "../../../src/design/toast";

afterEach(() => {
  while (toast.state.toasts.length > 0) {
    toast.dismiss(toast.state.toasts[0].id);
  }
});

describe("toast service", () => {
  it("keeps three open, evicting a plain toast before an undoable one", () => {
    toast.undoable("Deleted road", () => {});
    toast.ok("Saved");
    toast.warn("Heavy term");
    toast.ok("Saved again");

    expect(toast.state.toasts.map((t) => t.message)).toEqual([
      "Deleted road",
      "Heavy term",
      "Saved again",
    ]);
  });

  it("forgets a dismissed toast", () => {
    const id = toast.show("Copied");
    toast.dismiss(id);
    expect(toast.state.toasts).toHaveLength(0);
  });
});
