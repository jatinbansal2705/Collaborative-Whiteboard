import { Injectable } from '@nestjs/common';
import type {
  ChatMessage,
  ChatReadReceipt,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CursorPageInfo } from '../boards/cursor-pagination';
import {
  buildDateCursorWhere,
  encodeDateCursor,
  type DecodedDateCursor,
} from '../../common/utils/date-cursor';
import type { ChatMessageSourceRow } from './dto/chat-message.response.dto';

export interface ChatMessagePage {
  items: ChatMessageSourceRow[];
  pageInfo: CursorPageInfo;
}

export interface CreateChatMessageArgs {
  boardId: string;
  authorId: string;
  body: string | null;
  attachmentUrl: string | null;
}

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ChatMessage | null> {
    return this.prisma.chatMessage.findUnique({ where: { id } });
  }

  async findReadReceipt(
    boardId: string,
    userId: string,
  ): Promise<ChatReadReceipt | null> {
    return this.prisma.chatReadReceipt.findUnique({
      where: { boardId_userId: { boardId, userId } },
    });
  }

  async listByBoard(args: {
    boardId: string;
    cursor: DecodedDateCursor | null;
    limit: number;
  }): Promise<ChatMessagePage> {
    const orderBy: Prisma.ChatMessageOrderByWithRelationInput = {
      createdAt: 'desc',
      id: 'desc',
    };
    const where: Prisma.ChatMessageWhereInput = {
      boardId: args.boardId,
      deletedAt: null,
      ...(args.cursor !== null
        ? buildDateCursorWhere('desc', args.cursor)
        : {}),
    };
    const rows = await this.prisma.chatMessage.findMany({
      where,
      orderBy,
      take: args.limit + 1,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    const hasNextPage = rows.length > args.limit;
    const items = rows.slice(0, args.limit);
    const last = items[items.length - 1];
    return {
      items,
      pageInfo: {
        hasNextPage,
        hasPrevPage: false,
        nextCursor:
          hasNextPage && last !== undefined
            ? encodeDateCursor(last.createdAt, last.id)
            : null,
        prevCursor: null,
      },
    };
  }

  async createMessage(
    args: CreateChatMessageArgs,
  ): Promise<ChatMessageSourceRow> {
    return this.prisma.chatMessage.create({
      data: {
        boardId: args.boardId,
        authorId: args.authorId,
        body: args.body,
        attachmentUrl: args.attachmentUrl,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async upsertReadReceipt(args: {
    boardId: string;
    userId: string;
    lastReadMessageId: string;
    lastReadAt: Date;
  }): Promise<ChatReadReceipt> {
    return this.prisma.chatReadReceipt.upsert({
      where: { boardId_userId: { boardId: args.boardId, userId: args.userId } },
      update: {
        lastReadMessageId: args.lastReadMessageId,
        lastReadAt: args.lastReadAt,
      },
      create: {
        boardId: args.boardId,
        userId: args.userId,
        lastReadMessageId: args.lastReadMessageId,
        lastReadAt: args.lastReadAt,
      },
    });
  }
}
