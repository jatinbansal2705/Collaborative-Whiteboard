import { create } from 'zustand';
import type { CommentThread } from '@/types/comment';

interface CommentsState {
  threads: CommentThread[];
  /** Thread the user asked to focus (scrolled to / expanded). */
  activeThreadId: string | null;
  setThreads: (threads: CommentThread[]) => void;
  upsertThread: (thread: CommentThread) => void;
  setResolved: (
    threadId: string,
    resolved: boolean,
    resolvedBy: string | null,
    resolvedAt: string | null,
  ) => void;
  setActiveThread: (threadId: string | null) => void;
  clear: () => void;
}

/** Comment threads for the current board session. */
export const useCommentsStore = create<CommentsState>()((set) => ({
  threads: [],
  activeThreadId: null,
  setThreads: (threads) =>
    set({ threads: sortThreads(threads), activeThreadId: null }),
  upsertThread: (thread) =>
    set((state) => {
      const exists = state.threads.some((entry) => entry.id === thread.id);
      const threads = exists
        ? state.threads.map((entry) =>
            entry.id === thread.id ? thread : entry,
          )
        : [...state.threads, thread];
      return { threads: sortThreads(threads) };
    }),
  setResolved: (threadId, resolved, resolvedBy, resolvedAt) =>
    set((state) => ({
      threads: state.threads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              resolvedAt: resolved ? resolvedAt : null,
              resolvedBy: resolved ? resolvedBy : null,
              resolvedByUser: resolved ? thread.resolvedByUser : null,
            }
          : thread,
      ),
    })),
  setActiveThread: (activeThreadId) => set({ activeThreadId }),
  clear: () => set({ threads: [], activeThreadId: null }),
}));

function sortThreads(threads: CommentThread[]): CommentThread[] {
  return [...threads].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

export const selectCommentThreads = (state: CommentsState): CommentThread[] =>
  state.threads;
export const selectActiveThreadId = (state: CommentsState): string | null =>
  state.activeThreadId;
