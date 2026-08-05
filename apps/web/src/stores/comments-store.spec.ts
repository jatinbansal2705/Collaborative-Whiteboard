import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectActiveThreadId,
  selectCommentThreads,
  useCommentsStore,
} from '@/stores/comments-store';
import type { CommentThread } from '@/types/comment';

function thread(id: string, createdAt: string): CommentThread {
  return {
    id,
    boardId: 'board-1',
    x: 0,
    y: 0,
    resolvedAt: null,
    resolvedBy: null,
    resolvedByUser: null,
    createdAt,
    updatedAt: createdAt,
    comments: [],
  } as CommentThread;
}

function resetStore(): void {
  useCommentsStore.setState({ threads: [], activeThreadId: null });
}

beforeEach(() => {
  resetStore();
});

describe('comments store', () => {
  it('starts empty', () => {
    expect(selectCommentThreads(useCommentsStore.getState())).toEqual([]);
    expect(selectActiveThreadId(useCommentsStore.getState())).toBeNull();
  });

  it('sorts threads by createdAt and replaces on set', () => {
    useCommentsStore
      .getState()
      .setThreads([
        thread('b', '2026-01-02T00:00:00.000Z'),
        thread('a', '2026-01-01T00:00:00.000Z'),
      ]);
    const ids = selectCommentThreads(useCommentsStore.getState()).map(
      (entry) => entry.id,
    );
    expect(ids).toEqual(['a', 'b']);
  });

  it('upserts a new thread and replaces an existing one', () => {
    useCommentsStore
      .getState()
      .upsertThread(thread('a', '2026-01-01T00:00:00.000Z'));
    useCommentsStore
      .getState()
      .upsertThread({ ...thread('a', '2026-01-01T00:00:00.000Z'), x: 42 });
    const threads = selectCommentThreads(useCommentsStore.getState());
    expect(threads).toHaveLength(1);
    expect(threads[0].x).toBe(42);
  });

  it('resolves and reopens threads', () => {
    useCommentsStore
      .getState()
      .setThreads([thread('a', '2026-01-01T00:00:00.000Z')]);
    useCommentsStore
      .getState()
      .setResolved('a', true, 'user-2', '2026-01-03T00:00:00.000Z');
    let resolved = selectCommentThreads(useCommentsStore.getState())[0];
    expect(resolved.resolvedAt).toBe('2026-01-03T00:00:00.000Z');
    expect(resolved.resolvedBy).toBe('user-2');

    useCommentsStore.getState().setResolved('a', false, null, null);
    resolved = selectCommentThreads(useCommentsStore.getState())[0];
    expect(resolved.resolvedAt).toBeNull();
    expect(resolved.resolvedBy).toBeNull();
  });

  it('tracks the active thread and clears all state', () => {
    useCommentsStore.getState().setActiveThread('a');
    expect(selectActiveThreadId(useCommentsStore.getState())).toBe('a');
    useCommentsStore
      .getState()
      .setThreads([thread('a', '2026-01-01T00:00:00.000Z')]);
    useCommentsStore.getState().setActiveThread('a');
    useCommentsStore.getState().clear();
    expect(selectCommentThreads(useCommentsStore.getState())).toEqual([]);
    expect(selectActiveThreadId(useCommentsStore.getState())).toBeNull();
  });
});
