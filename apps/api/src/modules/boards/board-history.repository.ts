import { Injectable } from '@nestjs/common';
import type {
  Board,
  BoardActivity,
  BoardActivityType,
  BoardVersion,
  BoardVersionKind,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CursorPage, CursorPageInfo } from './cursor-pagination';
import {
  buildDateCursorWhere,
  encodeDateCursor,
  type DecodedDateCursor,
} from '../../common/utils/date-cursor';

/**
 * Persistence for board version snapshots and the activity timeline (Phase 13).
 *
 * Snapshots are server-side history kept separate from in-session undo/redo
 * (ADR-0005). Every persisted save runs in one transaction: a new `BoardVersion`
 * is written, `boards.revision` is bumped to the same number, an activity row is
 * recorded, and auto snapshots beyond the retention cap are pruned.
 *
 * The unique `(boardId, versionNo)` constraint doubles as the concurrency guard:
 * two saves based on the same revision collide on insert, the loser rolls back
 * and surfaces a `conflict` result carrying the authoritative revision + data.
 */

export interface SaveBoardDataArgs {
  boardId: string;
  /** The document the client believes it is based on; `null` saves blindly (import/restore). */
  baseRevision: number | null;
  data: Prisma.InputJsonValue;
  schemaVersion: number;
  elementCount: number;
  actorId: string;
  kind: BoardVersionKind;
  note?: string;
  activityType: BoardActivityType;
  /** Manual saves always create a version, even when the document is unchanged. */
  forceCreate?: boolean;
}

export type SaveBoardDataResult =
  | { status: 'missing' }
  | {
      status: 'conflict';
      currentRevision: number;
      data: Prisma.JsonValue;
    }
  | {
      status: 'unchanged';
      revision: number;
      data: Prisma.JsonValue;
      version: null;
    }
  | {
      status: 'created';
      revision: number;
      data: Prisma.JsonValue;
      version: BoardVersion;
    };
export interface RestoreVersionResult {
  board: Board;
  targetVersion: BoardVersion;
}

export type VersionListRow = BoardVersion & {
  createdBy: { id: string; name: string | null; avatarUrl: string | null };
};

export type ActivityListRow = BoardActivity & {
  actor: { id: string; name: string | null; avatarUrl: string | null };
};

export interface VersionCursor {
  versionNo: number;
  id: string;
}

export interface ActivityCursor {
  value: string;
  id: string;
}

const VERSION_ORDER = [{ versionNo: 'desc' as const }, { id: 'desc' as const }];

const ACTIVITY_ORDER = [
  { createdAt: 'desc' as const },
  { id: 'desc' as const },
];

const AUTHOR_SELECT = {
  select: { id: true, name: true, avatarUrl: true },
} as const;

export function encodeVersionCursor(cursor: VersionCursor): string {
  const serialized = JSON.stringify([cursor.versionNo, cursor.id]);
  return Buffer.from(serialized, 'utf8').toString('base64url');
}

export function decodeVersionCursor(
  cursor: string | undefined,
): VersionCursor | null {
  if (cursor === undefined || cursor === '') {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (!Array.isArray(payload) || payload.length !== 2) {
      return null;
    }
    const rawVersionNo: unknown = payload[0];
    const id: unknown = payload[1];
    if (
      typeof rawVersionNo !== 'number' ||
      !Number.isInteger(rawVersionNo) ||
      rawVersionNo < 0
    ) {
      return null;
    }
    if (typeof id !== 'string' || id.length === 0) {
      return null;
    }
    return { versionNo: rawVersionNo, id };
  } catch {
    return null;
  }
}

@Injectable()
export class BoardHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a document save with revision-based conflict detection. See the
   * class comment for the concurrency model.
   */
  async saveData(args: SaveBoardDataArgs): Promise<SaveBoardDataResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const board = await tx.board.findUnique({
          where: { id: args.boardId },
        });
        if (board === null) {
          return { status: 'missing' } as const;
        }

        const currentRevision = board.revision;
        if (
          args.baseRevision !== null &&
          args.baseRevision !== currentRevision
        ) {
          return {
            status: 'conflict',
            currentRevision,
            data: board.data,
          } as const;
        }

        const changed =
          args.forceCreate === true || !jsonEquals(board.data, args.data);
        if (!changed) {
          return {
            status: 'unchanged',
            revision: currentRevision,
            data: board.data,
            version: null,
          } as const;
        }

        const versionNo = currentRevision + 1;
        const version = await tx.boardVersion.create({
          data: {
            boardId: args.boardId,
            versionNo,
            kind: args.kind,
            note: args.note ?? null,
            data: args.data,
            schemaVersion: args.schemaVersion,
            elementCount: args.elementCount,
            createdById: args.actorId,
          },
        });

        await tx.board.update({
          where: { id: args.boardId },
          data: {
            data: args.data,
            revision: versionNo,
            updatedAt: new Date(),
          },
        });

        await tx.boardActivity.create({
          data: {
            boardId: args.boardId,
            type: args.activityType,
            actorId: args.actorId,
            versionNo,
            details: { versionNo },
          },
        });

        await this.pruneAutoVersions(tx, args.boardId);

        return {
          status: 'created',
          revision: versionNo,
          data: args.data as Prisma.JsonValue,
          version,
        } as const;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return this.conflictAfterLostRace(args.boardId);
      }
      throw error;
    }
  }

  /**
   * Restores a board to a historical version. The pre-restore state is snapshotted
   * as a new AUTO version first, so the operation is never destructive.
   */
  async restoreVersion(
    boardId: string,
    versionNo: number,
    actorId: string,
  ): Promise<RestoreVersionResult | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const [board, targetVersion] = await Promise.all([
          tx.board.findUnique({ where: { id: boardId } }),
          tx.boardVersion.findUnique({
            where: { boardId_versionNo: { boardId, versionNo } },
          }),
        ]);
        if (board === null || targetVersion === null) {
          return null;
        }

        const nextRevision = board.revision + 1;
        await tx.boardVersion.create({
          data: {
            boardId,
            versionNo: nextRevision,
            kind: 'AUTO',
            note: null,
            data: board.data as Prisma.InputJsonValue,
            schemaVersion: 1,
            elementCount: countElements(board.data),
            createdById: actorId,
          },
        });

        await tx.board.update({
          where: { id: boardId },
          data: {
            data: targetVersion.data as Prisma.InputJsonValue,
            revision: nextRevision,
            updatedAt: new Date(),
          },
        });

        await tx.boardActivity.create({
          data: {
            boardId,
            type: 'VERSION_RESTORE',
            actorId,
            versionNo: nextRevision,
            details: { restoredVersionNo: versionNo },
          },
        });

        await this.pruneAutoVersions(tx, boardId);

        const updatedBoard = await tx.board.findUniqueOrThrow({
          where: { id: boardId },
        });
        return { board: updatedBoard, targetVersion };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  async listVersions(
    boardId: string,
    cursor: VersionCursor | null,
    limit: number,
  ): Promise<CursorPage<VersionListRow>> {
    const where: Prisma.BoardVersionWhereInput = { boardId };
    if (cursor !== null) {
      where.OR = [
        { versionNo: { lt: cursor.versionNo } },
        {
          versionNo: cursor.versionNo,
          id: { lt: cursor.id },
        },
      ];
    }

    const rows = await this.prisma.boardVersion.findMany({
      where,
      orderBy: VERSION_ORDER,
      take: limit + 1,
      include: { createdBy: AUTHOR_SELECT },
    });

    return this.toVersionPage(rows, limit, cursor);
  }

  async findVersion(
    boardId: string,
    versionNo: number,
  ): Promise<VersionListRow | null> {
    return this.prisma.boardVersion.findUnique({
      where: { boardId_versionNo: { boardId, versionNo } },
      include: { createdBy: AUTHOR_SELECT },
    });
  }

  async findLatestVersion(boardId: string): Promise<BoardVersion | null> {
    return this.prisma.boardVersion.findFirst({
      where: { boardId },
      orderBy: { versionNo: 'desc' },
    });
  }

  async listActivity(
    boardId: string,
    cursor: DecodedDateCursor | null,
    limit: number,
  ): Promise<CursorPage<ActivityListRow>> {
    const where: Prisma.BoardActivityWhereInput = {
      boardId,
      ...(cursor !== null ? buildDateCursorWhere('desc', cursor) : {}),
    };

    const rows = await this.prisma.boardActivity.findMany({
      where,
      orderBy: ACTIVITY_ORDER,
      take: limit + 1,
      include: { actor: AUTHOR_SELECT },
    });

    const items = rows.slice(0, limit);
    const hasNextPage = rows.length > limit;
    const last = items[items.length - 1];
    const first = items[0];

    return {
      items,
      pageInfo: {
        hasNextPage,
        hasPrevPage: cursor !== null,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeDateCursor(last.createdAt, last.id)
            : null,
        prevCursor:
          first !== undefined && cursor !== null
            ? encodeDateCursor(first.createdAt, first.id)
            : null,
      },
    };
  }

  async recordActivity(args: {
    boardId: string;
    type: BoardActivityType;
    actorId: string;
    versionNo?: number;
    details?: Prisma.InputJsonValue;
  }): Promise<BoardActivity> {
    return this.prisma.boardActivity.create({
      data: {
        boardId: args.boardId,
        type: args.type,
        actorId: args.actorId,
        versionNo: args.versionNo ?? null,
        details: args.details ?? {},
      },
    });
  }

  private toVersionPage(
    rows: VersionListRow[],
    limit: number,
    cursor: VersionCursor | null,
  ): CursorPage<VersionListRow> {
    const items = rows.slice(0, limit);
    const hasNextPage = rows.length > limit;
    const last = items[items.length - 1];
    const first = items[0];

    const pageInfo: CursorPageInfo = {
      hasNextPage,
      hasPrevPage: cursor !== null,
      nextCursor:
        hasNextPage && last !== undefined
          ? encodeVersionCursor({ versionNo: last.versionNo, id: last.id })
          : null,
      prevCursor:
        first !== undefined && cursor !== null
          ? encodeVersionCursor({ versionNo: first.versionNo, id: first.id })
          : null,
    };
    return { items, pageInfo };
  }

  private async pruneAutoVersions(
    tx: Prisma.TransactionClient,
    boardId: string,
  ): Promise<void> {
    const keep = await tx.boardVersion.findMany({
      where: { boardId, kind: 'AUTO' },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true },
      take: VERSIONS_AUTO_RETENTION,
    });
    if (keep.length < VERSIONS_AUTO_RETENTION) {
      return;
    }
    const oldestKept = keep[keep.length - 1].versionNo;
    await tx.boardVersion.deleteMany({
      where: { boardId, kind: 'AUTO', versionNo: { lt: oldestKept } },
    });
  }

  private async conflictAfterLostRace(
    boardId: string,
  ): Promise<SaveBoardDataResult> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
    });
    if (board === null) {
      return { status: 'missing' };
    }
    return {
      status: 'conflict',
      currentRevision: board.revision,
      data: board.data,
    };
  }
}

const VERSIONS_AUTO_RETENTION = 100;

function jsonEquals(a: Prisma.JsonValue, b: Prisma.InputJsonValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function countElements(data: Prisma.JsonValue): number {
  if (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    'elements' in data &&
    Array.isArray(data.elements)
  ) {
    return data.elements.length;
  }
  return 0;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
