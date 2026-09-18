/**
 * Undo/redo service: every user-initiated road mutation records an
 * inverse pair here; ⌘Z/⌘⇧Z walk the stacks. Destructive actions are
 * confirmed with undo, never dialogs. Plain reactive module (not Pinia)
 * so courseData can import it without store cycles.
 */

import { reactive } from "vue";

export interface HistoryEntry {
  /** Human-readable, toast-friendly: "Added 6.006 to Sophomore Fall". */
  label: string;
  undo: () => void;
  redo: () => void;
  /**
   * The road this entry edits, captured at record time. Undo/redo focuses
   * it before replaying so the edit is visible.
   */
  roadID?: string;
}

/**
 * Focus hook: switches to the road an entry edits before it replays.
 * Registered by courseData, which owns road-key aliasing and imports this
 * module, so the dependency cannot point the other way.
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
   * Remove an entry by identity. For toast undo paths that restore out of
   * band: the entry must not stay armed, or a later redo replays it.
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
