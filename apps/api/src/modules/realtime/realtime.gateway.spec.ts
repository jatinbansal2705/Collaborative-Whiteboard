import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import type { Socket as ClientSocket } from 'socket.io-client';
import { io as ioc } from 'socket.io-client';
import {
  BOARD_NAMESPACE,
  PRESENCE_ACTIVITY,
  SOCKET_ERROR_CODES,
  SOCKET_EVENTS,
  type BoardDataPayload,
  type ChatReadEvent,
  type ChatTypingEvent,
  type CursorMoveEvent,
  type DrawPatchEvent,
  type ElementCreateEvent,
  type ElementDeleteEvent,
  type PresenceRosterPayload,
  type PresenceUpdateEvent,
  type SelectionUpdateEvent,
  type SocketAck,
} from '@whiteboard/shared';
import { RedisService } from '../../redis/redis.service';
import {
  TokenService,
  type AccessTokenVerified,
} from '../auth/auth-token.service';
import { UserRepository } from '../auth/repositories/user.repository';
import { BoardRepository } from '../boards/board.repository';
import { MemberRepository } from '../boards/member.repository';
import { ChatService } from '../chat/chat.service';
import { PresenceService } from './presence.service';
import { REALTIME_CONFIG } from './realtime.constants';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { InMemoryRedis } from './testing/in-memory-redis';

const USER_1: AccessTokenVerified = {
  userId: 'user-1',
  email: 'a@example.com',
  role: 'USER',
  sessionId: 'session-1',
};
const USER_2: AccessTokenVerified = {
  userId: 'user-2',
  email: 'b@example.com',
  role: 'USER',
  sessionId: 'session-2',
};

const BOARD = () => ({
  id: '11111111-1111-4111-8111-111111111111',
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  data: { layers: [] },
});

const BOARD_1 = '11111111-1111-4111-8111-111111111111';
const BOARD_2 = '22222222-2222-4222-8222-222222222222';
const MESSAGE_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

interface ConnectionErrorData {
  ok: boolean;
  error?: { code: string; message: string };
}

interface ConnectionErrorPayload extends Error {
  data: ConnectionErrorData;
}

const waitForEvent = <T>(
  client: ClientSocket,
  event: string,
  timeoutMs = 2_000,
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    const handler = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    client.once(event, handler);
  });

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('RealtimeGateway (socket.io)', () => {
  let app: INestApplication;
  let port: number;
  let realtimeService: RealtimeService;
  let clients: ClientSocket[] = [];
  const inMemoryRedis = new InMemoryRedis();

  const tokenService = { verifyAccessToken: jest.fn() };
  const memberRepository = { findMembership: jest.fn() };
  const boardRepository = { findById: jest.fn() };
  const userRepository = { findById: jest.fn() };
  const chatService = {
    recordReadReceipt: jest.fn(),
    listMessages: jest.fn(),
    createMessage: jest.fn(),
    getReadReceipt: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        RealtimeService,
        PresenceService,
        {
          provide: REALTIME_CONFIG,
          useValue: {
            presenceTtlMs: 90_000,
            cursorMinIntervalMs: 1_000,
            chatTypingThrottleMs: 1_000,
          },
        },
        { provide: TokenService, useValue: tokenService },
        { provide: MemberRepository, useValue: memberRepository },
        { provide: BoardRepository, useValue: boardRepository },
        { provide: UserRepository, useValue: userRepository },
        { provide: ChatService, useValue: chatService },
        { provide: RedisService, useValue: inMemoryRedis },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new IoAdapter(app));
    await app.init();
    await app.listen(0);
    const httpServer = app.getHttpServer() as unknown as {
      address: () => AddressInfo | null;
    };
    port = (httpServer.address() as AddressInfo).port;
    realtimeService = app.get(RealtimeService);
  });

  beforeEach(() => {
    inMemoryRedis.reset();
    jest.clearAllMocks();
    tokenService.verifyAccessToken.mockImplementation((token: string) => {
      if (token === 'token-user-1') {
        return Promise.resolve(USER_1);
      }
      if (token === 'token-user-2') {
        return Promise.resolve(USER_2);
      }
      return Promise.reject(new Error('invalid token'));
    });
    memberRepository.findMembership.mockResolvedValue({
      id: 'membership-1',
      boardId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      role: 'EDITOR',
      addedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    boardRepository.findById.mockResolvedValue(BOARD());
    userRepository.findById.mockResolvedValue({
      id: 'user-1',
      name: 'Alice',
      avatarUrl: null,
    });
    chatService.recordReadReceipt.mockResolvedValue({
      boardId: BOARD_1,
      userId: 'user-1',
      lastReadMessageId: MESSAGE_1,
      lastReadAt: new Date('2026-08-02T00:00:00.000Z'),
    });
  });

  afterEach(() => {
    for (const client of clients) {
      client.disconnect();
    }
    clients = [];
  });

  afterAll(async () => {
    await app.close();
  });

  const connect = (token: string): Promise<ClientSocket> =>
    new Promise((resolve, reject) => {
      const client = ioc(`http://localhost:${port}${BOARD_NAMESPACE}`, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 2_000,
        auth: { token },
      });
      clients.push(client);
      client.once('connect', () => resolve(client));
      client.once('connect_error', (error: Error) => reject(error));
    });

  const emitAck = <T>(
    client: ClientSocket,
    event: string,
    payload: unknown,
  ): Promise<SocketAck<T>> =>
    new Promise((resolve) => {
      client.emit(event, payload, (ack: SocketAck<T>) => resolve(ack));
    });

  it('rejects a connection with an invalid token', async () => {
    const client = ioc(`http://localhost:${port}${BOARD_NAMESPACE}`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 2_000,
      auth: { token: 'bad-token' },
    });
    clients.push(client);

    const error = await waitForEvent<ConnectionErrorPayload>(
      client,
      'connect_error',
    );
    expect(error.data.ok).toBe(false);
    expect(error.data.error?.code).toBe(SOCKET_ERROR_CODES.INVALID_TOKEN);
  });

  it('rejects a connection without a token', async () => {
    const client = ioc(`http://localhost:${port}${BOARD_NAMESPACE}`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 2_000,
    });
    clients.push(client);

    const error = await waitForEvent<ConnectionErrorPayload>(
      client,
      'connect_error',
    );
    expect(error.data.ok).toBe(false);
    expect(error.data.error?.code).toBe(SOCKET_ERROR_CODES.UNAUTHORIZED);
  });

  it('joins a board and delivers roster + snapshot to both members', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');

    const snapshotForA = waitForEvent<BoardDataPayload>(
      a,
      SOCKET_EVENTS.BOARD_DATA,
    );
    const ackA = await emitAck<{ boardId: string; role: string }>(
      a,
      SOCKET_EVENTS.JOIN,
      { boardId: '11111111-1111-4111-8111-111111111111' },
    );
    expect(ackA).toEqual({
      ok: true,
      data: {
        boardId: '11111111-1111-4111-8111-111111111111',
        role: 'EDITOR',
      },
    });
    const aSnapshot = await snapshotForA;
    expect(aSnapshot.boardId).toBe('11111111-1111-4111-8111-111111111111');
    expect(aSnapshot.role).toBe('EDITOR');
    expect(aSnapshot.version).toBe(String(BOARD().updatedAt.getTime()));
    expect(aSnapshot.presence).toHaveLength(1);

    const rosterForA = waitForEvent<PresenceRosterPayload>(
      a,
      SOCKET_EVENTS.PRESENCE_ROSTER,
    );
    const snapshotForB = waitForEvent<BoardDataPayload>(
      b,
      SOCKET_EVENTS.BOARD_DATA,
    );
    const ackB = await emitAck<{ boardId: string; role: string }>(
      b,
      SOCKET_EVENTS.JOIN,
      { boardId: '11111111-1111-4111-8111-111111111111' },
    );
    expect(ackB).toEqual({
      ok: true,
      data: {
        boardId: '11111111-1111-4111-8111-111111111111',
        role: 'EDITOR',
      },
    });

    const roster = await rosterForA;
    expect(roster.presence.map((m) => m.userId).sort()).toEqual([
      'user-1',
      'user-2',
    ]);
    const bSnapshot = await snapshotForB;
    expect(bSnapshot.presence).toHaveLength(2);
  });

  it('does not leak draw events between boards', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, {
      boardId: '11111111-1111-4111-8111-111111111111',
    });
    await emitAck(b, SOCKET_EVENTS.JOIN, {
      boardId: BOARD_2,
    });

    const leaked = waitForEvent(b, SOCKET_EVENTS.DRAW_PATCH, 150).then(
      () => true,
      () => false,
    );
    const ack = await emitAck(a, SOCKET_EVENTS.DRAW_PATCH, {
      boardId: '11111111-1111-4111-8111-111111111111',
      id: 'element-1',
      patch: { points: [1, 2] },
      version: 1,
      timestamp: 123,
    });
    expect(ack.ok).toBe(true);
    expect(await leaked).toBe(false);
  });

  it('broadcasts draw patches to peers but not the sender', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, {
      boardId: '11111111-1111-4111-8111-111111111111',
    });
    await emitAck(b, SOCKET_EVENTS.JOIN, {
      boardId: '11111111-1111-4111-8111-111111111111',
    });

    const drawForB = waitForEvent<DrawPatchEvent>(b, SOCKET_EVENTS.DRAW_PATCH);
    const senderSeesOwn = waitForEvent(a, SOCKET_EVENTS.DRAW_PATCH, 150).then(
      () => true,
      () => false,
    );

    const ack = await emitAck(a, SOCKET_EVENTS.DRAW_PATCH, {
      boardId: '11111111-1111-4111-8111-111111111111',
      id: 'element-1',
      patch: { points: [1, 2] },
      version: 1,
      timestamp: 123,
    });
    expect(ack.ok).toBe(true);

    const event = await drawForB;
    expect(event).toMatchObject({
      boardId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      id: 'element-1',
      version: 1,
    });
    expect(await senderSeesOwn).toBe(false);
  });

  it('throttles rapid cursor moves', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, {
      boardId: '11111111-1111-4111-8111-111111111111',
    });
    await emitAck(b, SOCKET_EVENTS.JOIN, {
      boardId: '11111111-1111-4111-8111-111111111111',
    });

    const moveForB = waitForEvent<CursorMoveEvent>(
      b,
      SOCKET_EVENTS.CURSOR_MOVE,
    );
    const first = await emitAck<{ dropped: boolean }>(
      a,
      SOCKET_EVENTS.CURSOR_MOVE,
      { boardId: '11111111-1111-4111-8111-111111111111', x: 1, y: 1 },
    );
    const second = await emitAck<{ dropped: boolean }>(
      a,
      SOCKET_EVENTS.CURSOR_MOVE,
      { boardId: '11111111-1111-4111-8111-111111111111', x: 2, y: 2 },
    );

    expect(first).toEqual({ ok: true, data: { dropped: false } });
    expect(second).toEqual({ ok: true, data: { dropped: true } });
    const event = await moveForB;
    expect(event).toMatchObject({
      boardId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      x: 1,
      y: 1,
    });
  });

  it('forbids viewers from drawing', async () => {
    memberRepository.findMembership.mockResolvedValue({
      id: 'membership-1',
      boardId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      role: 'VIEWER',
      addedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const a = await connect('token-user-1');
    await emitAck(a, SOCKET_EVENTS.JOIN, {
      boardId: '11111111-1111-4111-8111-111111111111',
    });

    const ack = await emitAck(a, SOCKET_EVENTS.DRAW_PATCH, {
      boardId: '11111111-1111-4111-8111-111111111111',
      id: 'element-1',
      patch: { points: [1] },
      version: 1,
      timestamp: 1,
    });

    if (ack.ok) {
      throw new Error('Expected a forbidden ack');
    }
    expect(ack.error.code).toBe(SOCKET_ERROR_CODES.FORBIDDEN);
  });

  it('kicks a user from the board and disconnects them', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, {
      boardId: '11111111-1111-4111-8111-111111111111',
    });
    await emitAck(b, SOCKET_EVENTS.JOIN, {
      boardId: '11111111-1111-4111-8111-111111111111',
    });

    const kicked = waitForEvent<{ boardId: string; reason: string }>(
      a,
      SOCKET_EVENTS.KICK,
    );
    await realtimeService.kick(
      '11111111-1111-4111-8111-111111111111',
      'user-1',
      'REMOVED',
    );

    const payload = await kicked;
    expect(payload).toEqual({
      boardId: '11111111-1111-4111-8111-111111111111',
      reason: 'REMOVED',
    });
    await sleep(50);
    expect(a.connected).toBe(false);
  });

  it('leaves a board, acks ok and broadcasts the updated roster', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });
    await emitAck(b, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const rosterForB = waitForEvent<PresenceRosterPayload>(
      b,
      SOCKET_EVENTS.PRESENCE_ROSTER,
    );
    const ack = await emitAck<{ boardId: string }>(a, SOCKET_EVENTS.LEAVE, {
      boardId: BOARD_1,
    });
    expect(ack).toEqual({ ok: true, data: { boardId: BOARD_1 } });

    const roster = await rosterForB;
    expect(roster.presence.map((m) => m.userId)).toEqual(['user-2']);

    const again = await emitAck(a, SOCKET_EVENTS.LEAVE, { boardId: BOARD_1 });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe(SOCKET_ERROR_CODES.NOT_JOINED);
    }
  });

  it('updates the presence roster when a member disconnects', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });
    await emitAck(b, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const rosterForB = waitForEvent<PresenceRosterPayload>(
      b,
      SOCKET_EVENTS.PRESENCE_ROSTER,
    );
    a.disconnect();

    const roster = await rosterForB;
    expect(roster.presence.map((m) => m.userId)).toEqual(['user-2']);
  });

  it('broadcasts presence updates to peers and acks', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });
    await emitAck(b, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const updateForB = waitForEvent<PresenceUpdateEvent>(
      b,
      SOCKET_EVENTS.PRESENCE_UPDATE,
    );
    const ack = await emitAck<{ activity: string; tool: string | null }>(
      a,
      SOCKET_EVENTS.PRESENCE_UPDATE,
      { activity: PRESENCE_ACTIVITY.AWAY, tool: 'selector' },
    );
    expect(ack).toEqual({
      ok: true,
      data: { activity: PRESENCE_ACTIVITY.AWAY, tool: 'selector' },
    });

    const event = await updateForB;
    expect(event).toMatchObject({
      userId: 'user-1',
      presence: { activity: PRESENCE_ACTIVITY.AWAY, tool: 'selector' },
    });
  });

  it('broadcasts created elements to peers but not the sender', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });
    await emitAck(b, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const createForB = waitForEvent<ElementCreateEvent>(
      b,
      SOCKET_EVENTS.ELEMENT_CREATE,
    );
    const senderSeesOwn = waitForEvent(
      a,
      SOCKET_EVENTS.ELEMENT_CREATE,
      150,
    ).then(
      () => true,
      () => false,
    );
    const ack = await emitAck<{ id: string; version: number }>(
      a,
      SOCKET_EVENTS.ELEMENT_CREATE,
      {
        boardId: BOARD_1,
        element: { id: 'element-1', type: 'rect', version: 1 },
      },
    );
    expect(ack).toEqual({ ok: true, data: { id: 'element-1', version: 1 } });

    const event = await createForB;
    expect(event.element).toMatchObject({ id: 'element-1', type: 'rect' });
    expect(await senderSeesOwn).toBe(false);
  });

  it('broadcasts element deletes to peers but not the sender', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });
    await emitAck(b, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const deleteForB = waitForEvent<ElementDeleteEvent>(
      b,
      SOCKET_EVENTS.ELEMENT_DELETE,
    );
    const senderSeesOwn = waitForEvent(
      a,
      SOCKET_EVENTS.ELEMENT_DELETE,
      150,
    ).then(
      () => true,
      () => false,
    );
    const ack = await emitAck<{ id: string; version: number }>(
      a,
      SOCKET_EVENTS.ELEMENT_DELETE,
      { boardId: BOARD_1, id: 'element-1', version: 2 },
    );
    expect(ack).toEqual({ ok: true, data: { id: 'element-1', version: 2 } });

    const event = await deleteForB;
    expect(event).toMatchObject({ id: 'element-1', version: 2 });
    expect(await senderSeesOwn).toBe(false);
  });

  it('broadcasts selection updates to peers', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });
    await emitAck(b, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const selectForB = waitForEvent<SelectionUpdateEvent>(
      b,
      SOCKET_EVENTS.SELECTION_UPDATE,
    );
    const ack = await emitAck<{ selectedIds: string[] }>(
      a,
      SOCKET_EVENTS.SELECTION_UPDATE,
      { boardId: BOARD_1, selectedIds: ['element-1'] },
    );
    expect(ack).toEqual({ ok: true, data: { selectedIds: ['element-1'] } });

    const event = await selectForB;
    expect(event).toMatchObject({
      boardId: BOARD_1,
      userId: 'user-1',
      selectedIds: ['element-1'],
    });
  });

  it('broadcasts typing indicators and throttles rapid updates', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });
    await emitAck(b, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const typingForB = waitForEvent<ChatTypingEvent>(
      b,
      SOCKET_EVENTS.CHAT_TYPING,
    );
    const first = await emitAck<{ throttled: boolean }>(
      a,
      SOCKET_EVENTS.CHAT_TYPING,
      { boardId: BOARD_1, isTyping: true },
    );
    const second = await emitAck<{ throttled: boolean }>(
      a,
      SOCKET_EVENTS.CHAT_TYPING,
      { boardId: BOARD_1, isTyping: false },
    );
    expect(first).toEqual({ ok: true, data: { throttled: false } });
    expect(second).toEqual({ ok: true, data: { throttled: true } });

    const event = await typingForB;
    expect(event).toMatchObject({
      boardId: BOARD_1,
      userId: 'user-1',
      isTyping: true,
    });
  });

  it('records and broadcasts a chat read receipt', async () => {
    const a = await connect('token-user-1');
    const b = await connect('token-user-2');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });
    await emitAck(b, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const readForB = waitForEvent<ChatReadEvent>(b, SOCKET_EVENTS.CHAT_READ);
    const ack = await emitAck<{ lastReadMessageId: string; readAt: string }>(
      a,
      SOCKET_EVENTS.CHAT_READ,
      { boardId: BOARD_1, lastReadMessageId: MESSAGE_1 },
    );
    expect(ack.ok).toBe(true);
    if (ack.ok) {
      expect(ack.data.lastReadMessageId).toBe(MESSAGE_1);
    }

    const event = await readForB;
    expect(event).toMatchObject({
      boardId: BOARD_1,
      userId: 'user-1',
      lastReadMessageId: MESSAGE_1,
    });
  });

  it('acks MESSAGE_NOT_FOUND when a read receipt targets a missing message', async () => {
    chatService.recordReadReceipt.mockResolvedValueOnce(null);
    const a = await connect('token-user-1');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const ack = await emitAck(a, SOCKET_EVENTS.CHAT_READ, {
      boardId: BOARD_1,
      lastReadMessageId: MESSAGE_1,
    });
    expect(ack.ok).toBe(false);
    if (!ack.ok) {
      expect(ack.error.code).toBe(SOCKET_ERROR_CODES.MESSAGE_NOT_FOUND);
    }
  });

  it('rejects a malformed payload with INVALID_PAYLOAD', async () => {
    const a = await connect('token-user-1');

    const ack = await emitAck(a, SOCKET_EVENTS.JOIN, {});
    expect(ack.ok).toBe(false);
    if (!ack.ok) {
      expect(ack.error.code).toBe(SOCKET_ERROR_CODES.INVALID_PAYLOAD);
    }
  });

  it('rejects a draw patch with a stale version', async () => {
    const a = await connect('token-user-1');
    await emitAck(a, SOCKET_EVENTS.JOIN, { boardId: BOARD_1 });

    const first = await emitAck(a, SOCKET_EVENTS.DRAW_PATCH, {
      boardId: BOARD_1,
      id: 'element-1',
      patch: { points: [1] },
      version: 5,
      timestamp: 1,
    });
    expect(first.ok).toBe(true);

    const stale = await emitAck(a, SOCKET_EVENTS.DRAW_PATCH, {
      boardId: BOARD_1,
      id: 'element-1',
      patch: { points: [2] },
      version: 5,
      timestamp: 2,
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.error.code).toBe(SOCKET_ERROR_CODES.STALE_VERSION);
    }
  });
});
