import {
  PRESENCE_ACTIVITY,
  SOCKET_EVENTS,
  boardRoom,
  type PresenceMember,
} from '@whiteboard/shared';
import type { BroadcastOperator, DefaultEventsMap, Server } from 'socket.io';
import type { AccessTokenVerified } from '../auth/auth-token.service';
import { UserRepository } from '../auth/repositories/user.repository';
import { BoardRepository } from '../boards/board.repository';
import { MemberRepository } from '../boards/member.repository';
import { ChatService } from '../chat/chat.service';
import { PresenceService } from './presence.service';
import {
  RealtimeService,
  type RealtimeSocketContext,
} from './realtime.service';
import type { RealtimeConfig } from './realtime.constants';

const CONFIG: RealtimeConfig = {
  presenceTtlMs: 90_000,
  cursorMinIntervalMs: 1_000,
  chatTypingThrottleMs: 100,
};

const USER: AccessTokenVerified = {
  userId: 'user-1',
  email: 'alice@example.com',
  role: 'USER',
  sessionId: 'session-1',
};

interface EmitRecord {
  event: string;
  payload: unknown;
}

interface BroadcastRecord {
  target: string;
  event: string;
  payload: unknown;
}

class FakeServer {
  readonly broadcasts: BroadcastRecord[] = [];
  readonly disconnects: string[] = [];

  to(target: string): {
    emit: (event: string, payload: unknown) => void;
    disconnectSockets: (close?: boolean) => void;
  } {
    return {
      emit: (event: string, payload: unknown) => {
        this.broadcasts.push({ target, event, payload });
      },
      disconnectSockets: () => {
        this.disconnects.push(target);
      },
    };
  }
}

interface SocketHarness {
  socket: RealtimeSocketContext;
  server: FakeServer;
  joined: string[];
  left: string[];
  emitted: EmitRecord[];
}

function makeSocket(
  overrides: Partial<RealtimeSocketContext> = {},
): SocketHarness {
  const server = new FakeServer();
  const joined: string[] = [];
  const left: string[] = [];
  const emitted: EmitRecord[] = [];
  const socket: RealtimeSocketContext = {
    id: 'socket-1',
    data: { user: USER },
    join: (room: string) => {
      joined.push(room);
    },
    leave: (room: string) => {
      left.push(room);
    },
    emit: (event: string, payload: unknown) => {
      emitted.push({ event, payload });
    },
    disconnect: () => undefined,
    to: (room: string) =>
      server.to(room) as unknown as BroadcastOperator<
        DefaultEventsMap,
        unknown
      >,
    ...overrides,
  };
  return { socket, server, joined, left, emitted };
}

const member = (role: string) => ({ role });
const board = () => ({
  id: 'board-1',
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  data: { layers: [] },
});
const userRow = () => ({ id: 'user-1', name: 'Alice', avatarUrl: null });
const rosterMember: PresenceMember = {
  userId: 'user-1',
  name: 'Alice',
  avatarUrl: null,
  role: 'EDITOR',
  activity: PRESENCE_ACTIVITY.ONLINE,
  tool: null,
  lastSeenAt: '2026-01-01T00:00:00.000Z',
};

describe('RealtimeService', () => {
  let service: RealtimeService;
  let presenceService: jest.Mocked<
    Pick<PresenceService, keyof PresenceService>
  >;
  let memberRepository: jest.Mocked<Pick<MemberRepository, 'findMembership'>>;
  let boardRepository: jest.Mocked<Pick<BoardRepository, 'findById'>>;
  let userRepository: jest.Mocked<Pick<UserRepository, 'findById'>>;
  let chatService: jest.Mocked<Pick<ChatService, 'recordReadReceipt'>>;

  beforeEach(() => {
    presenceService = {
      setPresence: jest.fn().mockResolvedValue(undefined),
      updateStatus: jest.fn(),
      listBoard: jest.fn().mockResolvedValue([]),
      removeSocket: jest.fn().mockResolvedValue(undefined),
      findUser: jest.fn().mockResolvedValue(null),
      removeUser: jest.fn().mockResolvedValue(undefined),
      clearBoard: jest.fn().mockResolvedValue(undefined),
      acceptVersion: jest.fn().mockResolvedValue(true),
      getElementVersion: jest.fn().mockResolvedValue(0),
    };
    memberRepository = {
      findMembership: jest.fn().mockResolvedValue(member('EDITOR')),
    };
    boardRepository = {
      findById: jest.fn().mockResolvedValue(board()),
    };
    userRepository = {
      findById: jest.fn().mockResolvedValue(userRow()),
    };
    chatService = {
      recordReadReceipt: jest.fn().mockResolvedValue({
        lastReadMessageId: 'message-1',
        lastReadAt: new Date('2026-08-02T00:00:00.000Z'),
      }),
    };

    service = new RealtimeService(
      presenceService as unknown as PresenceService,
      CONFIG,
      memberRepository as unknown as MemberRepository,
      boardRepository as unknown as BoardRepository,
      userRepository as unknown as UserRepository,
      chatService as unknown as ChatService,
    );
  });

  describe('join', () => {
    it('joins a board, sets presence and delivers a snapshot', async () => {
      presenceService.listBoard.mockResolvedValue([rosterMember]);
      const { socket, server, joined, emitted } = makeSocket();

      const result = await service.join(socket, { boardId: 'board-1' });

      expect(result).toEqual({ boardId: 'board-1', role: 'EDITOR' });
      expect(socket.data.boardId).toBe('board-1');
      expect(joined).toEqual([boardRoom('board-1')]);
      expect(presenceService.setPresence).toHaveBeenCalledWith({
        boardId: 'board-1',
        socketId: 'socket-1',
        userId: 'user-1',
        name: 'Alice',
        avatarUrl: null,
        role: 'EDITOR',
      });
      expect(server.broadcasts).toContainEqual({
        target: boardRoom('board-1'),
        event: SOCKET_EVENTS.PRESENCE_ROSTER,
        payload: { presence: [rosterMember] },
      });
      expect(emitted).toContainEqual({
        event: SOCKET_EVENTS.BOARD_DATA,
        payload: {
          boardId: 'board-1',
          role: 'EDITOR',
          version: String(board().updatedAt.getTime()),
          data: { layers: [] },
          presence: [rosterMember],
        },
      });
    });

    it('returns BOARD_NOT_FOUND for a missing board', async () => {
      boardRepository.findById.mockResolvedValue(null);
      const { socket } = makeSocket();

      const result = await service.join(socket, { boardId: 'board-1' });

      expect(result).toMatchObject({ code: 'BOARD_NOT_FOUND' });
      expect(socket.data.boardId).toBeUndefined();
    });

    it('returns NOT_A_MEMBER without a membership', async () => {
      memberRepository.findMembership.mockResolvedValue(null);
      const { socket } = makeSocket();

      const result = await service.join(socket, { boardId: 'board-1' });

      expect(result).toMatchObject({ code: 'NOT_A_MEMBER' });
    });

    it('switches boards by leaving the previous room and presence', async () => {
      presenceService.listBoard.mockResolvedValue([rosterMember]);
      const { socket, server, left } = makeSocket();
      socket.data.boardId = 'board-old';
      socket.data.role = 'VIEWER';

      const result = await service.join(socket, { boardId: 'board-1' });

      expect(result).toMatchObject({ role: 'EDITOR' });
      expect(left).toEqual([boardRoom('board-old')]);
      expect(presenceService.removeSocket).toHaveBeenCalledWith(
        'board-old',
        'socket-1',
        'user-1',
      );
      expect(presenceService.setPresence).toHaveBeenCalledWith(
        expect.objectContaining({ boardId: 'board-1' }),
      );
      expect(
        server.broadcasts.some((b) => b.target === boardRoom('board-old')),
      ).toBe(true);
    });

    it('short-circuits when already joined to the board', async () => {
      const { socket } = makeSocket();
      socket.data.boardId = 'board-1';
      socket.data.role = 'VIEWER';

      const result = await service.join(socket, { boardId: 'board-1' });

      expect(result).toEqual({ boardId: 'board-1', role: 'VIEWER' });
      expect(boardRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('leave and disconnect', () => {
    it('leaves the board and broadcasts the updated roster', async () => {
      presenceService.listBoard.mockResolvedValue([rosterMember]);
      const { socket, left } = makeSocket();
      socket.data.boardId = 'board-1';
      socket.data.role = 'EDITOR';

      const result = await service.leave(socket, { boardId: 'board-1' });

      expect(result).toEqual({ boardId: 'board-1' });
      expect(left).toEqual([boardRoom('board-1')]);
      expect(socket.data.boardId).toBeUndefined();
      expect(presenceService.removeSocket).toHaveBeenCalledWith(
        'board-1',
        'socket-1',
        'user-1',
      );
    });

    it('returns NOT_JOINED when leaving a board the socket is not on', async () => {
      const { socket } = makeSocket();
      const result = await service.leave(socket, { boardId: 'board-1' });
      expect(result).toMatchObject({ code: 'NOT_JOINED' });
    });

    it('handleDisconnect removes presence and skips when not joined', async () => {
      const { socket } = makeSocket();
      socket.data.boardId = 'board-1';
      await service.handleDisconnect(socket);
      expect(presenceService.removeSocket).toHaveBeenCalledWith(
        'board-1',
        'socket-1',
        'user-1',
      );

      const fresh = makeSocket();
      await service.handleDisconnect(fresh.socket);
      expect(presenceService.removeSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe('presence updates', () => {
    it('updatePresence broadcasts the new status and acks', async () => {
      presenceService.updateStatus.mockResolvedValue({
        userId: 'user-1',
        name: 'Alice',
        avatarUrl: null,
        role: 'EDITOR',
        activity: PRESENCE_ACTIVITY.IDLE,
        tool: 'eraser',
        lastSeenAt: '2026-01-01T00:00:00.000Z',
      });
      const { socket, server } = makeSocket();
      socket.data.boardId = 'board-1';

      const result = await service.updatePresence(socket, {
        activity: PRESENCE_ACTIVITY.IDLE,
        tool: 'eraser',
      });

      expect(result).toEqual({
        activity: PRESENCE_ACTIVITY.IDLE,
        tool: 'eraser',
      });
      expect(server.broadcasts).toContainEqual({
        target: boardRoom('board-1'),
        event: SOCKET_EVENTS.PRESENCE_UPDATE,
        payload: {
          userId: 'user-1',
          presence: { activity: PRESENCE_ACTIVITY.IDLE, tool: 'eraser' },
        },
      });
    });

    it('updatePresence returns NOT_JOINED when not on the board', async () => {
      const { socket } = makeSocket();
      const result = await service.updatePresence(socket, {});
      expect(result).toMatchObject({ code: 'NOT_JOINED' });
    });
  });

  describe('cursor', () => {
    it('emits the first cursor move and drops rapid follow-ups', () => {
      const { socket, server } = makeSocket();
      socket.data.boardId = 'board-1';

      const first = service.moveCursor(socket, {
        boardId: 'board-1',
        x: 10,
        y: 20,
      });
      const second = service.moveCursor(socket, {
        boardId: 'board-1',
        x: 30,
        y: 40,
      });

      expect(first).toEqual({ dropped: false });
      expect(second).toEqual({ dropped: true });
      const cursorEvents = server.broadcasts.filter(
        (b) => b.event === SOCKET_EVENTS.CURSOR_MOVE,
      );
      expect(cursorEvents).toEqual([
        {
          target: boardRoom('board-1'),
          event: SOCKET_EVENTS.CURSOR_MOVE,
          payload: { boardId: 'board-1', userId: 'user-1', x: 10, y: 20 },
        },
      ]);
    });

    it('coalesces a queued cursor after the throttle window', () => {
      jest.useFakeTimers();
      try {
        const now = Date.now();
        const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
        const { socket, server } = makeSocket();
        socket.data.boardId = 'board-1';

        service.moveCursor(socket, { boardId: 'board-1', x: 1, y: 1 });
        service.moveCursor(socket, { boardId: 'board-1', x: 2, y: 2 });
        expect(
          server.broadcasts.filter(
            (b) => b.event === SOCKET_EVENTS.CURSOR_MOVE,
          ),
        ).toHaveLength(1);

        nowSpy.mockReturnValue(now + CONFIG.cursorMinIntervalMs + 1);
        const result = service.moveCursor(socket, {
          boardId: 'board-1',
          x: 9,
          y: 9,
        });

        expect(result).toEqual({ dropped: false });
        const cursorEvents = server.broadcasts.filter(
          (b) => b.event === SOCKET_EVENTS.CURSOR_MOVE,
        );
        expect(cursorEvents[1].payload).toMatchObject({ x: 2, y: 2 });
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns NOT_JOINED when the socket is not on the board', () => {
      const { socket } = makeSocket();
      const result = service.moveCursor(socket, {
        boardId: 'board-1',
        x: 1,
        y: 1,
      });
      expect(result).toMatchObject({ code: 'NOT_JOINED' });
    });
  });

  describe('draw and element mutations', () => {
    const drawPayload = {
      boardId: 'board-1',
      id: 'element-1',
      patch: { points: [{ x: 1, y: 2 }] },
      version: 1,
      timestamp: 123,
    };

    it('applyDrawPatch broadcasts after accepting the version', async () => {
      const { socket, server } = makeSocket();
      socket.data.boardId = 'board-1';
      socket.data.role = 'EDITOR';

      const result = await service.applyDrawPatch(socket, drawPayload);

      expect(result).toEqual({ id: 'element-1', version: 1 });
      expect(presenceService.acceptVersion).toHaveBeenCalledWith(
        'board-1',
        'element-1',
        1,
      );
      expect(server.broadcasts).toContainEqual({
        target: boardRoom('board-1'),
        event: SOCKET_EVENTS.DRAW_PATCH,
        payload: {
          boardId: 'board-1',
          userId: 'user-1',
          id: 'element-1',
          patch: drawPayload.patch,
          version: 1,
          timestamp: 123,
        },
      });
    });

    it('applyDrawPatch returns STALE_VERSION when the version is rejected', async () => {
      presenceService.acceptVersion.mockResolvedValue(false);
      const { socket } = makeSocket();
      socket.data.boardId = 'board-1';
      socket.data.role = 'EDITOR';

      const result = await service.applyDrawPatch(socket, drawPayload);

      expect(result).toMatchObject({ code: 'STALE_VERSION' });
    });

    it('applyDrawPatch is forbidden for viewers', async () => {
      const { socket } = makeSocket();
      socket.data.boardId = 'board-1';
      socket.data.role = 'VIEWER';

      const result = await service.applyDrawPatch(socket, drawPayload);

      expect(result).toMatchObject({ code: 'FORBIDDEN' });
      expect(presenceService.acceptVersion).not.toHaveBeenCalled();
    });

    it('applyDrawPatch returns NOT_JOINED when not on the board', async () => {
      const { socket } = makeSocket();
      const result = await service.applyDrawPatch(socket, drawPayload);
      expect(result).toMatchObject({ code: 'NOT_JOINED' });
    });

    it('createElement broadcasts and returns id/version', async () => {
      const { socket, server } = makeSocket();
      socket.data.boardId = 'board-1';
      socket.data.role = 'EDITOR';
      const element = {
        id: 'element-2',
        type: 'rectangle',
        x: 0,
        y: 0,
        version: 1,
      };

      const result = await service.createElement(socket, {
        boardId: 'board-1',
        element,
      });

      expect(result).toEqual({ id: 'element-2', version: 1 });
      expect(server.broadcasts).toContainEqual({
        target: boardRoom('board-1'),
        event: SOCKET_EVENTS.ELEMENT_CREATE,
        payload: { boardId: 'board-1', userId: 'user-1', element },
      });
    });

    it('deleteElement broadcasts and returns id/version', async () => {
      const { socket, server } = makeSocket();
      socket.data.boardId = 'board-1';
      socket.data.role = 'EDITOR';

      const result = await service.deleteElement(socket, {
        boardId: 'board-1',
        id: 'element-3',
        version: 2,
      });

      expect(result).toEqual({ id: 'element-3', version: 2 });
      expect(server.broadcasts).toContainEqual({
        target: boardRoom('board-1'),
        event: SOCKET_EVENTS.ELEMENT_DELETE,
        payload: {
          boardId: 'board-1',
          userId: 'user-1',
          id: 'element-3',
          version: 2,
        },
      });
    });
  });

  describe('selection', () => {
    it('broadcasts the selection and acks', () => {
      const { socket, server } = makeSocket();
      socket.data.boardId = 'board-1';

      const result = service.updateSelection(socket, {
        boardId: 'board-1',
        selectedIds: ['a', 'b'],
      });

      expect(result).toEqual({ selectedIds: ['a', 'b'] });
      expect(server.broadcasts).toContainEqual({
        target: boardRoom('board-1'),
        event: SOCKET_EVENTS.SELECTION_UPDATE,
        payload: {
          boardId: 'board-1',
          userId: 'user-1',
          selectedIds: ['a', 'b'],
        },
      });
    });

    it('returns NOT_JOINED when not on the board', () => {
      const { socket } = makeSocket();
      const result = service.updateSelection(socket, {
        boardId: 'board-1',
        selectedIds: [],
      });
      expect(result).toMatchObject({ code: 'NOT_JOINED' });
    });
  });

  describe('kick and closeBoard', () => {
    it('kick emits to the user socket, disconnects it and clears presence', async () => {
      presenceService.findUser.mockResolvedValue({
        boardId: 'board-1',
        socketId: 'socket-1',
      });
      const server = new FakeServer();
      service.attachServer(server as unknown as Server);

      await service.kick('board-1', 'user-1', 'REMOVED');

      expect(server.broadcasts).toContainEqual({
        target: 'socket-1',
        event: SOCKET_EVENTS.KICK,
        payload: { boardId: 'board-1', reason: 'REMOVED' },
      });
      expect(server.disconnects).toEqual(['socket-1']);
      expect(presenceService.removeUser).toHaveBeenCalledWith('user-1');
    });

    it('kick skips when the user is not on that board', async () => {
      presenceService.findUser.mockResolvedValue({
        boardId: 'board-other',
        socketId: 'socket-1',
      });
      const server = new FakeServer();
      service.attachServer(server as unknown as Server);

      await service.kick('board-1', 'user-1', 'REMOVED');

      expect(server.broadcasts).toHaveLength(0);
    });

    it('kick is a no-op before the server is attached', async () => {
      presenceService.findUser.mockResolvedValue({
        boardId: 'board-1',
        socketId: 'socket-1',
      });
      await expect(
        service.kick('board-1', 'user-1', 'REMOVED'),
      ).resolves.toBeUndefined();
    });

    it('closeBoard notifies and disconnects the room, clearing presence', async () => {
      const server = new FakeServer();
      service.attachServer(server as unknown as Server);

      await service.closeBoard('board-1', 'BOARD_DELETED');

      expect(server.broadcasts).toContainEqual({
        target: boardRoom('board-1'),
        event: SOCKET_EVENTS.BOARD_DELETED,
        payload: { boardId: 'board-1', reason: 'BOARD_DELETED' },
      });
      expect(server.disconnects).toEqual([boardRoom('board-1')]);
      expect(presenceService.clearBoard).toHaveBeenCalledWith('board-1');
    });
  });
});
