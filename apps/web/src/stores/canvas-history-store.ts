import { create } from 'zustand';
import { HISTORY_LIMIT } from '@/lib/canvas/constants';
import type { WhiteboardElement } from '@whiteboard/shared';

interface CanvasHistoryState {
  past: WhiteboardElement[][];
  future: WhiteboardElement[][];
  maxEntries: number;
  /** Records a pre-mutation snapshot; branching clears the redo stack. */
  push: (snapshot: WhiteboardElement[]) => void;
  undo: () => WhiteboardElement[] | null;
  redo: () => WhiteboardElement[] | null;
  reset: () => void;
}

/**
 * Session undo/redo over element snapshots (ADR-0005 keeps server snapshots
 * separate; this store only models in-session history). Stores are immutable,
 * so snapshots are cheap references — no deep copies needed.
 */
export const useCanvasHistoryStore = create<CanvasHistoryState>()(
  (set, get) => ({
    past: [],
    future: [],
    maxEntries: HISTORY_LIMIT,
    push: (snapshot) =>
      set((state) => {
        const past = [...state.past, snapshot];
        if (past.length > state.maxEntries) {
          past.splice(0, past.length - state.maxEntries);
        }
        return { past, future: [] };
      }),
    undo: () => {
      const { past, future } = get();
      const previous = past[past.length - 1];
      if (previous === undefined) {
        return null;
      }
      set({
        past: past.slice(0, -1),
        future: [...future, previous],
      });
      return previous;
    },
    redo: () => {
      const { past, future } = get();
      const next = future[future.length - 1];
      if (next === undefined) {
        return null;
      }
      set({
        past: [...past, next],
        future: future.slice(0, -1),
      });
      return next;
    },
    reset: () => set({ past: [], future: [] }),
  }),
);

export const selectCanvasCanUndo = (state: CanvasHistoryState): boolean =>
  state.past.length > 0;
export const selectCanvasCanRedo = (state: CanvasHistoryState): boolean =>
  state.future.length > 0;
