import { Inject, Injectable } from '@nestjs/common';
import {
  PRESENCE_ACTIVITY,
  type BoardMemberRole,
  type PresenceActivity,
  type PresenceMember,
} from '@whiteboard/shared';
import { RedisService } from '../../redis/redis.service';
import { REALTIME_CONFIG, type RealtimeConfig } from './realtime.constants';

/**
 * Presence registry + per-element version store.
 *
 * Presence is keyed two ways: `presence:board:<boardId>` (hash of
 * socketId -> record, the roster source) and `presence:user:<userId>`
 * (hash of socketId -> record, used to locate a user's sockets for kicks).
 * Every write refreshes the TTL so stale entries expire on their own when a
 * client stops heartbeating.
 */
@Injectable()
export class PresenceService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: RedisService,
    @Inject(REALTIME_CONFIG) config: RealtimeConfig,
  ) {
    this.ttlSeconds = Math.max(1, Math.ceil(config.presenceTtlMs / 1000));
  }

  async setPresence(input: SetPresenceInput): Promise<void> {
    const record: PresenceRecord = {
      boardId: input.boardId,
      socketId: input.socketId,
      userId: input.userId,
      name: input.name,
      avatarUrl: input.avatarUrl,
      role: input.role,
      activity: input.activity ?? PRESENCE_ACTIVITY.ONLINE,
      tool: input.tool ?? null,
      lastSeenAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(record);
    const boardKey = this.boardKey(input.boardId);
    const userKey = this.userKey(input.userId);
    await this.redis.hset(boardKey, input.socketId, serialized);
    await this.redis.hset(userKey, input.socketId, serialized);
    await Promise.all([
      this.redis.expire(boardKey, this.ttlSeconds),
      this.redis.expire(userKey, this.ttlSeconds),
    ]);
  }

  async updateStatus(
    boardId: string,
    socketId: string,
    status: PresenceStatus,
  ): Promise<PresenceMember | null> {
    const boardKey = this.boardKey(boardId);
    const raw = await this.redis.hgetall(boardKey);
    const serialized = raw[socketId];
    if (serialized === undefined) {
      return null;
    }

    const record = this.parseRecord(serialized);
    if (record === null) {
      return null;
    }

    record.activity = status.activity;
    record.tool = status.tool;
    record.lastSeenAt = new Date().toISOString();
    const updated = JSON.stringify(record);
    await this.redis.hset(boardKey, socketId, updated);
    await this.redis.hset(this.userKey(record.userId), socketId, updated);
    await Promise.all([
      this.redis.expire(boardKey, this.ttlSeconds),
      this.redis.expire(this.userKey(record.userId), this.ttlSeconds),
    ]);

    return toPresenceMember(record);
  }

  async listBoard(boardId: string): Promise<PresenceMember[]> {
    const boardKey = this.boardKey(boardId);
    const entries = await this.redis.hgetall(boardKey);
    const members = Object.values(entries)
      .map((serialized) => this.parseRecord(serialized))
      .filter((record): record is PresenceRecord => record !== null)
      .map((record) => toPresenceMember(record))
      .sort((left, right) => left.lastSeenAt.localeCompare(right.lastSeenAt));
    return members;
  }

  async removeSocket(
    boardId: string,
    socketId: string,
    userId: string,
  ): Promise<void> {
    const boardKey = this.boardKey(boardId);
    await this.redis.hdel(boardKey, socketId);
    await this.redis.hdel(this.userKey(userId), socketId);
  }

  async findUser(userId: string): Promise<{
    boardId: string;
    socketId: string;
  } | null> {
    const entries = await this.redis.hgetall(this.userKey(userId));
    for (const serialized of Object.values(entries)) {
      const record = this.parseRecord(serialized);
      if (record !== null) {
        return { boardId: record.boardId, socketId: record.socketId };
      }
    }
    return null;
  }

  async removeUser(userId: string): Promise<void> {
    const found = await this.findUser(userId);
    if (found === null) {
      return;
    }
    await this.redis.hdel(this.boardKey(found.boardId), found.socketId);
    await this.redis.hdel(this.userKey(userId), found.socketId);
  }

  async clearBoard(boardId: string): Promise<void> {
    const boardKey = this.boardKey(boardId);
    const entries = await this.redis.hgetall(boardKey);
    for (const serialized of Object.values(entries)) {
      const record = this.parseRecord(serialized);
      if (record !== null) {
        await this.redis.hdel(this.userKey(record.userId), record.socketId);
      }
    }
    await this.redis.del(boardKey);
  }

  async getElementVersion(boardId: string, elementId: string): Promise<number> {
    const raw = await this.redis.get(this.versionKey(boardId, elementId));
    const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  async acceptVersion(
    boardId: string,
    elementId: string,
    version: number,
  ): Promise<boolean> {
    const accepted = await this.redis.eval(
      COMPARE_AND_SET_SCRIPT,
      [this.versionKey(boardId, elementId)],
      [String(version)],
    );
    return accepted === 1;
  }

  private boardKey(boardId: string): string {
    return `presence:board:${boardId}`;
  }

  private userKey(userId: string): string {
    return `presence:user:${userId}`;
  }

  private versionKey(boardId: string, elementId: string): string {
    return `board:version:${boardId}:${elementId}`;
  }

  private parseRecord(serialized: string): PresenceRecord | null {
    try {
      const parsed = JSON.parse(serialized) as Partial<PresenceRecord>;
      if (
        typeof parsed.boardId !== 'string' ||
        typeof parsed.socketId !== 'string' ||
        typeof parsed.userId !== 'string' ||
        !isBoardMemberRole(parsed.role) ||
        !isPresenceActivity(parsed.activity)
      ) {
        return null;
      }
      return {
        boardId: parsed.boardId,
        socketId: parsed.socketId,
        userId: parsed.userId,
        name: typeof parsed.name === 'string' ? parsed.name : null,
        avatarUrl:
          typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : null,
        role: parsed.role,
        activity: parsed.activity,
        tool: typeof parsed.tool === 'string' ? parsed.tool : null,
        lastSeenAt:
          typeof parsed.lastSeenAt === 'string'
            ? parsed.lastSeenAt
            : new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }
}

const COMPARE_AND_SET_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if tonumber(ARGV[1]) > current then
  redis.call('SET', KEYS[1], ARGV[1])
  return 1
end
return 0
`;

interface PresenceRecord {
  boardId: string;
  socketId: string;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  role: BoardMemberRole;
  activity: PresenceActivity;
  tool: string | null;
  lastSeenAt: string;
}

export interface SetPresenceInput {
  boardId: string;
  socketId: string;
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  role: BoardMemberRole;
  activity?: PresenceActivity;
  tool?: string | null;
}

export interface PresenceStatus {
  activity: PresenceActivity;
  tool: string | null;
}

const PRESENCE_ROLES = new Set<BoardMemberRole>([
  'OWNER',
  'EDITOR',
  'COMMENTER',
  'VIEWER',
]);

function isBoardMemberRole(value: unknown): value is BoardMemberRole {
  return (
    typeof value === 'string' && PRESENCE_ROLES.has(value as BoardMemberRole)
  );
}

function isPresenceActivity(value: unknown): value is PresenceActivity {
  return (
    value === PRESENCE_ACTIVITY.ONLINE ||
    value === PRESENCE_ACTIVITY.AWAY ||
    value === PRESENCE_ACTIVITY.IDLE
  );
}

function toPresenceMember(record: PresenceRecord): PresenceMember {
  return {
    userId: record.userId,
    name: record.name,
    avatarUrl: record.avatarUrl,
    role: record.role,
    activity: record.activity,
    tool: record.tool,
    lastSeenAt: record.lastSeenAt,
  };
}
