'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  PRESENCE_ACTIVITY,
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  SOCKET_EVENTS,
  documentFromElements,
  parseWhiteboardDocument,
  type BoardMemberRole,
} from '@whiteboard/shared';
import { useAuthStore } from '@/stores/auth-store';
import { useAutosaveStore } from '@/stores/autosave-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useChatStore } from '@/stores/chat-store';
import { useCommentsStore } from '@/stores/comments-store';
import { useNotificationStore } from '@/stores/notification-store';
import { useRealtimeStore } from '@/stores/realtime-store';
import { useToolStore } from '@/stores/tool-store';
import { toast } from '@/stores/toast-store';
import type { AppNotification } from '@/types/notification';
import { authService } from '@/lib/api/services/auth-service';
import { commentService } from '@/lib/api/services/comment-service';
import { documentsEqual } from '@/lib/autosave/merge';
import { offlineQueue } from '@/lib/autosave/offline-queue';
import {
  applyDrawPatch,
  applyElementCreate,
  applyElementDelete,
} from '@/lib/realtime/element-conflicts';
import {
  emitJoinBoard,
  emitLeaveBoard,
  emitPresenceUpdate,
  emitSelectionUpdate,
} from '@/lib/realtime/emit';
import { syncElementChanges } from '@/lib/realtime/emit';
import { realtimeClient } from '@/lib/realtime/realtime-client';

const READ_ONLY_ROLES: ReadonlySet<BoardMemberRole> = new Set([
  'COMMENTER',
  'VIEWER',
]);

/**
 * Wires the board session to the realtime socket: connects, joins the board,
 * applies remote document/selection/presence events into the stores, and
 * broadcasts the local user's presence, cursor and selection.
 *
 * Remote document events are applied under LWW (see element-conflicts.ts) and
 * never echoed back to the room. VIEWER/COMMENTER roles keep the canvas
 * read-only.
 */
export function useBoardRealtime(
  boardId: string,
  _role: BoardMemberRole,
): void {
  const router = useRouter();
  const appliedRemoteRef = useRef(false);
  const joinedBoardRef = useRef<string | null>(null);

  const applyRemote = useCallback((apply: () => void): void => {
    appliedRemoteRef.current = true;
    try {
      apply();
    } finally {
      appliedRemoteRef.current = false;
    }
  }, []);

  const refreshThreads = useCallback(async (): Promise<void> => {
    try {
      const threads = await commentService.list(boardId);
      if (useRealtimeStore.getState().boardId === boardId) {
        useCommentsStore.getState().setThreads(threads);
      }
    } catch {
      // Comments are non-critical; the panel surfaces errors when opened.
    }
  }, [boardId]);

  const refreshTokenAndReconnect = useCallback(async (): Promise<void> => {
    const store = useAuthStore.getState();
    if (store.refreshToken === null) {
      useRealtimeStore.getState().clear();
      return;
    }
    try {
      const result = await authService.refresh(store.refreshToken);
      store.setTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      useRealtimeStore.getState().setBoardId(boardId);
      realtimeClient.disconnect();
      realtimeClient.connect(result.accessToken);
    } catch {
      store.clear();
      toast.error('Your session has expired. Please sign in again.');
      router.replace('/');
    }
  }, [boardId, router]);

  // Connect and join the board once the socket is ready.
  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (token === null) {
      return;
    }
    useRealtimeStore.getState().setBoardId(boardId);
    realtimeClient.connect(token);

    const joinWhenConnected = (): void => {
      if (
        joinedBoardRef.current === boardId ||
        useRealtimeStore.getState().boardId !== boardId
      ) {
        return;
      }
      joinedBoardRef.current = boardId;
      emitJoinBoard(boardId);
    };

    const unsubscribe = useRealtimeStore.subscribe((state, previous) => {
      if (
        state.connectionStatus === 'connected' &&
        previous.connectionStatus !== 'connected'
      ) {
        joinWhenConnected();
      }
    });
    if (useRealtimeStore.getState().connectionStatus === 'connected') {
      joinWhenConnected();
    }
    return unsubscribe;
  }, [boardId]);

  // Server -> client event wiring.
  useEffect(() => {
    const myUserId = useAuthStore.getState().user?.id ?? null;
    const unsubscribeAuthErrors = realtimeClient.onAuthError(() => {
      void refreshTokenAndReconnect();
    });

    const unsubscribe = [
      realtimeClient.on(SOCKET_EVENTS.BOARD_DATA, (payload) => {
        if (payload.boardId !== boardId) {
          return;
        }
        joinedBoardRef.current = boardId;
        void (async () => {
          const document = parseWhiteboardDocument(payload.data);
          const canvas = useCanvasStore.getState();
          const hasPendingDraft = (await offlineQueue.get(boardId)) !== null;
          applyRemote(() => {
            canvas.setReadOnly(READ_ONLY_ROLES.has(payload.role));
            // Keep local edits made while offline; they will be merged and
            // replayed from the queue once the autosave pipeline is live.
            if (!hasPendingDraft) {
              canvas.reset();
              canvas.setElements(document?.elements ?? []);
            }
            useRealtimeStore.getState().setBoardId(boardId);
            useRealtimeStore.getState().setPresence(payload.presence);
          });
          const autosave = useAutosaveStore.getState();
          autosave.setLastSavedDocument(document);
          autosave.setRevision(payload.revision);
          if (hasPendingDraft) {
            autosave.markDirty();
          }
        })();
        void refreshThreads();
      }),
      realtimeClient.on(SOCKET_EVENTS.BOARD_REVISION, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        // Only advance the autosave base when this client has nothing
        // unsaved; otherwise a conflicting save will reconcile on its own.
        const autosave = useAutosaveStore.getState();
        if (
          autosave.lastSavedDocument === null ||
          autosave.revision === null ||
          autosave.status === 'dirty' ||
          autosave.status === 'saving' ||
          autosave.status === 'offline' ||
          autosave.status === 'error'
        ) {
          return;
        }
        const canvas = documentFromElements(useCanvasStore.getState().elements);
        if (!documentsEqual(canvas, autosave.lastSavedDocument)) {
          return;
        }
        autosave.setRevision(event.revision);
      }),
      realtimeClient.on(SOCKET_EVENTS.BOARD_RESTORED, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        void (async () => {
          const document = parseWhiteboardDocument(event.data);
          applyRemote(() => {
            const canvas = useCanvasStore.getState();
            canvas.reset();
            canvas.setElements(document?.elements ?? []);
          });
          const autosave = useAutosaveStore.getState();
          autosave.setLastSavedDocument(document);
          autosave.setRevision(event.revision);
          await offlineQueue.clear(boardId);
        })();
      }),
      realtimeClient.on(SOCKET_EVENTS.PRESENCE_ROSTER, ({ presence }) => {
        useRealtimeStore.getState().setPresence(presence);
        const present = new Set(presence.map((member) => member.userId));
        useRealtimeStore.setState((state) => {
          const cursors = Object.fromEntries(
            Object.entries(state.cursors).filter(([userId]) =>
              present.has(userId),
            ),
          );
          return { cursors };
        });
      }),
      realtimeClient.on(SOCKET_EVENTS.PRESENCE_UPDATE, (event) => {
        useRealtimeStore.setState((state) => ({
          presence: state.presence.map((member) =>
            member.userId === event.userId
              ? {
                  ...member,
                  activity: event.presence.activity,
                  tool: event.presence.tool,
                }
              : member,
          ),
        }));
      }),
      realtimeClient.on(SOCKET_EVENTS.CURSOR_MOVE, (event) => {
        if (event.userId === myUserId || event.boardId !== boardId) {
          return;
        }
        useRealtimeStore
          .getState()
          .upsertCursor(event.userId, { x: event.x, y: event.y });
      }),
      realtimeClient.on(SOCKET_EVENTS.DRAW_PATCH, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        const canvas = useCanvasStore.getState();
        const result = applyDrawPatch(canvas.elements, event);
        if (result.changed) {
          applyRemote(() => canvas.setElements(result.elements));
        }
      }),
      realtimeClient.on(SOCKET_EVENTS.ELEMENT_CREATE, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        const canvas = useCanvasStore.getState();
        const result = applyElementCreate(canvas.elements, event);
        if (result.changed) {
          applyRemote(() => canvas.setElements(result.elements));
        }
      }),
      realtimeClient.on(SOCKET_EVENTS.ELEMENT_DELETE, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        const canvas = useCanvasStore.getState();
        const result = applyElementDelete(canvas.elements, event);
        if (result.changed) {
          applyRemote(() => canvas.setElements(result.elements));
        }
      }),
      realtimeClient.on(SOCKET_EVENTS.SELECTION_UPDATE, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        useRealtimeStore
          .getState()
          .setRemoteSelection(event.userId, event.selectedIds);
      }),
      realtimeClient.on(
        SOCKET_EVENTS.CHAT_MESSAGE,
        ({ boardId: eventBoard, message }) => {
          if (eventBoard !== boardId) {
            return;
          }
          useChatStore.getState().appendMessage(message);
          useChatStore.getState().incrementUnread();
        },
      ),
      realtimeClient.on(SOCKET_EVENTS.CHAT_TYPING, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        useChatStore.getState().setTyping(event.userId, event.isTyping);
      }),
      realtimeClient.on(SOCKET_EVENTS.CHAT_READ, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        useChatStore.getState().applyPeerReadReceipt(event.userId, {
          lastReadMessageId: event.lastReadMessageId,
          readAt: event.readAt,
        });
      }),
      realtimeClient.on(SOCKET_EVENTS.COMMENT_CREATED, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        void refreshThreads();
      }),
      realtimeClient.on(SOCKET_EVENTS.COMMENT_RESOLVED, (event) => {
        if (event.boardId !== boardId) {
          return;
        }
        useCommentsStore
          .getState()
          .setResolved(
            event.threadId,
            event.resolved,
            event.userId,
            event.resolvedAt,
          );
      }),
      realtimeClient.on(SOCKET_EVENTS.NOTIFICATION_NEW, (event) => {
        useNotificationStore.getState().prepend({
          id: event.notificationId,
          userId: useAuthStore.getState().user?.id ?? '',
          type: event.type as AppNotification['type'],
          payload: event.payload,
          readAt: event.readAt,
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
        });
      }),
      realtimeClient.on(SOCKET_EVENTS.KICK, (payload) => {
        handleKicked(payload.reason);
      }),
      realtimeClient.on(SOCKET_EVENTS.BOARD_DELETED, (payload) => {
        handleBoardDeleted(payload.reason);
      }),
    ];

    return () => {
      unsubscribeAuthErrors();
      for (const cleanup of unsubscribe) {
        cleanup();
      }
    };

    function handleKicked(reason: string): void {
      useRealtimeStore.getState().clear();
      toast.error('You were removed from this board', reason);
      router.replace('/');
    }

    function handleBoardDeleted(reason: string): void {
      useRealtimeStore.getState().clear();
      toast.error('This board has been deleted', reason);
      router.replace('/');
    }
  }, [boardId, applyRemote, refreshThreads, refreshTokenAndReconnect, router]);

  // Broadcast selection changes (never for remote-applied updates).
  useEffect(() => {
    return useCanvasStore.subscribe((state, previous) => {
      if (state.selectedIds === previous.selectedIds) {
        return;
      }
      if (appliedRemoteRef.current) {
        return;
      }
      const activeBoardId = useRealtimeStore.getState().boardId;
      if (activeBoardId !== null) {
        emitSelectionUpdate(activeBoardId, state.selectedIds);
      }
    });
  }, []);

  // Broadcast document changes. Every local mutation flows through the canvas
  // store, so a single diff against the previous snapshot covers creates,
  // patches and deletes without touching each mutation site.
  useEffect(() => {
    return useCanvasStore.subscribe((state, previous) => {
      if (state.elements === previous.elements) {
        return;
      }
      if (appliedRemoteRef.current) {
        return;
      }
      syncElementChanges(previous.elements, state.elements);
    });
  }, []);

  // Broadcast tool changes into presence.
  useEffect(() => {
    return useToolStore.subscribe((state, previous) => {
      if (state.activeTool === previous.activeTool) {
        return;
      }
      emitPresenceUpdate({
        tool: state.activeTool,
        activity: PRESENCE_ACTIVITY.ONLINE,
      });
    });
  }, []);

  // Presence heartbeat + activity tracking.
  useEffect(() => {
    const sendHeartbeat = (): void => {
      if (useRealtimeStore.getState().boardId !== boardId) {
        return;
      }
      emitPresenceUpdate({
        tool: useToolStore.getState().activeTool,
        activity: document.hidden
          ? PRESENCE_ACTIVITY.AWAY
          : PRESENCE_ACTIVITY.ONLINE,
      });
    };
    const heartbeat = setInterval(
      sendHeartbeat,
      PRESENCE_HEARTBEAT_INTERVAL_MS,
    );
    const onVisibilityChange = (): void => {
      emitPresenceUpdate({
        tool: useToolStore.getState().activeTool,
        activity: document.hidden
          ? PRESENCE_ACTIVITY.AWAY
          : PRESENCE_ACTIVITY.ONLINE,
      });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [boardId]);

  // Teardown: leave the room, drop the session and the socket.
  useEffect(() => {
    const currentBoardId = boardId;
    return () => {
      joinedBoardRef.current = null;
      useRealtimeStore.getState().setBoardId(null);
      useRealtimeStore.getState().clear();
      useChatStore.getState().clear();
      useCommentsStore.getState().clear();
      emitLeaveBoard(currentBoardId);
      realtimeClient.disconnect();
    };
  }, [boardId]);
}
