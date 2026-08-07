import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SOCKET_EVENTS, type WhiteboardElement } from '@whiteboard/shared';
import { realtimeClient } from '@/lib/realtime/realtime-client';
import {
  canEmit,
  CURSOR_THROTTLE_MS,
  diffElement,
  emitCursorMove,
  emitElementCreate,
  emitElementDelete,
  emitElementPatch,
  emitJoinBoard,
  PATCH_THROTTLE_MS,
  stripElementVersion,
  syncElementChanges,
} from '@/lib/realtime/emit';
import { useAuthStore } from '@/stores/auth-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useRealtimeStore } from '@/stores/realtime-store';
import type { AuthUser } from '@/types/auth';

vi.mock('@/lib/realtime/realtime-client', () => ({
  realtimeClient: {
    emit: vi.fn(),
  },
}));

const BOARD_ID = 'board-1';

function element(id: string, version = 1): WhiteboardElement {
  return {
    id,
    type: 'rectangle',
    version,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    angle: 0,
    opacity: 1,
    strokeColor: '#000000',
    fillColor: null,
    strokeWidth: 2,
    strokeStyle: 'solid',
    shadow: null,
    lastModifiedBy: null,
    createdAt: 0,
    updatedAt: 0,
  } as WhiteboardElement;
}

function connected(): void {
  useRealtimeStore.setState({
    connectionStatus: 'connected',
    boardId: BOARD_ID,
  });
}

function resetStores(): void {
  useRealtimeStore.setState({
    connectionStatus: 'disconnected',
    boardId: null,
  });
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    status: 'unauthenticated',
  });
  useCanvasStore.setState({ elements: [], selectedIds: [], draft: null });
}

beforeEach(() => {
  vi.useFakeTimers();
  resetStores();
  vi.mocked(realtimeClient.emit).mockClear();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

describe('canEmit', () => {
  it('returns true when connected to the given board', () => {
    connected();
    expect(canEmit(BOARD_ID)).toBe(true);
  });

  it('returns false when connected to a different board', () => {
    connected();
    expect(canEmit('board-other')).toBe(false);
  });

  it('returns false when disconnected', () => {
    expect(canEmit(BOARD_ID)).toBe(false);
  });
});

describe('stripElementVersion', () => {
  it('removes the serialization-layer keys', () => {
    const stripped = stripElementVersion({
      ...element('a', 3),
      schemaVersion: 1,
      name: 'Box',
    } as unknown as WhiteboardElement);
    expect(stripped).not.toHaveProperty('id');
    expect(stripped).not.toHaveProperty('type');
    expect(stripped).not.toHaveProperty('version');
    expect(stripped).not.toHaveProperty('schemaVersion');
    expect(stripped).not.toHaveProperty('updatedAt');
    expect(stripped).not.toHaveProperty('lastModifiedBy');
    expect(stripped).toHaveProperty('name', 'Box');
    expect(stripped).toHaveProperty('x', 0);
  });
});

describe('diffElement', () => {
  it('reports only the changed content keys', () => {
    const patch = diffElement(
      { ...element('a', 1), x: 0 },
      { ...element('a', 2), x: 50 },
    );
    expect(patch).toEqual({ x: 50 });
  });

  it('returns an empty patch when only versions differ', () => {
    const patch = diffElement(element('a', 1), element('a', 2));
    expect(patch).toEqual({});
  });
});

describe('session emits', () => {
  it('emitJoinBoard joins the board', () => {
    emitJoinBoard(BOARD_ID);
    expect(realtimeClient.emit).toHaveBeenCalledWith(SOCKET_EVENTS.JOIN, {
      boardId: BOARD_ID,
    });
  });

  it('emitCursorMove broadcasts throttled cursor positions', () => {
    connected();
    emitCursorMove(BOARD_ID, 10, 20);
    emitCursorMove(BOARD_ID, 30, 40);
    expect(realtimeClient.emit).toHaveBeenCalledTimes(1);
    expect(realtimeClient.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.CURSOR_MOVE,
      { boardId: BOARD_ID, x: 10, y: 20 },
    );

    vi.advanceTimersByTime(CURSOR_THROTTLE_MS + 1);
    emitCursorMove(BOARD_ID, 30, 40);
    expect(realtimeClient.emit).toHaveBeenCalledTimes(2);
  });

  it('does not broadcast cursors while disconnected', () => {
    emitCursorMove(BOARD_ID, 10, 20);
    expect(realtimeClient.emit).not.toHaveBeenCalled();
  });
});

describe('element emits', () => {
  it('emitElementCreate sends version >= 1 elements as-is', () => {
    connected();
    emitElementCreate(BOARD_ID, element('a', 3));
    expect(realtimeClient.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ELEMENT_CREATE,
      { boardId: BOARD_ID, element: element('a', 3) },
    );
  });

  it('emitElementCreate normalizes a version-0 element to version 1', () => {
    connected();
    useCanvasStore.setState({ elements: [element('a', 0)] });
    emitElementCreate(BOARD_ID, element('a', 0));
    const payload = vi.mocked(realtimeClient.emit).mock.calls[0][1] as {
      element: WhiteboardElement;
    };
    expect(payload.element.version).toBe(1);
    expect(useCanvasStore.getState().elements[0].version).toBe(1);
  });

  it('emitElementPatch coalesces rapid patches into one draw:patch', () => {
    connected();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: { id: 'user-1' } as AuthUser,
      status: 'authenticated',
    });
    emitElementPatch(BOARD_ID, { ...element('a', 1), x: 10 });
    emitElementPatch(BOARD_ID, { ...element('a', 1), x: 20, y: 5 });
    expect(realtimeClient.emit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(PATCH_THROTTLE_MS + 1);
    expect(realtimeClient.emit).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(realtimeClient.emit).mock.calls[0][1] as {
      boardId: string;
      id: string;
      patch: Record<string, unknown>;
      version: number;
      lastModifiedBy: string;
    };
    expect(payload.boardId).toBe(BOARD_ID);
    expect(payload.id).toBe('a');
    expect(payload.patch).toMatchObject({ x: 20, y: 5 });
    expect(payload.version).toBe(1);
    expect(payload.lastModifiedBy).toBe('user-1');
  });

  it('emitElementDelete sends the delete with the element version', () => {
    connected();
    emitElementDelete(BOARD_ID, 'a', 4);
    expect(realtimeClient.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.ELEMENT_DELETE,
      { boardId: BOARD_ID, id: 'a', version: 4 },
    );
  });

  it('skips element emits while disconnected', () => {
    emitElementCreate(BOARD_ID, element('a'));
    emitElementPatch(BOARD_ID, element('a'));
    emitElementDelete(BOARD_ID, 'a', 1);
    expect(realtimeClient.emit).not.toHaveBeenCalled();
  });
});

describe('syncElementChanges', () => {
  it('emits create for new, patch for changed, delete for removed', () => {
    connected();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: { id: 'user-1' } as AuthUser,
      status: 'authenticated',
    });
    const before = [
      element('keep', 2),
      element('change', 1),
      element('remove', 1),
    ];
    const after = [{ ...element('keep', 2), x: 5 }, element('new', 1)];
    syncElementChanges(before, after);

    vi.advanceTimersByTime(PATCH_THROTTLE_MS + 1);

    const events = vi
      .mocked(realtimeClient.emit)
      .mock.calls.map((call) => call[0]);
    expect(events).toContain(SOCKET_EVENTS.ELEMENT_CREATE);
    expect(events).toContain(SOCKET_EVENTS.DRAW_PATCH);
    expect(events).toContain(SOCKET_EVENTS.ELEMENT_DELETE);
  });

  it('does nothing when there is no active board', () => {
    const before = [element('a')];
    syncElementChanges(before, [...before, element('b')]);
    expect(realtimeClient.emit).not.toHaveBeenCalled();
  });
});
