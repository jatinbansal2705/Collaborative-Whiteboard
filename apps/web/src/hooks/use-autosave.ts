'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  documentFromElements,
  parseWhiteboardDocument,
  type WhiteboardDocument,
} from '@whiteboard/shared';
import {
  CLIENT_ERROR_CODES,
  getErrorMessage,
  hasApiErrorCode,
  isApiError,
} from '@/lib/api/errors';
import { boardService } from '@/lib/api/services/board-service';
import {
  AUTOSAVE_DEBOUNCE_MS,
  AUTOSAVE_MAX_RETRIES,
  BOARD_SERVER_ERROR_CODES,
} from '@/lib/autosave/constants';
import { documentsEqual, mergeDocuments } from '@/lib/autosave/merge';
import { offlineQueue } from '@/lib/autosave/offline-queue';
import { useAutosaveStore } from '@/stores/autosave-store';
import { useCanvasStore } from '@/stores/canvas-store';

interface ConflictDetails {
  currentRevision?: unknown;
  data?: Record<string, unknown> | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNetworkError(error: unknown): boolean {
  return isApiError(error) && error.code === CLIENT_ERROR_CODES.NETWORK_ERROR;
}

/**
 * Debounced autosave pipeline (ADR-0005): watches the canvas store, persists
 * the full document under optimistic concurrency, and on a revision conflict
 * re-merges against the authoritative payload (LWW) and retries. Edits are
 * mirrored to an offline queue so a network drop never loses them; the queue
 * is flushed on reconnect / the `online` event.
 */
export function useAutosave(boardId: string, enabled: boolean): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const flushRef = useRef<(boardId: string) => Promise<void>>(async () => {});

  const buildDocument = useCallback(
    (): WhiteboardDocument =>
      documentFromElements(useCanvasStore.getState().elements),
    [],
  );

  const scheduleFlush = useCallback(
    (delay = AUTOSAVE_DEBOUNCE_MS): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void flushRef.current(boardId);
      }, delay);
    },
    [boardId],
  );

  const saveDraft = useCallback(
    async (
      targetBoardId: string,
      document: WhiteboardDocument,
      retries = 0,
    ): Promise<boolean> => {
      if (savingRef.current) {
        return false;
      }
      savingRef.current = true;
      try {
        const baseRevision = useAutosaveStore.getState().revision ?? undefined;
        const result = await boardService.saveData(targetBoardId, {
          data: document as unknown as Record<string, unknown>,
          baseRevision,
        });
        const store = useAutosaveStore.getState();
        store.setLastSavedDocument(document);
        store.setSaved(result.revision);
        await offlineQueue.clear(targetBoardId);
        return true;
      } catch (error) {
        if (
          hasApiErrorCode(error, BOARD_SERVER_ERROR_CODES.STALE_BOARD_REVISION)
        ) {
          const details = isApiError(error)
            ? (error.details as ConflictDetails | undefined)
            : undefined;
          if (
            retries < AUTOSAVE_MAX_RETRIES &&
            isRecord(details) &&
            typeof details.currentRevision === 'number'
          ) {
            const authoritative = parseWhiteboardDocument(details.data);
            if (authoritative !== null) {
              const merged = mergeDocuments(document, authoritative);
              const store = useAutosaveStore.getState();
              // Baseline the merged document before touching the canvas so the
              // resulting element change is not treated as a fresh dirty edit.
              store.setLastSavedDocument(merged);
              store.setRevision(details.currentRevision);
              useCanvasStore.getState().setElements(merged.elements);
              savingRef.current = false;
              return saveDraft(targetBoardId, merged, retries + 1);
            }
          }
          useAutosaveStore.getState().setError(getErrorMessage(error));
          return false;
        }
        if (isNetworkError(error)) {
          useAutosaveStore.getState().setOffline();
          return false;
        }
        useAutosaveStore.getState().setError(getErrorMessage(error));
        return false;
      } finally {
        savingRef.current = false;
      }
    },
    [],
  );

  const flush = useCallback(
    async (targetBoardId: string): Promise<void> => {
      if (!enabled) {
        return;
      }
      const document = buildDocument();
      const store = useAutosaveStore.getState();
      if (
        store.lastSavedDocument !== null &&
        documentsEqual(document, store.lastSavedDocument)
      ) {
        return;
      }
      store.markDirty();
      await offlineQueue.set(targetBoardId, {
        document,
        baseRevision: store.revision,
        updatedAt: Date.now(),
      });
      store.setSaving();
      const saved = await saveDraft(targetBoardId, document);
      // Catch mutations that landed while the save was in flight.
      if (saved) {
        const latest = buildDocument();
        const current = useAutosaveStore.getState();
        if (
          current.lastSavedDocument === null ||
          !documentsEqual(latest, current.lastSavedDocument)
        ) {
          scheduleFlush(0);
        }
      }
    },
    [buildDocument, enabled, saveDraft, scheduleFlush],
  );

  flushRef.current = flush;

  /** Reapplies + flushes a draft persisted by a previous (offline) session. */
  const restorePendingDraft = useCallback(
    async (targetBoardId: string): Promise<void> => {
      if (!enabled) {
        return;
      }
      const draft = await offlineQueue.get(targetBoardId);
      if (draft === null) {
        return;
      }
      const store = useAutosaveStore.getState();
      const base =
        store.lastSavedDocument === null
          ? documentFromElements(useCanvasStore.getState().elements)
          : store.lastSavedDocument;
      const merged = mergeDocuments(draft.document, base);
      useCanvasStore.getState().setElements(merged.elements);
      scheduleFlush(0);
    },
    [enabled, scheduleFlush],
  );

  // Track local canvas mutations and schedule a debounced save.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const unsubscribe = useCanvasStore.subscribe((state, previous) => {
      if (state.elements === previous.elements) {
        return;
      }
      const store = useAutosaveStore.getState();
      const current = documentFromElements(state.elements);
      if (
        store.lastSavedDocument !== null &&
        documentsEqual(current, store.lastSavedDocument)
      ) {
        return;
      }
      scheduleFlush();
    });
    return () => {
      unsubscribe();
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [boardId, enabled, scheduleFlush]);

  // Restore a leftover draft once the board document is known.
  const revision = useAutosaveStore((state) => state.revision);
  useEffect(() => {
    if (!enabled || revision === null) {
      return;
    }
    void restorePendingDraft(boardId);
  }, [boardId, enabled, revision, restorePendingDraft]);

  // Flush pending drafts when connectivity returns.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleOnline = (): void => {
      void restorePendingDraft(boardId);
      void flush(boardId);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [boardId, enabled, flush, restorePendingDraft]);

  // Best-effort flush when the tab is hidden or closed.
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        void flush(boardId);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, [boardId, enabled, flush]);

  // Drop autosave state when leaving the board.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      useAutosaveStore.getState().reset();
    };
  }, [boardId]);
}
