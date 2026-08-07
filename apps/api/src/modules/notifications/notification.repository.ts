import { Injectable } from '@nestjs/common';
import type {
  Notification,
  NotificationType,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CursorPageInfo } from '../boards/cursor-pagination';
import {
  buildDateCursorWhere,
  encodeDateCursor,
  type DecodedDateCursor,
} from '../../common/utils/date-cursor';

export interface NotificationPage {
  items: Notification[];
  pageInfo: CursorPageInfo;
}

export interface CreateNotificationArgs {
  userId: string;
  type: NotificationType;
  payload: Prisma.InputJsonValue;
}

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async listForUser(args: {
    userId: string;
    cursor: DecodedDateCursor | null;
    limit: number;
  }): Promise<NotificationPage> {
    const orderBy: Prisma.NotificationOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];
    const where: Prisma.NotificationWhereInput = {
      userId: args.userId,
      ...(args.cursor !== null
        ? buildDateCursorWhere('desc', args.cursor)
        : {}),
    };
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy,
      take: args.limit + 1,
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

  async create(args: CreateNotificationArgs): Promise<Notification> {
    return this.prisma.notification.create({
      data: {
        userId: args.userId,
        type: args.type,
        payload: args.payload,
      },
    });
  }

  async markAsRead(id: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }
}
