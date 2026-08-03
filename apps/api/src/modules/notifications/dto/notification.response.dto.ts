import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  Notification,
  NotificationType,
  Prisma,
} from '../../../generated/prisma/client';
import type { CursorPageInfo } from '../../boards/cursor-pagination';

export class NotificationResponseDto {
  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  id!: string;

  @ApiProperty({ example: '6f1e4b3a-0f3d-4a7c-9a11-1a1a1a1a1a1a' })
  userId!: string;

  @ApiProperty({ example: 'MENTION' })
  type!: NotificationType;

  @ApiProperty({
    description: 'Domain-specific payload (board, thread, actor, etc.)',
    type: Object,
    example: { boardId: 'board-1', threadId: 'thread-1', actorName: 'Ada' },
  })
  payload!: Prisma.JsonValue;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  readAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class NotificationListMetaDto {
  @ApiProperty({ type: 'boolean', example: false })
  hasNextPage!: boolean;

  @ApiProperty({ type: 'boolean', example: false })
  hasPrevPage!: boolean;

  @ApiProperty({ type: 'string', nullable: true })
  nextCursor!: string | null;

  @ApiProperty({ type: 'string', nullable: true })
  prevCursor!: string | null;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: NotificationResponseDto, isArray: true })
  data!: NotificationResponseDto[];

  @ApiProperty({ type: NotificationListMetaDto })
  meta!: NotificationListMetaDto;
}

export function toNotification(
  notification: Notification,
): NotificationResponseDto {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    payload: notification.payload,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}

export function toNotificationListMeta(
  pageInfo: CursorPageInfo,
): NotificationListMetaDto {
  return {
    hasNextPage: pageInfo.hasNextPage,
    hasPrevPage: pageInfo.hasPrevPage,
    nextCursor: pageInfo.nextCursor,
    prevCursor: pageInfo.prevCursor,
  };
}
