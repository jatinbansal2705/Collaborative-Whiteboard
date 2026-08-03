import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectBoards,
  selectCurrentBoard,
  selectHasNextPage,
  selectNextCursor,
  useBoardStore,
} from '@/stores/board-store';
import type { BoardDetail, BoardListResult, BoardSummary } from '@/types/board';

function summary(id: string, title: string): BoardSummary {
  return {
    id,
    title,
    thumbnailUrl: null,
    isTemplate: false,
    isArchived: false,
    status: 'ACTIVE',
    memberCount: 1,
    isFavourite: false,
    myRole: 'OWNER',
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function listResult(
  boards: BoardSummary[],
  nextCursor: string | null = null,
  hasNextPage = false,
): BoardListResult {
  return {
    data: boards,
    meta: {
      hasNextPage,
      hasPrevPage: false,
      nextCursor,
      prevCursor: null,
    },
  };
}

function resetStore(): void {
  useBoardStore.setState({
    boards: [],
    hasNextPage: false,
    nextCursor: null,
    isLoading: false,
    error: null,
    currentBoard: null,
  });
}

beforeEach(() => {
  resetStore();
});

describe('board store', () => {
  it('starts empty', () => {
    const state = useBoardStore.getState();
    expect(selectBoards(state)).toEqual([]);
    expect(selectCurrentBoard(state)).toBeNull();
    expect(selectHasNextPage(state)).toBe(false);
    expect(selectNextCursor(state)).toBeNull();
  });

  it('setBoards replaces the list and pagination state', () => {
    useBoardStore
      .getState()
      .setBoards(listResult([summary('b1', 'Board 1')], 'cursor-2', true));

    const state = useBoardStore.getState();
    expect(selectBoards(state).map((b) => b.id)).toEqual(['b1']);
    expect(selectHasNextPage(state)).toBe(true);
    expect(selectNextCursor(state)).toBe('cursor-2');
  });

  it('appendBoards concatenates results and updates pagination', () => {
    useBoardStore
      .getState()
      .setBoards(listResult([summary('b1', 'Board 1')], 'cursor-2', true));
    useBoardStore
      .getState()
      .appendBoards(listResult([summary('b2', 'Board 2')], null, false));

    const state = useBoardStore.getState();
    expect(selectBoards(state).map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(selectHasNextPage(state)).toBe(false);
    expect(selectNextCursor(state)).toBeNull();
  });

  it('upsertBoard prepends a new board', () => {
    useBoardStore.getState().upsertBoard(summary('b1', 'New'));

    expect(selectBoards(useBoardStore.getState()).map((b) => b.id)).toEqual([
      'b1',
    ]);
  });

  it('upsertBoard replaces an existing board in place', () => {
    useBoardStore.getState().upsertBoard(summary('b1', 'Old'));
    useBoardStore
      .getState()
      .upsertBoard({ ...summary('b1', 'Renamed'), isFavourite: true });

    const boards = selectBoards(useBoardStore.getState());
    expect(boards).toHaveLength(1);
    expect(boards[0].title).toBe('Renamed');
    expect(boards[0].isFavourite).toBe(true);
  });

  it('removeBoard deletes by id', () => {
    useBoardStore
      .getState()
      .setBoards(listResult([summary('b1', 'A'), summary('b2', 'B')]));

    useBoardStore.getState().removeBoard('b1');

    expect(selectBoards(useBoardStore.getState()).map((b) => b.id)).toEqual([
      'b2',
    ]);
  });

  it('setCurrentBoard stores the detail payload', () => {
    const detail: BoardDetail = { ...summary('b1', 'Detail'), data: { el: 1 } };

    useBoardStore.getState().setCurrentBoard(detail);

    expect(selectCurrentBoard(useBoardStore.getState())).toEqual(detail);
  });

  it('patchBoard updates fields of a single board in place', () => {
    useBoardStore
      .getState()
      .setBoards(listResult([summary('b1', 'A'), summary('b2', 'B')]));

    useBoardStore
      .getState()
      .patchBoard('b1', { isFavourite: true, isArchived: true });

    const boards = selectBoards(useBoardStore.getState());
    expect(boards).toHaveLength(2);
    expect(boards[0].isFavourite).toBe(true);
    expect(boards[0].isArchived).toBe(true);
    expect(boards[1].isFavourite).toBe(false);
  });

  it('patchBoard is a no-op for an unknown id', () => {
    useBoardStore.getState().setBoards(listResult([summary('b1', 'A')]));

    useBoardStore.getState().patchBoard('missing', { title: 'Nope' });

    expect(selectBoards(useBoardStore.getState())[0].title).toBe('A');
  });

  it('reset restores the initial state', () => {
    useBoardStore
      .getState()
      .setBoards(listResult([summary('b1', 'A')], 'c', true));
    useBoardStore
      .getState()
      .setCurrentBoard({ ...summary('b1', 'A'), data: null });

    useBoardStore.getState().reset();

    const state = useBoardStore.getState();
    expect(selectBoards(state)).toEqual([]);
    expect(selectCurrentBoard(state)).toBeNull();
    expect(selectHasNextPage(state)).toBe(false);
  });
});
