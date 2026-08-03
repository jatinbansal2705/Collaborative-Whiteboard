import { create } from 'zustand';
import type { PresenceMember } from '@whiteboard/shared';

export type RealtimeConnectionStatus =
  'disconnected' | 'connecting' | 'connected';

export interface RemoteCursor {
  x: number;
  y: number;
  updatedAt: number;
}

interface RealtimeState {
  connectionStatus: RealtimeConnectionStatus;
  boardId: string | null;
  presence: PresenceMember[];
  cursors: Record<string, RemoteCursor>;
  setConnectionStatus: (status: RealtimeConnectionStatus) => void;
  setBoardId: (boardId: string | null) => void;
  setPresence: (presence: PresenceMember[]) => void;
  upsertCursor: (
    userId: string,
    position: Omit<RemoteCursor, 'updatedAt'>,
  ) => void;
  removeCursor: (userId: string) => void;
  clear: () => void;
}

/**
 * Realtime session state. The socket connection itself is established by the
 * realtime client (Phase 12); this store is the single source for connection
 * status, presence roster, and remote cursors.
 */
export const useRealtimeStore = create<RealtimeState>()((set) => ({
  connectionStatus: 'disconnected',
  boardId: null,
  presence: [],
  cursors: {},
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setBoardId: (boardId) => set({ boardId }),
  setPresence: (presence) => set({ presence }),
  upsertCursor: (userId, position) =>
    set((state) => ({
      cursors: {
        ...state.cursors,
        [userId]: { ...position, updatedAt: Date.now() },
      },
    })),
  removeCursor: (userId) =>
    set((state) => {
      const cursors = { ...state.cursors };
      delete cursors[userId];
      return { cursors };
    }),
  clear: () =>
    set({
      connectionStatus: 'disconnected',
      boardId: null,
      presence: [],
      cursors: {},
    }),
}));

export const selectConnectionStatus = (
  state: RealtimeState,
): RealtimeConnectionStatus => state.connectionStatus;
export const selectPresence = (state: RealtimeState): PresenceMember[] =>
  state.presence;
export const selectCursors = (
  state: RealtimeState,
): Record<string, RemoteCursor> => state.cursors;
export const selectActiveBoardId = (state: RealtimeState): string | null =>
  state.boardId;
