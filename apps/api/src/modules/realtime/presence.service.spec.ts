import { PRESENCE_ACTIVITY } from '@whiteboard/shared';
import { RedisService } from '../../redis/redis.service';
import { PresenceService } from './presence.service';
import type { RealtimeConfig } from './realtime.constants';
import { InMemoryRedis } from './testing/in-memory-redis';

const CONFIG: RealtimeConfig = {
  presenceTtlMs: 90_000,
  cursorMinIntervalMs: 25,
  chatTypingThrottleMs: 1000,
};

describe('PresenceService', () => {
  let redis: InMemoryRedis;
  let service: PresenceService;

  beforeEach(() => {
    redis = new InMemoryRedis();
    service = new PresenceService(redis as unknown as RedisService, CONFIG);
  });

  it('stores presence and lists the board roster sorted by lastSeenAt', async () => {
    await service.setPresence({
      boardId: 'board-1',
      socketId: 'socket-1',
      userId: 'user-1',
      name: 'Alice',
      avatarUrl: 'https://example.com/a.png',
      role: 'EDITOR',
      tool: 'pen',
    });
    await service.setPresence({
      boardId: 'board-1',
      socketId: 'socket-2',
      userId: 'user-2',
      name: null,
      avatarUrl: null,
      role: 'VIEWER',
    });

    const roster = await service.listBoard('board-1');
    expect(roster).toHaveLength(2);
    expect(roster[0]).toMatchObject({
      userId: 'user-1',
      name: 'Alice',
      avatarUrl: 'https://example.com/a.png',
      role: 'EDITOR',
      activity: PRESENCE_ACTIVITY.ONLINE,
      tool: 'pen',
    });
    expect(roster[1]).toMatchObject({ userId: 'user-2', role: 'VIEWER' });
  });

  it('updateStatus merges activity/tool and refreshes lastSeenAt', async () => {
    await service.setPresence({
      boardId: 'board-1',
      socketId: 'socket-1',
      userId: 'user-1',
      name: 'Alice',
      avatarUrl: null,
      role: 'EDITOR',
      tool: 'pen',
    });

    const member = await service.updateStatus('board-1', 'socket-1', {
      activity: PRESENCE_ACTIVITY.AWAY,
      tool: 'selector',
    });

    expect(member).toMatchObject({
      userId: 'user-1',
      activity: PRESENCE_ACTIVITY.AWAY,
      tool: 'selector',
    });
    const roster = await service.listBoard('board-1');
    expect(roster[0]).toMatchObject({
      name: 'Alice',
      role: 'EDITOR',
      activity: PRESENCE_ACTIVITY.AWAY,
      tool: 'selector',
    });
  });

  it('updateStatus returns null for an unknown socket', async () => {
    const member = await service.updateStatus('board-1', 'missing', {
      activity: PRESENCE_ACTIVITY.IDLE,
      tool: null,
    });
    expect(member).toBeNull();
  });

  it('removeSocket removes the socket from the board and user indexes', async () => {
    await service.setPresence({
      boardId: 'board-1',
      socketId: 'socket-1',
      userId: 'user-1',
      name: null,
      avatarUrl: null,
      role: 'OWNER',
    });

    await service.removeSocket('board-1', 'socket-1', 'user-1');

    expect(await service.listBoard('board-1')).toHaveLength(0);
    expect(await service.findUser('user-1')).toBeNull();
  });

  it('findUser locates the board and socket a user is connected from', async () => {
    await service.setPresence({
      boardId: 'board-2',
      socketId: 'socket-9',
      userId: 'user-9',
      name: null,
      avatarUrl: null,
      role: 'COMMENTER',
    });

    expect(await service.findUser('user-9')).toEqual({
      boardId: 'board-2',
      socketId: 'socket-9',
    });
    expect(await service.findUser('nobody')).toBeNull();
  });

  it('removeUser removes presence from both indexes', async () => {
    await service.setPresence({
      boardId: 'board-1',
      socketId: 'socket-1',
      userId: 'user-1',
      name: null,
      avatarUrl: null,
      role: 'EDITOR',
    });

    await service.removeUser('user-1');

    expect(await service.listBoard('board-1')).toHaveLength(0);
    expect(await service.findUser('user-1')).toBeNull();
  });

  it('removeUser is a no-op for a user with no presence', async () => {
    await expect(service.removeUser('ghost')).resolves.toBeUndefined();
  });

  it('clearBoard removes every member and the board key', async () => {
    await service.setPresence({
      boardId: 'board-1',
      socketId: 'socket-1',
      userId: 'user-1',
      name: null,
      avatarUrl: null,
      role: 'OWNER',
    });
    await service.setPresence({
      boardId: 'board-1',
      socketId: 'socket-2',
      userId: 'user-2',
      name: null,
      avatarUrl: null,
      role: 'VIEWER',
    });

    await service.clearBoard('board-1');

    expect(await service.listBoard('board-1')).toHaveLength(0);
    expect(await service.findUser('user-1')).toBeNull();
    expect(await service.findUser('user-2')).toBeNull();
  });

  it('acceptVersion accepts only strictly higher versions', async () => {
    expect(await service.acceptVersion('board-1', 'element-1', 3)).toBe(true);
    expect(await service.acceptVersion('board-1', 'element-1', 3)).toBe(false);
    expect(await service.acceptVersion('board-1', 'element-1', 2)).toBe(false);
    expect(await service.acceptVersion('board-1', 'element-1', 4)).toBe(true);
    expect(await service.getElementVersion('board-1', 'element-1')).toBe(4);
  });

  it('getElementVersion defaults to 0 for an unknown element', async () => {
    expect(await service.getElementVersion('board-1', 'missing')).toBe(0);
  });
});
