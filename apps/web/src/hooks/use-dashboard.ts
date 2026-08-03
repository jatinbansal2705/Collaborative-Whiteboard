'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { getErrorMessage } from '@/lib/api/errors';
import { boardService } from '@/lib/api/services/board-service';
import { BOARD_LIST_DEFAULT_LIMIT } from '@/lib/validators/constants';
import type {
  CreateBoardInput,
  RenameBoardInput,
} from '@/lib/validators/board';
import {
  selectBoards,
  selectBoardsError,
  selectBoardsLoading,
  selectHasNextPage,
  useBoardStore,
} from '@/stores/board-store';
import { toast } from '@/stores/toast-store';
import type {
  BoardSortBy,
  BoardSortOrder,
  BoardSummary,
  BoardTab,
  ListBoardsQuery,
} from '@/types/board';

export interface DashboardFilters {
  archived?: boolean;
  template?: boolean;
  ownedByMe?: boolean;
}

export const EMPTY_FILTERS: DashboardFilters = {};

const SEARCH_DEBOUNCE_MS = 300;

export interface UseDashboardResult {
  boards: BoardSummary[];
  isLoading: boolean;
  error: string | null;
  hasNextPage: boolean;
  activeTab: BoardTab;
  search: string;
  sortBy: BoardSortBy;
  order: BoardSortOrder;
  filters: DashboardFilters;
  hasActiveFilters: boolean;
  templates: BoardSummary[];
  templatesLoading: boolean;
  setActiveTab: (tab: BoardTab) => void;
  setSearch: (search: string) => void;
  setSortBy: (sortBy: BoardSortBy) => void;
  setOrder: (order: BoardSortOrder) => void;
  setFilters: (filters: DashboardFilters) => void;
  clearFilters: () => void;
  reload: () => void;
  loadMore: () => Promise<void>;
  loadTemplates: () => Promise<void>;
  createBoard: (input: CreateBoardInput) => Promise<BoardSummary>;
  renameBoard: (id: string, input: RenameBoardInput) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  duplicateBoard: (id: string) => Promise<void>;
  archiveBoard: (id: string) => Promise<void>;
  restoreBoard: (id: string) => Promise<void>;
  toggleFavourite: (board: BoardSummary) => Promise<void>;
}

/**
 * Dashboard orchestration: owns the list query state (tab/search/sort/filter),
 * wires the board service to the shared store, and applies optimistic updates
 * to favourite/archive/restore actions. Components stay presentation-only.
 */
export function useDashboard(): UseDashboardResult {
  const boards = useBoardStore(selectBoards);
  const isLoading = useBoardStore(selectBoardsLoading);
  const error = useBoardStore(selectBoardsError);
  const hasNextPage = useBoardStore(selectHasNextPage);

  const [activeTab, setActiveTab] = useState<BoardTab>('recent');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<BoardSortBy>('updatedAt');
  const [order, setOrder] = useState<BoardSortOrder>('desc');
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [reloadToken, setReloadToken] = useState(0);
  const [templates, setTemplates] = useState<BoardSummary[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const query = useMemo<ListBoardsQuery>(
    () => ({
      tab: activeTab,
      search: debouncedSearch.trim() || undefined,
      sortBy,
      order,
      limit: BOARD_LIST_DEFAULT_LIMIT,
      ...filters,
    }),
    [activeTab, debouncedSearch, sortBy, order, filters],
  );
  const queryKey = useMemo(() => JSON.stringify(query), [query]);

  useEffect(() => {
    let cancelled = false;
    useBoardStore.getState().setError(null);
    useBoardStore.getState().setLoading(true);
    void boardService
      .list(query)
      .then((result) => {
        if (!cancelled) {
          useBoardStore.getState().setBoards(result);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          useBoardStore.getState().setError(getErrorMessage(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [queryKey, reloadToken, query]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const loadMore = useCallback(async (): Promise<void> => {
    const store = useBoardStore.getState();
    if (!store.hasNextPage || store.nextCursor === null || store.isLoading) {
      return;
    }
    store.setLoading(true);
    try {
      const result = await boardService.list({
        ...query,
        cursor: store.nextCursor,
      });
      useBoardStore.getState().appendBoards(result);
    } catch (cause) {
      toast.error('Could not load more boards', getErrorMessage(cause));
    }
  }, [query]);

  const createBoard = useCallback(
    async (input: CreateBoardInput): Promise<BoardSummary> => {
      const board = await boardService.create(input);
      useBoardStore.getState().upsertBoard(board);
      return board;
    },
    [],
  );

  const renameBoard = useCallback(
    async (id: string, input: RenameBoardInput): Promise<void> => {
      const updated = await boardService.update(id, { title: input.title });
      useBoardStore.getState().upsertBoard(updated);
    },
    [],
  );

  const deleteBoard = useCallback(async (id: string): Promise<void> => {
    await boardService.remove(id);
    useBoardStore.getState().removeBoard(id);
  }, []);

  const duplicateBoard = useCallback(async (id: string): Promise<void> => {
    const board = await boardService.duplicate(id);
    useBoardStore.getState().upsertBoard(board);
    toast.success('Board duplicated', `“${board.title}” was created.`);
  }, []);

  const archiveBoard = useCallback(async (id: string): Promise<void> => {
    const store = useBoardStore.getState();
    const current = store.boards.find((board) => board.id === id);
    if (current === undefined) {
      return;
    }
    store.patchBoard(id, { isArchived: true, status: 'ARCHIVED' });
    try {
      const updated = await boardService.archive(id);
      if (filtersRef.current.archived === true) {
        useBoardStore.getState().upsertBoard(updated);
      } else {
        useBoardStore.getState().removeBoard(id);
      }
    } catch (cause) {
      useBoardStore.getState().patchBoard(id, {
        isArchived: current.isArchived,
        status: current.status,
      });
      toast.error('Could not archive board', getErrorMessage(cause));
      throw cause;
    }
  }, []);

  const restoreBoard = useCallback(async (id: string): Promise<void> => {
    const store = useBoardStore.getState();
    const current = store.boards.find((board) => board.id === id);
    if (current === undefined) {
      return;
    }
    store.patchBoard(id, { isArchived: false, status: 'ACTIVE' });
    try {
      const updated = await boardService.restore(id);
      if (filtersRef.current.archived === true) {
        useBoardStore.getState().upsertBoard(updated);
      } else {
        useBoardStore.getState().removeBoard(id);
      }
    } catch (cause) {
      useBoardStore.getState().patchBoard(id, {
        isArchived: current.isArchived,
        status: current.status,
      });
      toast.error('Could not restore board', getErrorMessage(cause));
      throw cause;
    }
  }, []);

  const toggleFavourite = useCallback(
    async (board: BoardSummary): Promise<void> => {
      const store = useBoardStore.getState();
      const current = store.boards.find((entry) => entry.id === board.id);
      if (current === undefined) {
        return;
      }
      const next = !current.isFavourite;
      store.patchBoard(board.id, { isFavourite: next });
      try {
        await boardService.setFavourite(board.id, next);
      } catch (cause) {
        useBoardStore
          .getState()
          .patchBoard(board.id, { isFavourite: current.isFavourite });
        toast.error(
          next ? 'Could not favorite board' : 'Could not unfavorite board',
          getErrorMessage(cause),
        );
        throw cause;
      }
    },
    [],
  );

  const loadTemplates = useCallback(async (): Promise<void> => {
    setTemplatesLoading(true);
    try {
      setTemplates(await boardService.listTemplates());
    } catch (cause) {
      toast.error('Could not load templates', getErrorMessage(cause));
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  return {
    boards,
    isLoading,
    error,
    hasNextPage,
    activeTab,
    search,
    sortBy,
    order,
    filters,
    hasActiveFilters: Object.keys(filters).length > 0,
    templates,
    templatesLoading,
    setActiveTab,
    setSearch,
    setSortBy,
    setOrder,
    setFilters,
    clearFilters,
    reload,
    loadMore,
    loadTemplates,
    createBoard,
    renameBoard,
    deleteBoard,
    duplicateBoard,
    archiveBoard,
    restoreBoard,
    toggleFavourite,
  };
}
