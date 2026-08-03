import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Notification } from '../../generated/prisma/client';
import type { NotificationNewEvent } from '@whiteboard/shared';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { decodeDateCursor } from '../../common/utils/date-cursor';
import { RealtimeService } from '../realtime/realtime.service';
import {
  NOTIFICATIONS_LIST_DEFAULT_LIMIT,
  EMAIL_QUEUE_NAME,
  EMAIL_JOB_MENTION,
  MENTION_EMAIL_BODY_PREVIEW_MAX,
} from './notifications.constants';
import {
  invalidNotificationsCursor,
  notificationNotFound,
} from './notifications.errors';
import { NotificationRepository } from './notification.repository';
import {
  toNotification,
  toNotificationListMeta,
  type NotificationListResponseDto,
  type NotificationResponseDto,
} from './dto/notification.response.dto';
import type { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import {
  asRecord,
  type CreateNotificationArgs,
  type EmailJobData,
  type MentionEmailJobData,
} from './notification.types';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService: RealtimeService,
    @InjectQueue(EMAIL_QUEUE_NAME)
    private readonly emailQueue: Queue<EmailJobData>,
    private readonly configService: ConfigService,
  ) {}

  async list(
    user: AuthenticatedUser,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    const limit = query.limit ?? NOTIFICATIONS_LIST_DEFAULT_LIMIT;
    const cursor =
      query.before === undefined ? null : decodeDateCursor(query.before);
    if (query.before !== undefined && cursor === null) {
      throw invalidNotificationsCursor();
    }

    const page = await this.notificationRepository.listForUser({
      userId: user.id,
      cursor,
      limit,
    });
    return {
      data: page.items.map(toNotification),
      meta: toNotificationListMeta(page.pageInfo),
    };
  }

  async getUnreadCount(
    user: AuthenticatedUser,
  ): Promise<{ unreadCount: number }> {
    const unreadCount = await this.notificationRepository.countUnread(user.id);
    return { unreadCount };
  }

  async markAsRead(
    user: AuthenticatedUser,
    notificationId: string,
  ): Promise<NotificationResponseDto> {
    const notification =
      await this.notificationRepository.findById(notificationId);
    if (notification === null || notification.userId !== user.id) {
      throw notificationNotFound();
    }
    const updated =
      await this.notificationRepository.markAsRead(notificationId);
    return toNotification(updated);
  }

  async markAllRead(user: AuthenticatedUser): Promise<{ updated: number }> {
    const updated = await this.notificationRepository.markAllAsRead(user.id);
    return { updated };
  }

  /**
   * Persists an in-app notification and pushes it to the recipient's connected
   * sockets in realtime. Does not send email; use `enqueueMentionEmail` for
   * mention digests.
   */
  async createInApp(args: CreateNotificationArgs): Promise<Notification> {
    const created = await this.notificationRepository.create(args);
    this.realtimeService.emitNotification(
      created.userId,
      this.toNotificationNewEvent(created),
    );
    return created;
  }

  async enqueueMentionEmail(data: MentionEmailJobData): Promise<void> {
    const attempts = this.configService.get<number>('queue.emailAttempts') ?? 3;
    const backoffMs =
      this.configService.get<number>('queue.emailBackoffMs') ?? 5000;
    await this.emailQueue.add(
      EMAIL_JOB_MENTION,
      {
        ...data,
        bodyPreview: data.bodyPreview.slice(0, MENTION_EMAIL_BODY_PREVIEW_MAX),
      },
      {
        attempts,
        backoff: { type: 'exponential', delay: backoffMs },
        removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
        removeOnFail: { age: 60 * 60 * 24 * 7, count: 1000 },
      },
    );
  }

  private toNotificationNewEvent(
    notification: Notification,
  ): NotificationNewEvent {
    return {
      notificationId: notification.id,
      type: notification.type,
      payload: asRecord(notification.payload),
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
