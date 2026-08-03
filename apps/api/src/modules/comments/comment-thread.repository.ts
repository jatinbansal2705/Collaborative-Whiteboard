import { Injectable } from '@nestjs/common';
import type {
  Comment,
  CommentThread,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CommentThreadWithComments = CommentThread & {
  resolver: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  comments: (Comment & {
    author: { id: string; name: string | null; avatarUrl: string | null };
  })[];
};

const THREAD_INCLUDE = {
  resolver: { select: { id: true, name: true, avatarUrl: true } },
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
} as const satisfies Prisma.CommentThreadInclude;

@Injectable()
export class CommentThreadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CommentThread | null> {
    return this.prisma.commentThread.findUnique({ where: { id } });
  }

  async findByIdWithComments(
    id: string,
  ): Promise<CommentThreadWithComments | null> {
    return this.prisma.commentThread.findUnique({
      where: { id },
      include: THREAD_INCLUDE,
    });
  }

  async listByBoard(boardId: string): Promise<CommentThreadWithComments[]> {
    return this.prisma.commentThread.findMany({
      where: { boardId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: THREAD_INCLUDE,
    });
  }

  async create(args: {
    boardId: string;
    x: number;
    y: number;
  }): Promise<CommentThread> {
    return this.prisma.commentThread.create({ data: args });
  }

  async setResolved(id: string, resolvedBy: string): Promise<CommentThread> {
    return this.prisma.commentThread.update({
      where: { id },
      data: { resolvedAt: new Date(), resolvedBy },
    });
  }

  async clearResolved(id: string): Promise<CommentThread> {
    return this.prisma.commentThread.update({
      where: { id },
      data: { resolvedAt: null, resolvedBy: null },
    });
  }
}
