import { create } from 'zustand';

export interface HistoryEntry {
  id: string;
  data: Record<string, unknown>;
  createdAt: number;
}

interface HistoryState {
  past: HistoryEntry[];
  present: HistoryEntry | null;
  future: HistoryEntry[];
  maxEntries: number;
  push: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  reset: () => void;
}

const DEFAULT_MAX_ENTRIES = 100;

/**
 * Session undo/redo stacks for the canvas (ADR-0005 keeps server-side
 * snapshots separate; this store only models in-session history).
 */
export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  present: null,
  future: [],
  maxEntries: DEFAULT_MAX_ENTRIES,
  push: (entry) =>
    set((state) => {
      const past = [...state.past, state.present].filter(
        (item): item is HistoryEntry => item !== null,
      );
      if (past.length > state.maxEntries) {
        past.splice(0, past.length - state.maxEntries);
      }
      return { past, present: entry, future: [] };
    }),
  undo: () => {
    const { past, present, future } = get();
    const previous = past[past.length - 1];
    if (previous === undefined) {
      return null;
    }
    const nextFuture = present === null ? future : [present, ...future];
    set({
      past: past.slice(0, -1),
      present: previous,
      future: nextFuture,
    });
    return previous;
  },
  redo: () => {
    const { past, present, future } = get();
    const next = future[0];
    if (next === undefined) {
      return null;
    }
    const nextPast = present === null ? past : [...past, present];
    set({
      past: nextPast,
      present: next,
      future: future.slice(1),
    });
    return next;
  },
  reset: () => set({ past: [], present: null, future: [] }),
}));

export const selectCanUndo = (state: HistoryState): boolean =>
  state.past.length > 0;
export const selectCanRedo = (state: HistoryState): boolean =>
  state.future.length > 0;
export const selectPresentEntry = (state: HistoryState): HistoryEntry | null =>
  state.present;
export const selectPastLength = (state: HistoryState): number =>
  state.past.length;
export const selectFutureLength = (state: HistoryState): number =>
  state.future.length;
