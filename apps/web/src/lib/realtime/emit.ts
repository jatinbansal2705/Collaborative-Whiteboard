import {
  SOCKET_EVENTS,
  type LeaveAckData,
  type PresenceActivity,
  type SocketAck,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { useAuthStore } from '@/stores/auth-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useRealtimeStore } from '@/stores/realtime-store';
import { realtimeClient } from './realtime-client';

/** Keys owned by the version/serialization layer, never sent as a patch. */
const STRUCTURAL_KEYS = new Set([
  'id',
  'type',
  'version',
  'schemaVersion',
  'updatedAt',
  'lastModifiedBy',
]);

/** Client-side coalescing interval for draw patches (text typing bursts). */
export const PATCH_THROTTLE_MS = 80;
/** Client-side throttle for cursor broadcasts. */
export const CURSOR_THROTTLE_MS = 25;

/** True when the socket is connected and joined to the given board. */
export function canEmit(boardId: string): boolean {
  const state = useRealtimeStore.getState();
  return state.connectionStatus === 'connected' && state.boardId === boardId;
}

function activeBoardId(): string | null {
  return useRealtimeStore.getState().boardId;
}

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

/** Strip serialization-layer keys so content comparisons ignore versions. */
export function stripElementVersion(
  element: WhiteboardElement,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(element).filter(([key]) => !STRUCTURAL_KEYS.has(key)),
  );
}

/** Changed patch keys between two versions of the same element. */
export function diffElement(
  from: WhiteboardElement,
  to: WhiteboardElement,
): Record<string, unknown> {
  const before = stripElementVersion(from);
  const after = stripElementVersion(to);
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      patch[key] = after[key];
    }
  }
  return patch;
}

// ---------------------------------------------------------------------------
// Session / presence
// ---------------------------------------------------------------------------

export function emitJoinBoard(boardId: string): void {
  realtimeClient.emit(SOCKET_EVENTS.JOIN, { boardId });
}

export function emitLeaveBoard(
  boardId: string,
  ack?: (result: SocketAck<LeaveAckData>) => void,
): void {
  realtimeClient.emit(SOCKET_EVENTS.LEAVE, { boardId }, ack);
}

export function emitPresenceUpdate(input: {
  tool?: string | null;
  activity?: PresenceActivity;
}): void {
  realtimeClient.emit(SOCKET_EVENTS.PRESENCE_UPDATE, {
    tool: input.tool ?? null,
    activity: input.activity,
  });
}

export function emitCursorMove(boardId: string, x: number, y: number): void {
  if (!canEmit(boardId)) {
    return;
  }
  const now = Date.now();
  if (now - cursorLastSent >= CURSOR_THROTTLE_MS) {
    cursorLastSent = now;
    realtimeClient.emit(SOCKET_EVENTS.CURSOR_MOVE, { boardId, x, y });
  }
}

export function emitSelectionUpdate(
  boardId: string,
  selectedIds: string[],
): void {
  if (!canEmit(boardId)) {
    return;
  }
  realtimeClient.emit(SOCKET_EVENTS.SELECTION_UPDATE, { boardId, selectedIds });
}

// ---------------------------------------------------------------------------
// Canvas elements
// ---------------------------------------------------------------------------

/**
 * Broadcasts a newly created element. The server only accepts creates at
 * version >= 1, so version-0 elements (duplicate/paste paths that skip the
 * history bump) are normalized to version 1 locally and on the wire.
 */
export function emitElementCreate(
  boardId: string,
  element: WhiteboardElement,
): void {
  if (!canEmit(boardId)) {
    return;
  }
  let toSend = element;
  if (toSend.version < 1) {
    toSend = { ...toSend, version: 1 };
    useCanvasStore.setState((state) => ({
      elements: state.elements.map((entry) =>
        entry.id === toSend.id
          ? { ...entry, version: Math.max(1, entry.version) }
          : entry,
      ),
    }));
  }
  realtimeClient.emit(SOCKET_EVENTS.ELEMENT_CREATE, {
    boardId,
    element: toSend,
  });
}

/**
 * Broadcasts a full-element patch, coalescing bursts (per element) so rapid
 * text-typing updates collapse into a single draw:patch per interval.
 */
export function emitElementPatch(
  boardId: string,
  element: WhiteboardElement,
): void {
  if (!canEmit(boardId)) {
    return;
  }
  const patch = Object.fromEntries(
    Object.entries(element).filter(([key]) => !STRUCTURAL_KEYS.has(key)),
  );
  const timestamp =
    typeof element.updatedAt === 'number' ? element.updatedAt : Date.now();
  pendingPatches.set(element.id, {
    boardId,
    id: element.id,
    patch,
    version: element.version,
    lastModifiedBy: currentUserId() ?? undefined,
    timestamp,
  });
  if (patchTimer === null) {
    patchTimer = setTimeout(flushPendingPatches, PATCH_THROTTLE_MS);
  }
}

export function emitElementDelete(
  boardId: string,
  id: string,
  version: number,
): void {
  if (!canEmit(boardId)) {
    return;
  }
  realtimeClient.emit(SOCKET_EVENTS.ELEMENT_DELETE, { boardId, id, version });
}

/**
 * Diffs a pre-bump `before` snapshot against the post-commit `after` list and
 * emits element:create / draw:patch / element:delete accordingly.
 */
export function syncElementChanges(
  before: readonly WhiteboardElement[],
  after: readonly WhiteboardElement[],
): void {
  const boardId = activeBoardId();
  if (boardId === null) {
    return;
  }
  const beforeById = new Map(before.map((element) => [element.id, element]));
  const afterById = new Map(after.map((element) => [element.id, element]));

  for (const element of after) {
    const previous = beforeById.get(element.id);
    if (previous === undefined) {
      emitElementCreate(boardId, element);
      continue;
    }
    if (Object.keys(diffElement(previous, element)).length > 0) {
      emitElementPatch(boardId, element);
    }
  }
  for (const element of before) {
    if (!afterById.has(element.id)) {
      emitElementDelete(boardId, element.id, element.version);
    }
  }
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export function emitChatTyping(boardId: string, isTyping: boolean): void {
  if (!canEmit(boardId)) {
    return;
  }
  realtimeClient.emit(SOCKET_EVENTS.CHAT_TYPING, { boardId, isTyping });
}

export function emitChatRead(boardId: string, lastReadMessageId: string): void {
  if (!canEmit(boardId)) {
    return;
  }
  realtimeClient.emit(SOCKET_EVENTS.CHAT_READ, {
    boardId,
    lastReadMessageId,
  });
}

// ---------------------------------------------------------------------------
// Internal coalescing state
// ---------------------------------------------------------------------------

interface PendingPatch {
  boardId: string;
  id: string;
  patch: Record<string, unknown>;
  version: number;
  lastModifiedBy?: string;
  timestamp: number;
}

const pendingPatches = new Map<string, PendingPatch>();
let patchTimer: ReturnType<typeof setTimeout> | null = null;
let cursorLastSent = 0;

function flushPendingPatches(): void {
  patchTimer = null;
  if (pendingPatches.size === 0) {
    return;
  }
  const pending = [...pendingPatches.values()];
  pendingPatches.clear();
  for (const entry of pending) {
    realtimeClient.emit(SOCKET_EVENTS.DRAW_PATCH, {
      boardId: entry.boardId,
      id: entry.id,
      patch: entry.patch,
      version: entry.version,
      lastModifiedBy: entry.lastModifiedBy,
      timestamp: entry.timestamp,
    });
  }
}
