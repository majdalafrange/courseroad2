/**
 * Undo/redo service: a store-level history of road mutations.
 *
 * Every user-initiated road mutation (class add/move/remove, road
 * create/delete/rename, program add/remove, petitions, manual progress)
 * records an inverse pair here. ⌘Z / ⌘⇧Z walk the stacks. This service is
 * load-bearing for the whole product: destructive actions are "confirmed"
 * with undo, never with dialogs.
 *
 * A plain reactive module (not Pinia) so courseData can import it without
 * store-in-store cycles.
 */

import { reactive } from "vue";

export interface HistoryEntry {
  /** Human-readable, toast-friendly: "Added 6.006 to Sophomore Fall". */
  label: string;
  undo: () => void;
  redo: () => void;
  /**
   * The road this entry edits, as captured at record time. Undo/redo
   * focuses it (via the hook below) before replaying, so a replayed edit
   * is always on the road the student is looking at, never an invisible
   * mutation of another road.
   */
  roadID?: string;
}

/**
 * Focus hook: switches the app to the road an entry edits before that
 * entry replays. Registered by courseData, which owns road-key aliasing;
 * a setter keeps this module free of store imports (courseData imports
 * this module, so the dependency cannot point the other way).
 */
let focusRoad: (roadID: string) => void = () => {};

export function setHistoryRoadFocus(fn: (roadID: string) => void): void {
  focusRoad = fn;
}

const MAX_ENTRIES = 100;

const state = reactive({
  undoStack: [] as HistoryEntry[],
  redoStack: [] as HistoryEntry[],
  /** True while an undo/redo runs, so replayed actions don't re-record. */
  silenced: false,
});

export const history = {
  state,

  get canUndo(): boolean {
    return state.undoStack.length > 0;
  },

  get canRedo(): boolean {
    return state.redoStack.length > 0;
  },

  /** Next undoable action's label (for tooltips/menus), if any. */
  get undoLabel(): string | undefined {
    return state.undoStack[state.undoStack.length - 1]?.label;
  },

  get redoLabel(): string | undefined {
    return state.redoStack[state.redoStack.length - 1]?.label;
  },

  record(
    label: string,
    undo: () => void,
    redo: () => void,
    roadID?: string,
  ): void {
    if (state.silenced) {
      return;
    }
    state.undoStack.push({ label, undo, redo, roadID });
    if (state.undoStack.length > MAX_ENTRIES) {
      state.undoStack.shift();
    }
    state.redoStack = [];
  },

  /**
   * Remove a recorded entry by identity, wherever it sits in the stack.
   * For toast undo paths that restore state out-of-band: the entry must
   * not stay armed, or a later redo replays a deletion the student
   * already took back. No-op when the entry is absent.
   */
  drop(entry: HistoryEntry): void {
    const index = state.undoStack.indexOf(entry);
    if (index !== -1) {
      state.undoStack.splice(index, 1);
    }
  },

  /** Run fn without recording (used by sync/undo internals). */
  silence<T>(fn: () => T): T {
    const wasSilenced = state.silenced;
    state.silenced = true;
    try {
      return fn();
    } finally {
      state.silenced = wasSilenced;
    }
  },

  undo(): string | undefined {
    const entry = state.undoStack.pop();
    if (entry === undefined) {
      return undefined;
    }
    this.silence(() => {
      if (entry.roadID !== undefined) {
        focusRoad(entry.roadID);
      }
      entry.undo();
    });
    state.redoStack.push(entry);
    return entry.label;
  },

  redo(): string | undefined {
    const entry = state.redoStack.pop();
    if (entry === undefined) {
      return undefined;
    }
    this.silence(() => {
      if (entry.roadID !== undefined) {
        focusRoad(entry.roadID);
      }
      entry.redo();
    });
    state.undoStack.push(entry);
    return entry.label;
  },

  clear(): void {
    state.undoStack = [];
    state.redoStack = [];
  },
};
