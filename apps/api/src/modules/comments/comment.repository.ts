import { Injectable } from '@nestjs/common';
import type { Comment } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type CommentWithAuthor = Comment & {
  author: { id: string; name: string | null; avatarUrl: string | null };
};

export type CommentMentionRecord = {
  userId: string;
  username: string;
};

@Injectable()
export class CommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Comment | null> {
    return this.prisma.comment.findUnique({ where: { id } });
  }

  async create(args: {
    threadId: string;
    authorId: string;
    body: string;
    mentions: CommentMentionRecord[];
  }): Promise<CommentWithAuthor> {
    return this.prisma.comment.create({
      data: {
        threadId: args.threadId,
        authorId: args.authorId,
        body: args.body,
        mentions: args.mentions,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }
}
