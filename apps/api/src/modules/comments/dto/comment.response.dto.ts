import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Comment, CommentThread } from '../../../generated/prisma/client';

export class CommentAuthorDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiPropertyOptional({ example: 'Ada Lovelace' })
  name!: string | null;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../avatar.png' })
  avatarUrl!: string | null;
}

export class CommentMentionDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  userId!: string;

  @ApiProperty({ example: 'ada' })
  username!: string;
}

export class CommentResponseDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  threadId!: string;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  authorId!: string;

  @ApiProperty({ example: 'First iteration looks great @ada' })
  body!: string;

  @ApiProperty({ type: CommentMentionDto, isArray: true })
  mentions!: CommentMentionDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: CommentAuthorDto })
  author!: CommentAuthorDto;
}

export class CommentThreadResponseDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  boardId!: string;

  @ApiProperty({ example: 120 })
  x!: number;

  @ApiProperty({ example: 340 })
  y!: number;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  resolvedAt!: Date | null;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  resolvedBy!: string | null;

  @ApiPropertyOptional({ type: CommentAuthorDto, nullable: true })
  resolvedByUser!: CommentAuthorDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: CommentResponseDto, isArray: true })
  comments!: CommentResponseDto[];
}

export interface CommentSourceRow {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; name: string | null; avatarUrl: string | null };
}

export function toComment(
  comment: Comment & {
    author: { id: string; name: string | null; avatarUrl: string | null };
  },
): CommentResponseDto {
  return {
    id: comment.id,
    threadId: comment.threadId,
    authorId: comment.authorId,
    body: comment.body,
    mentions: toCommentMentions(comment.mentions),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.author,
  };
}

export function toCommentThread(
  thread: CommentThread & {
    resolver: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
    } | null;
    comments: (Comment & {
      author: { id: string; name: string | null; avatarUrl: string | null };
    })[];
  },
): CommentThreadResponseDto {
  return {
    id: thread.id,
    boardId: thread.boardId,
    x: thread.x,
    y: thread.y,
    resolvedAt: thread.resolvedAt,
    resolvedBy: thread.resolvedBy,
    resolvedByUser: thread.resolver,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    comments: thread.comments.map(toComment),
  };
}

function toCommentMentions(value: unknown): CommentMentionDto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return null;
      }
      const record = entry as Record<string, unknown>;
      if (
        typeof record.userId !== 'string' ||
        typeof record.username !== 'string'
      ) {
        return null;
      }
      return { userId: record.userId, username: record.username };
    })
    .filter((mention): mention is CommentMentionDto => mention !== null);
}
