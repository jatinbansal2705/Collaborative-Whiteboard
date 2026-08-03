import { create } from 'zustand';
import type { BoardDetail, BoardListResult, BoardSummary } from '@/types/board';

interface BoardState {
  boards: BoardSummary[];
  hasNextPage: boolean;
  nextCursor: string | null;
  isLoading: boolean;
  error: string | null;
  currentBoard: BoardDetail | null;
  setBoards: (result: BoardListResult) => void;
  appendBoards: (result: BoardListResult) => void;
  setCurrentBoard: (board: BoardDetail | null) => void;
  upsertBoard: (board: BoardSummary) => void;
  removeBoard: (id: string) => void;
  patchBoard: (id: string, patch: Partial<BoardSummary>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/** Dashboard + active board cache for the current session. */
export const useBoardStore = create<BoardState>()((set) => ({
  boards: [],
  hasNextPage: false,
  nextCursor: null,
  isLoading: false,
  error: null,
  currentBoard: null,
  setBoards: (result) =>
    set({
      boards: result.data,
      hasNextPage: result.meta.hasNextPage,
      nextCursor: result.meta.nextCursor,
      error: null,
      isLoading: false,
    }),
  appendBoards: (result) =>
    set((state) => ({
      boards: [...state.boards, ...result.data],
      hasNextPage: result.meta.hasNextPage,
      nextCursor: result.meta.nextCursor,
      error: null,
      isLoading: false,
    })),
  setCurrentBoard: (board) => set({ currentBoard: board }),
  upsertBoard: (board) =>
    set((state) => {
      const index = state.boards.findIndex((entry) => entry.id === board.id);
      if (index === -1) {
        return { boards: [board, ...state.boards] };
      }
      const boards = [...state.boards];
      boards[index] = board;
      return { boards };
    }),
  removeBoard: (id) =>
    set((state) => ({
      boards: state.boards.filter((board) => board.id !== id),
    })),
  patchBoard: (id, patch) =>
    set((state) => ({
      boards: state.boards.map((board) =>
        board.id === id ? { ...board, ...patch } : board,
      ),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () =>
    set({
      boards: [],
      hasNextPage: false,
      nextCursor: null,
      isLoading: false,
      error: null,
      currentBoard: null,
    }),
}));

export const selectBoards = (state: BoardState): BoardSummary[] => state.boards;
export const selectCurrentBoard = (state: BoardState): BoardDetail | null =>
  state.currentBoard;
export const selectBoardsLoading = (state: BoardState): boolean =>
  state.isLoading;
export const selectBoardsError = (state: BoardState): string | null =>
  state.error;
export const selectHasNextPage = (state: BoardState): boolean =>
  state.hasNextPage;
export const selectNextCursor = (state: BoardState): string | null =>
  state.nextCursor;
