import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboard } from '@/hooks/use-dashboard';
import { useBoardStore } from '@/stores/board-store';
import type { BoardListResult, BoardSummary } from '@/types/board';

const {
  listMock,
  createMock,
  updateMock,
  removeMock,
  duplicateMock,
  archiveMock,
  restoreMock,
  setFavouriteMock,
  listTemplatesMock,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  removeMock: vi.fn(),
  duplicateMock: vi.fn(),
  archiveMock: vi.fn(),
  restoreMock: vi.fn(),
  setFavouriteMock: vi.fn(),
  listTemplatesMock: vi.fn(),
}));

vi.mock('@/lib/api/services/board-service', () => ({
  boardService: {
    list: listMock,
    create: createMock,
    update: updateMock,
    remove: removeMock,
    duplicate: duplicateMock,
    archive: archiveMock,
    restore: restoreMock,
    setFavourite: setFavouriteMock,
    listTemplates: listTemplatesMock,
  },
}));

function makeBoard(overrides: Partial<BoardSummary> = {}): BoardSummary {
  return {
    id: 'board-1',
    title: 'Board 1',
    thumbnailUrl: null,
    isTemplate: false,
    isArchived: false,
    status: 'ACTIVE',
    memberCount: 1,
    isFavourite: false,
    myRole: 'OWNER',
    createdById: 'user-1',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function pageOf(boards: BoardSummary[]): BoardListResult {
  return {
    data: boards,
    meta: {
      hasNextPage: false,
      hasPrevPage: false,
      nextCursor: null,
      prevCursor: null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useBoardStore.getState().reset();
  listMock.mockResolvedValue(pageOf([]));
  createMock.mockResolvedValue(makeBoard({ id: 'board-new', title: 'New' }));
  updateMock.mockResolvedValue(makeBoard({ title: 'Renamed' }));
  removeMock.mockResolvedValue({ deleted: true, id: 'board-1' });
  duplicateMock.mockResolvedValue(
    makeBoard({ id: 'board-copy', title: 'Board 1 (copy)' }),
  );
  archiveMock.mockResolvedValue(
    makeBoard({ isArchived: true, status: 'ARCHIVED' }),
  );
  restoreMock.mockResolvedValue(
    makeBoard({ isArchived: false, status: 'ACTIVE' }),
  );
  setFavouriteMock.mockResolvedValue({ boardId: 'board-1', isFavourite: true });
  listTemplatesMock.mockResolvedValue([
    makeBoard({ id: 'tpl-1', title: 'Roadmap', isTemplate: true }),
  ]);
});

describe('useDashboard', () => {
  it('loads boards on mount with the default query', async () => {
    listMock.mockResolvedValue(pageOf([makeBoard()]));
    const { result } = renderHook(() => useDashboard());

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tab: 'recent',
          sortBy: 'updatedAt',
          order: 'desc',
          limit: 20,
        }),
      );
    });
    await waitFor(() => {
      expect(result.current.boards).toHaveLength(1);
    });
  });

  it('refetches when the active tab changes', async () => {
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    act(() => result.current.setActiveTab('shared'));

    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ tab: 'shared' }),
      );
    });
  });

  it('upserts boards created through createBoard', async () => {
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => {
      expect(result.current.boards).toEqual([]);
    });

    await act(async () => {
      await result.current.createBoard({ title: 'New' });
    });

    expect(result.current.boards.map((board) => board.id)).toContain(
      'board-new',
    );
  });

  it('optimistically toggles favourites and rolls back on failure', async () => {
    const board = makeBoard({ isFavourite: false });
    listMock.mockResolvedValue(pageOf([board]));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => {
      expect(result.current.boards).toHaveLength(1);
    });

    setFavouriteMock.mockRejectedValue(new Error('boom'));
    await act(async () => {
      await expect(result.current.toggleFavourite(board)).rejects.toThrow(
        'boom',
      );
    });

    expect(result.current.boards[0].isFavourite).toBe(false);
  });

  it('removes an archived board from the active list', async () => {
    listMock.mockResolvedValue(pageOf([makeBoard()]));
    const { result } = renderHook(() => useDashboard());
    await waitFor(() => {
      expect(result.current.boards).toHaveLength(1);
    });

    await act(async () => {
      await result.current.archiveBoard('board-1');
    });

    expect(result.current.boards).toHaveLength(0);
  });

  it('loads templates on demand', async () => {
    const { result } = renderHook(() => useDashboard());

    await act(async () => {
      await result.current.loadTemplates();
    });

    expect(listTemplatesMock).toHaveBeenCalledTimes(1);
    expect(result.current.templates).toHaveLength(1);
  });
});
