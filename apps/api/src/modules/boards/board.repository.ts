import { Injectable } from '@nestjs/common';
import type {
  Board,
  BoardMemberRole,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildBoardOrderBy,
  buildCursorWhere,
  encodeCursor,
  sortableCursorValue,
  type BoardSortBy,
  type BoardSortOrder,
  type CursorPage,
  type DecodedCursor,
} from './cursor-pagination';

export type BoardListTab = 'recent' | 'shared' | 'favourited';

export interface BoardListParams {
  userId: string;
  tab: BoardListTab;
  search?: string;
  sortBy: BoardSortBy;
  order: BoardSortOrder;
  archived: boolean;
  template?: boolean;
  ownedByMe?: boolean;
  cursor: DecodedCursor | null;
  limit: number;
}

export interface BoardListRow {
  board: Board;
  isFavourite: boolean;
  myRole: BoardMemberRole;
}

export interface BoardRepositoryCreateInput {
  title: string;
  data: Prisma.InputJsonValue;
  thumbnailUrl?: string;
  isTemplate: boolean;
  createdById: string;
}

const BOARD_LIST_INCLUDE = {
  favourites: { select: { id: true } },
  members: { select: { role: true } },
} satisfies Prisma.BoardInclude;

type BoardListResult = Board & {
  favourites: { id: string }[];
  members: { role: BoardMemberRole }[];
};

@Injectable()
export class BoardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithOwner(input: BoardRepositoryCreateInput): Promise<Board> {
    return this.prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          title: input.title,
          data: input.data,
          thumbnailUrl: input.thumbnailUrl,
          isTemplate: input.isTemplate,
          createdById: input.createdById,
          memberCount: 1,
        },
      });
      await tx.boardMember.create({
        data: {
          boardId: board.id,
          userId: input.createdById,
          role: 'OWNER',
        },
      });
      return board;
    });
  }

  async findById(id: string): Promise<Board | null> {
    return this.prisma.board.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findTemplateById(id: string): Promise<Board | null> {
    return this.prisma.board.findFirst({
      where: { id, isTemplate: true, deletedAt: null },
    });
  }

  async findByIdWithDetails(id: string): Promise<Board | null> {
    return this.prisma.board.findFirst({
      where: { id, deletedAt: null },
      include: { createdBy: { select: { id: true, email: true, name: true } } },
    });
  }

  async update(id: string, data: Prisma.BoardUpdateInput): Promise<Board> {
    return this.prisma.board.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<Board> {
    return this.prisma.board.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async listForUser(
    params: BoardListParams,
  ): Promise<CursorPage<BoardListRow>> {
    const where = this.buildWhere(params);
    if (params.cursor !== null) {
      where.AND = [
        buildCursorWhere(params.sortBy, params.order, params.cursor),
      ];
    }

    const rows = await this.prisma.board.findMany({
      where,
      orderBy: buildBoardOrderBy(params.sortBy, params.order),
      take: params.limit + 1,
      include: BOARD_LIST_INCLUDE,
    });

    return this.toPage(rows, params);
  }

  async listTemplates(): Promise<Board[]> {
    return this.prisma.board.findMany({
      where: { isTemplate: true, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async incrementMemberCount(boardId: string): Promise<void> {
    await this.prisma.board.update({
      where: { id: boardId },
      data: { memberCount: { increment: 1 } },
    });
  }

  async decrementMemberCount(boardId: string): Promise<void> {
    await this.prisma.board.update({
      where: { id: boardId },
      data: { memberCount: { decrement: 1 } },
    });
  }

  private buildWhere(params: BoardListParams): Prisma.BoardWhereInput {
    const where: Prisma.BoardWhereInput = {
      deletedAt: null,
      isArchived: params.archived,
    };

    if (params.template !== undefined) {
      where.isTemplate = params.template;
    }

    if (params.ownedByMe === true) {
      where.createdById = params.userId;
    } else if (params.ownedByMe === false) {
      where.NOT = { createdById: params.userId };
    }

    if (params.search !== undefined && params.search.length > 0) {
      where.title = { contains: params.search, mode: 'insensitive' };
    }

    if (params.tab === 'recent') {
      where.members = { some: { userId: params.userId } };
    } else if (params.tab === 'shared') {
      where.members = { some: { userId: params.userId } };
      where.NOT = {
        ...(where.NOT as Prisma.BoardWhereInput),
        createdById: params.userId,
      };
    } else {
      where.favourites = { some: { userId: params.userId } };
    }

    return where;
  }

  private toPage(
    rows: BoardListResult[],
    params: BoardListParams,
  ): CursorPage<BoardListRow> {
    const items = rows.slice(0, params.limit);
    const hasNextPage = rows.length > params.limit;

    const lastItem = items[items.length - 1];
    const firstItem = items[0];

    return {
      items: items.map((row) => ({
        board: row,
        isFavourite: row.favourites.length > 0,
        myRole: row.members[0]?.role ?? 'VIEWER',
      })),
      pageInfo: {
        hasNextPage,
        hasPrevPage: params.cursor !== null,
        nextCursor:
          hasNextPage && lastItem !== undefined
            ? encodeCursor(
                sortableCursorValue(params.sortBy, lastItem[params.sortBy]),
                lastItem.id,
              )
            : null,
        prevCursor:
          firstItem !== undefined && params.cursor !== null
            ? encodeCursor(
                sortableCursorValue(params.sortBy, firstItem[params.sortBy]),
                firstItem.id,
              )
            : null,
      },
    };
  }
}
