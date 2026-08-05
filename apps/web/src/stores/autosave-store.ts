import type { WhiteboardDocument } from '@whiteboard/shared';
import { create } from 'zustand';

export type AutosaveStatus =
  'idle' | 'dirty' | 'saving' | 'saved' | 'offline' | 'error';

interface AutosaveState {
  status: AutosaveStatus;
  /** Server revision the current document is based on (last acknowledged save). */
  revision: number | null;
  lastSavedAt: number | null;
  error: string | null;
  /**
   * The document the canvas currently matches (either loaded from the server
   * or last persisted). Used to decide whether a canvas change is dirty.
   */
  lastSavedDocument: WhiteboardDocument | null;
  markDirty: () => void;
  setSaving: () => void;
  setSaved: (revision: number) => void;
  setOffline: () => void;
  setError: (message: string) => void;
  setRevision: (revision: number) => void;
  setLastSavedDocument: (document: WhiteboardDocument | null) => void;
  /** Marks the board freshly loaded at the given server revision. */
  setLoaded: (revision: number, document: WhiteboardDocument | null) => void;
  reset: () => void;
}

/**
 * Persistence status for the active board's autosave pipeline. `revision` is
 * the optimistic-concurrency base the next save is validated against; it only
 * advances when the server acknowledges a save (or a `board:revision` event
 * while the board is clean).
 */
export const useAutosaveStore = create<AutosaveState>()((set) => ({
  status: 'idle',
  revision: null,
  lastSavedAt: null,
  error: null,
  lastSavedDocument: null,
  markDirty: () =>
    set((state) => ({
      status: state.status === 'saving' ? state.status : 'dirty',
      error: null,
    })),
  setSaving: () => set({ status: 'saving' }),
  setSaved: (revision) =>
    set({ status: 'saved', revision, lastSavedAt: Date.now(), error: null }),
  setOffline: () => set({ status: 'offline', error: null }),
  setError: (message) => set({ status: 'error', error: message }),
  setRevision: (revision) => set({ revision }),
  setLastSavedDocument: (lastSavedDocument) => set({ lastSavedDocument }),
  setLoaded: (revision, lastSavedDocument) =>
    set({
      status: 'saved',
      revision,
      lastSavedDocument,
      lastSavedAt: Date.now(),
      error: null,
    }),
  reset: () =>
    set({
      status: 'idle',
      revision: null,
      lastSavedAt: null,
      error: null,
      lastSavedDocument: null,
    }),
}));

export const selectAutosaveStatus = (state: AutosaveState): AutosaveStatus =>
  state.status;
export const selectAutosaveRevision = (state: AutosaveState): number | null =>
  state.revision;
export const selectAutosaveError = (state: AutosaveState): string | null =>
  state.error;
export const selectAutosaveLastSavedAt = (
  state: AutosaveState,
): number | null => state.lastSavedAt;
