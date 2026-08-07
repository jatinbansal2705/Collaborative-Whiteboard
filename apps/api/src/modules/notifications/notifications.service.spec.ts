import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { Notification } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { encodeDateCursor } from '../../common/utils/date-cursor';
import { RealtimeService } from '../realtime/realtime.service';
import {
  EMAIL_JOB_MENTION,
  EMAIL_QUEUE_NAME,
  MENTION_EMAIL_BODY_PREVIEW_MAX,
} from './notifications.constants';
import { NOTIFICATIONS_ERROR_CODES } from './notifications.errors';
import { NotificationRepository } from './notification.repository';
import { NotificationsService } from './notifications.service';
import type { EmailJobData, MentionEmailJobData } from './notification.types';
const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'alice@example.com',
  role: 'USER',
  sessionId: 'session-1',
};

const notification = (overrides: Partial<Notification> = {}): Notification => ({
  id: 'notification-1',
  userId: 'user-1',
  type: 'MENTION',
  payload: { boardId: 'board-1', threadId: 'thread-1' },
  readAt: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...overrides,
});

describe('NotificationsService', () => {
  let notificationRepository: jest.Mocked<
    Pick<
      NotificationRepository,
      | 'listForUser'
      | 'countUnread'
      | 'findById'
      | 'markAsRead'
      | 'markAllAsRead'
      | 'create'
    >
  >;
  let realtimeService: jest.Mocked<Pick<RealtimeService, 'emitNotification'>>;
  let emailQueue: jest.Mocked<Pick<Queue, 'add'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let service: NotificationsService;

  beforeEach(() => {
    notificationRepository = {
      listForUser: jest.fn().mockResolvedValue({
        items: [notification()],
        pageInfo: {
          hasNextPage: false,
          hasPrevPage: false,
          nextCursor: null,
          prevCursor: null,
        },
      }),
      countUnread: jest.fn().mockResolvedValue(3),
      findById: jest.fn().mockResolvedValue(notification()),
      markAsRead: jest
        .fn()
        .mockResolvedValue(notification({ readAt: new Date() })),
      markAllAsRead: jest.fn().mockResolvedValue(2),
      create: jest.fn().mockResolvedValue(notification()),
    };
    realtimeService = {
      emitNotification: jest.fn(),
    };
    emailQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    service = new NotificationsService(
      notificationRepository as unknown as NotificationRepository,
      realtimeService as unknown as RealtimeService,
      emailQueue as unknown as Queue<EmailJobData>,
      configService as unknown as ConfigService,
    );
  });

  describe('list', () => {
    it('lists notifications for the user and maps DTOs', async () => {
      const result = await service.list(USER, {});

      expect(notificationRepository.listForUser).toHaveBeenCalledWith({
        userId: 'user-1',
        cursor: null,
        limit: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'notification-1',
        userId: 'user-1',
        type: 'MENTION',
        payload: { boardId: 'board-1', threadId: 'thread-1' },
        readAt: null,
      });
    });

    it('decodes a valid before cursor', async () => {
      const cursor = encodeDateCursor(
        new Date('2026-08-01T00:00:00.000Z'),
        'notification-1',
      );

      await service.list(USER, { before: cursor });

      expect(notificationRepository.listForUser).toHaveBeenCalledWith({
        userId: 'user-1',
        cursor: { value: '2026-08-01T00:00:00.000Z', id: 'notification-1' },
        limit: 20,
      });
    });

    it('rejects an invalid cursor', async () => {
      await expect(
        service.list(USER, { before: 'garbage' }),
      ).rejects.toMatchObject({
        response: { code: NOTIFICATIONS_ERROR_CODES.INVALID_CURSOR },
      });
      expect(notificationRepository.listForUser).not.toHaveBeenCalled();
    });
  });

  describe('unread count', () => {
    it('returns the unread count for the user', async () => {
      await expect(service.getUnreadCount(USER)).resolves.toEqual({
        unreadCount: 3,
      });
      expect(notificationRepository.countUnread).toHaveBeenCalledWith('user-1');
    });
  });

  describe('markAsRead', () => {
    it('marks a notification the user owns as read', async () => {
      const result = await service.markAsRead(USER, 'notification-1');

      expect(notificationRepository.findById).toHaveBeenCalledWith(
        'notification-1',
      );
      expect(notificationRepository.markAsRead).toHaveBeenCalledWith(
        'notification-1',
      );
      expect(result.readAt).not.toBeNull();
    });

    it('throws NOTIFICATION_NOT_FOUND for a missing notification', async () => {
      notificationRepository.findById.mockResolvedValue(null);

      await expect(service.markAsRead(USER, 'missing')).rejects.toMatchObject({
        response: { code: NOTIFICATIONS_ERROR_CODES.NOTIFICATION_NOT_FOUND },
      });
      expect(notificationRepository.markAsRead).not.toHaveBeenCalled();
    });

    it('throws NOTIFICATION_NOT_FOUND for another users notification', async () => {
      notificationRepository.findById.mockResolvedValue(
        notification({ userId: 'user-2' }),
      );

      await expect(
        service.markAsRead(USER, 'notification-1'),
      ).rejects.toMatchObject({
        response: { code: NOTIFICATIONS_ERROR_CODES.NOTIFICATION_NOT_FOUND },
      });
      expect(notificationRepository.markAsRead).not.toHaveBeenCalled();
    });
  });

  describe('markAllRead', () => {
    it('marks every unread notification for the user', async () => {
      await expect(service.markAllRead(USER)).resolves.toEqual({ updated: 2 });
      expect(notificationRepository.markAllAsRead).toHaveBeenCalledWith(
        'user-1',
      );
    });
  });

  describe('createInApp', () => {
    it('persists and pushes a realtime notification', async () => {
      notificationRepository.create.mockResolvedValue(
        notification({ userId: 'user-2' }),
      );

      const result = await service.createInApp({
        userId: 'user-2',
        type: 'MENTION',
        payload: { boardId: 'board-1', threadId: 'thread-1', commentId: 'c-1' },
      });

      expect(notificationRepository.create).toHaveBeenCalledWith({
        userId: 'user-2',
        type: 'MENTION',
        payload: { boardId: 'board-1', threadId: 'thread-1', commentId: 'c-1' },
      });
      expect(realtimeService.emitNotification).toHaveBeenCalledWith('user-2', {
        notificationId: 'notification-1',
        type: 'MENTION',
        payload: { boardId: 'board-1', threadId: 'thread-1' },
        readAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      });
      expect(result).toEqual(notification({ userId: 'user-2' }));
    });
  });

  describe('enqueueMentionEmail', () => {
    it('enqueues a mention email job with default retry config', async () => {
      await service.enqueueMentionEmail({
        to: 'bob@example.com',
        recipientName: 'Bob',
        actorName: 'Alice',
        boardId: 'board-1',
        threadId: 'thread-1',
        commentId: 'comment-1',
        bodyPreview: 'Re @bob check this',
        frontendUrl: 'http://localhost:3001',
      });

      expect(emailQueue.add).toHaveBeenCalledWith(
        EMAIL_JOB_MENTION,
        expect.objectContaining({
          to: 'bob@example.com',
          recipientName: 'Bob',
          bodyPreview: 'Re @bob check this',
        }),
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
          removeOnFail: { age: 60 * 60 * 24 * 7, count: 1000 },
        },
      );
      expect(emailQueue.add).toHaveBeenCalledTimes(1);
      expect(configService.get).toHaveBeenCalledWith('queue.emailAttempts');
    });

    it('uses queue config overrides when present', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'queue.emailAttempts') {
          return 5;
        }
        if (key === 'queue.emailBackoffMs') {
          return 10_000;
        }
        return undefined;
      });

      await service.enqueueMentionEmail({
        to: 'bob@example.com',
        recipientName: null,
        actorName: null,
        boardId: 'board-1',
        threadId: 'thread-1',
        commentId: 'comment-1',
        bodyPreview: 'short',
        frontendUrl: 'http://localhost:3001',
      });

      expect(emailQueue.add).toHaveBeenCalledWith(
        EMAIL_JOB_MENTION,
        expect.any(Object),
        expect.objectContaining({ attempts: 5 }),
      );
    });

    it('truncates the body preview to the configured max', async () => {
      const longBody = 'x'.repeat(MENTION_EMAIL_BODY_PREVIEW_MAX + 50);

      await service.enqueueMentionEmail({
        to: 'bob@example.com',
        recipientName: null,
        actorName: null,
        boardId: 'board-1',
        threadId: 'thread-1',
        commentId: 'comment-1',
        bodyPreview: longBody,
        frontendUrl: 'http://localhost:3001',
      });

      const data = emailQueue.add.mock.calls[0][1] as MentionEmailJobData;
      expect(data.bodyPreview).toHaveLength(MENTION_EMAIL_BODY_PREVIEW_MAX);
    });

    it('uses the injected queue name token', () => {
      expect(EMAIL_QUEUE_NAME).toBe('email');
    });
  });
});
