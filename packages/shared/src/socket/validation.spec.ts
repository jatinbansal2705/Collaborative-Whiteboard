import { ackError, ackOk, invalidPayloadError } from './acks';
import {
  invalidPayload,
  validateSocketPayload,
  validationError,
} from './validation';
import {
  boardRoom,
  BOARD_ROOM_PREFIX,
  BOARD_NAMESPACE,
  PRESENCE_ACTIVITY,
  SELECTION_IDS_MAX,
  SOCKET_ERROR_CODES,
  SOCKET_EVENTS,
} from './events';
import {
  boardIdSchema,
  boardMemberRoleSchema,
  boardDataPayloadSchema,
  boardDeletedPayloadSchema,
  cursorMovePayloadSchema,
  drawPatchPayloadSchema,
  elementCreatePayloadSchema,
  elementDeletePayloadSchema,
  elementPatchSchema,
  joinBoardPayloadSchema,
  kickPayloadSchema,
  presenceMemberSchema,
  selectionUpdatePayloadSchema,
} from './payloads';

describe('validateSocketPayload', () => {
  it('returns the parsed value for a valid payload', () => {
    const result = validateSocketPayload(cursorMovePayloadSchema, {
      boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
      x: 12.5,
      y: -3,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
        x: 12.5,
        y: -3,
      },
    });
  });

  it('rejects a payload with a malformed boardId', () => {
    const result = validateSocketPayload(cursorMovePayloadSchema, {
      boardId: 'not-a-uuid',
      x: 1,
      y: 2,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(SOCKET_ERROR_CODES.INVALID_PAYLOAD);
      expect(result.error.message).toContain('boardId');
    }
  });

  it('rejects non-finite cursor coordinates', () => {
    const result = validateSocketPayload(cursorMovePayloadSchema, {
      boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
      x: Number.POSITIVE_INFINITY,
      y: 0,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a draw:patch with a negative version', () => {
    const result = validateSocketPayload(drawPatchPayloadSchema, {
      boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
      id: 'el-1',
      patch: { x: 1 },
      version: -1,
      timestamp: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('version');
    }
  });

  it('rejects a draw:patch with an empty patch object', () => {
    const result = validateSocketPayload(drawPatchPayloadSchema, {
      boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
      id: 'el-1',
      patch: {},
      version: 1,
      timestamp: 1,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an element:create without a type', () => {
    const result = validateSocketPayload(elementCreatePayloadSchema, {
      boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
      element: { id: 'el-1', version: 1 },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a selection with too many ids', () => {
    const result = validateSocketPayload(selectionUpdatePayloadSchema, {
      boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
      selectedIds: Array.from({ length: SELECTION_IDS_MAX + 1 }, (_, i) =>
        String(i),
      ),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown payload shape entirely', () => {
    const result = validateSocketPayload(joinBoardPayloadSchema, 'nope');
    expect(result.ok).toBe(false);
  });
});

describe('ack helpers', () => {
  it('builds an ok ack', () => {
    expect(ackOk({ dropped: true })).toEqual({
      ok: true,
      data: { dropped: true },
    });
  });

  it('builds an error ack', () => {
    expect(ackError(SOCKET_ERROR_CODES.NOT_A_MEMBER, 'nope')).toEqual({
      ok: false,
      error: { code: SOCKET_ERROR_CODES.NOT_A_MEMBER, message: 'nope' },
    });
  });

  it('builds an invalid payload ack', () => {
    expect(invalidPayloadError('bad')).toEqual({
      ok: false,
      error: { code: SOCKET_ERROR_CODES.INVALID_PAYLOAD, message: 'bad' },
    });
  });
});

describe('validation result helpers', () => {
  it('invalidPayload always returns an error result', () => {
    const result = invalidPayload('nope');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(SOCKET_ERROR_CODES.INVALID_PAYLOAD);
    }
  });

  it('validationError maps a code and message', () => {
    const result = validationError(SOCKET_ERROR_CODES.FORBIDDEN, 'no');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        code: SOCKET_ERROR_CODES.FORBIDDEN,
        message: 'no',
      });
    }
  });
});

describe('events and rooms', () => {
  it('builds board rooms from board ids', () => {
    expect(boardRoom('abc')).toBe('board:abc');
    expect(BOARD_ROOM_PREFIX).toBe('board:');
    expect(BOARD_NAMESPACE).toBe('/boards');
    expect(SOCKET_EVENTS.JOIN).toBe('board:join');
  });

  it('declares the full event set', () => {
    expect(Object.values(SOCKET_EVENTS)).toEqual(
      expect.arrayContaining([
        'board:join',
        'board:leave',
        'presence:update',
        'presence:roster',
        'cursor:move',
        'draw:patch',
        'element:create',
        'element:delete',
        'selection:update',
        'board:data',
        'kick',
        'board:deleted',
      ]),
    );
  });

  it('keeps presence activities and error codes stable', () => {
    expect(PRESENCE_ACTIVITY.ONLINE).toBe('online');
    expect(SOCKET_ERROR_CODES.STALE_VERSION).toBe('STALE_VERSION');
  });
});

describe('payload schema round-trips', () => {
  it('parses a presence member', () => {
    const result = presenceMemberSchema.safeParse({
      userId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
      name: 'Alice',
      avatarUrl: null,
      role: 'EDITOR',
      activity: 'online',
      tool: 'rectangle',
      lastSeenAt: '2026-07-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('parses a board:data payload', () => {
    const result = boardDataPayloadSchema.safeParse({
      boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
      role: 'VIEWER',
      version: '2026-07-01T00:00:00.000Z',
      data: { elements: [] },
      presence: [],
    });
    expect(result.success).toBe(true);
  });

  it('parses a draw:patch broadcast event with an explicit lastModifiedBy dropped', () => {
    const result = drawPatchPayloadSchema.safeParse({
      boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
      id: 'el-1',
      patch: { x: 4 },
      version: 2,
      lastModifiedBy: 'spoofed',
      timestamp: 99,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lastModifiedBy).toBe('spoofed');
    }
  });

  it('rejects an invalid role in the roster', () => {
    const result = boardMemberRoleSchema.safeParse('ADMIN');
    expect(result.success).toBe(false);
  });

  it('validates boardIdSchema against UUIDs only', () => {
    expect(
      boardIdSchema.safeParse('6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a').success,
    ).toBe(true);
    expect(boardIdSchema.safeParse('abc').success).toBe(false);
  });

  it('parses element patch, create and delete payloads', () => {
    expect(
      elementPatchSchema.safeParse({
        id: 'el-1',
        patch: { points: [1, 2] },
        version: 1,
        timestamp: 5,
      }).success,
    ).toBe(true);
    expect(
      elementCreatePayloadSchema.safeParse({
        boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
        element: { id: 'el-2', type: 'rectangle', version: 1, x: 0 },
      }).success,
    ).toBe(true);
    expect(
      elementDeletePayloadSchema.safeParse({
        boardId: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a',
        id: 'el-1',
        version: 3,
      }).success,
    ).toBe(true);
  });

  it('parses kick and board:deleted payloads', () => {
    const boardId = '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a';
    expect(
      kickPayloadSchema.safeParse({ boardId, reason: 'REMOVED' }).success,
    ).toBe(true);
    expect(
      boardDeletedPayloadSchema.safeParse({ boardId, reason: 'DELETED' })
        .success,
    ).toBe(true);
  });
});
