import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ChatReadReceipt } from '../../../generated/prisma/client';
import type { CursorPageInfo } from '../../boards/cursor-pagination';

export class ChatMessageAuthorDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiPropertyOptional({ example: 'Ada Lovelace' })
  name!: string | null;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/.../avatar.png' })
  avatarUrl!: string | null;
}

export class ChatMessageResponseDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  boardId!: string;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  authorId!: string;

  @ApiPropertyOptional({ example: 'First iteration looks great' })
  body!: string | null;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../chat/attachment.png',
  })
  attachmentUrl!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: ChatMessageAuthorDto })
  author!: ChatMessageAuthorDto;
}

export class ChatMessageListMetaDto {
  @ApiProperty({ type: 'boolean', example: false })
  hasNextPage!: boolean;

  @ApiProperty({ type: 'boolean', example: false })
  hasPrevPage!: boolean;

  @ApiProperty({ type: 'string', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  prevCursor!: string | null;
}

export class ChatMessageListResponseDto {
  @ApiProperty({ type: ChatMessageResponseDto, isArray: true })
  data!: ChatMessageResponseDto[];

  @ApiProperty({ type: ChatMessageListMetaDto })
  meta!: ChatMessageListMetaDto;
}

export interface ChatMessageSourceRow {
  id: string;
  boardId: string;
  authorId: string;
  body: string | null;
  attachmentUrl: string | null;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export function toChatMessage(
  row: ChatMessageSourceRow,
): ChatMessageResponseDto {
  return {
    id: row.id,
    boardId: row.boardId,
    authorId: row.authorId,
    body: row.body,
    attachmentUrl: row.attachmentUrl,
    createdAt: row.createdAt,
    author: {
      id: row.author.id,
      name: row.author.name,
      avatarUrl: row.author.avatarUrl,
    },
  };
}

export function toChatMessageListMeta(
  pageInfo: CursorPageInfo,
): ChatMessageListMetaDto {
  return {
    hasNextPage: pageInfo.hasNextPage,
    hasPrevPage: pageInfo.hasPrevPage,
    nextCursor: pageInfo.nextCursor,
    prevCursor: pageInfo.prevCursor,
  };
}

export class ChatReadReceiptResponseDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  boardId!: string;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  userId!: string;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  lastReadMessageId!: string;

  @ApiProperty()
  lastReadAt!: Date;
}

export function toChatReadReceipt(
  receipt: ChatReadReceipt,
): ChatReadReceiptResponseDto {
  return {
    boardId: receipt.boardId,
    userId: receipt.userId,
    lastReadMessageId: receipt.lastReadMessageId,
    lastReadAt: receipt.lastReadAt,
  };
}
