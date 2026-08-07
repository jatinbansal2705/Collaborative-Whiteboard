import { ConfigService } from '@nestjs/config';
import type { Comment, CommentThread } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { UserRepository } from '../auth/repositories/user.repository';
import {
  MemberRepository,
  type BoardMemberWithUser,
} from '../boards/member.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CommentThreadRepository } from './comment-thread.repository';
import {
  CommentRepository,
  type CommentMentionRecord,
} from './comment.repository';
import { COMMENTS_ERROR_CODES } from './comments.errors';
import { CommentsService } from './comments.service';

const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'alice@example.com',
  role: 'USER',
  sessionId: 'session-1',
};

const thread = (overrides: Partial<CommentThread> = {}): CommentThread => ({
  id: 'thread-1',
  boardId: 'board-1',
  x: 120,
  y: 340,
  resolvedAt: null,
  resolvedBy: null,
  deletedAt: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...overrides,
});

const threadWithComments = (overrides: Partial<CommentThread> = {}) => ({
  ...thread(overrides),
  resolver: null,
  comments: [
    {
      ...comment(overrides),
      author: { id: 'user-1', name: 'Alice', avatarUrl: null },
    },
  ],
});

const comment = (overrides: Partial<Comment> = {}): Comment => ({
  id: 'comment-1',
  threadId: 'thread-1',
  authorId: 'user-1',
  body: 'Agreed @bob',
  mentions: [{ userId: 'user-2', username: 'Bob' }],
  deletedAt: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...overrides,
});

const bobMember: BoardMemberWithUser = {
  id: 'member-2',
  boardId: 'board-1',
  userId: 'user-2',
  role: 'EDITOR',
  addedBy: 'user-1',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  user: {
    id: 'user-2',
    email: 'bob@example.com',
    name: 'Bob',
    avatarUrl: null,
  },
};

describe('CommentsService', () => {
  let commentThreadRepository: jest.Mocked<
    Pick<
      CommentThreadRepository,
      | 'listByBoard'
      | 'create'
      | 'findById'
      | 'findByIdWithComments'
      | 'setResolved'
      | 'clearResolved'
    >
  >;
  let commentRepository: jest.Mocked<Pick<CommentRepository, 'create'>>;
  let memberRepository: jest.Mocked<Pick<MemberRepository, 'findByBoard'>>;
  let userRepository: jest.Mocked<Pick<UserRepository, 'findById'>>;
  let notificationsService: jest.Mocked<
    Pick<NotificationsService, 'createInApp' | 'enqueueMentionEmail'>
  >;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let realtimeService: jest.Mocked<
    Pick<
      RealtimeService,
      'broadcastCommentCreated' | 'broadcastCommentResolved'
    >
  >;
  let service: CommentsService;

  beforeEach(() => {
    commentThreadRepository = {
      listByBoard: jest.fn().mockResolvedValue([threadWithComments()]),
      create: jest.fn().mockResolvedValue(thread()),
      findById: jest.fn().mockResolvedValue(thread()),
      findByIdWithComments: jest.fn().mockResolvedValue(threadWithComments()),
      setResolved: jest.fn().mockResolvedValue(thread()),
      clearResolved: jest.fn().mockResolvedValue(thread()),
    };
    commentRepository = {
      create: jest
        .fn()
        .mockImplementation(
          (args: { body: string; mentions: CommentMentionRecord[] }) =>
            Promise.resolve(
              comment({ body: args.body, mentions: args.mentions }),
            ),
        ),
    };
    memberRepository = {
      findByBoard: jest.fn().mockResolvedValue([bobMember]),
    };
    userRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
        name: 'Alice',
        avatarUrl: null,
        passwordHash: null,
        provider: 'local',
        role: 'USER',
        googleId: null,
        emailVerifiedAt: null,
        deletedAt: null,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
    };
    notificationsService = {
      createInApp: jest.fn().mockResolvedValue({}),
      enqueueMentionEmail: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3001'),
    };
    realtimeService = {
      broadcastCommentCreated: jest.fn(),
      broadcastCommentResolved: jest.fn(),
    };
    service = new CommentsService(
      commentThreadRepository as unknown as CommentThreadRepository,
      commentRepository as unknown as CommentRepository,
      memberRepository as unknown as MemberRepository,
      userRepository as unknown as UserRepository,
      notificationsService as unknown as NotificationsService,
      configService as unknown as ConfigService,
      realtimeService as unknown as RealtimeService,
    );
  });

  describe('listThreads', () => {
    it('lists threads for the board', async () => {
      const result = await service.listThreads(USER, 'board-1');

      expect(commentThreadRepository.listByBoard).toHaveBeenCalledWith(
        'board-1',
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'thread-1',
        boardId: 'board-1',
        x: 120,
        y: 340,
        resolvedAt: null,
        resolvedByUser: null,
      });
    });
  });

  describe('createThread', () => {
    it('creates a thread, resolves mentions and broadcasts', async () => {
      const result = await service.createThread(USER, 'board-1', {
        x: 10,
        y: 20,
        body: 'Hey @bob take a look',
      });

      expect(commentThreadRepository.create).toHaveBeenCalledWith({
        boardId: 'board-1',
        x: 10,
        y: 20,
      });
      expect(commentRepository.create).toHaveBeenCalledWith({
        threadId: 'thread-1',
        authorId: 'user-1',
        body: 'Hey @bob take a look',
        mentions: [{ userId: 'user-2', username: 'Bob' }],
      });
      expect(memberRepository.findByBoard).toHaveBeenCalledWith('board-1');
      expect(notificationsService.createInApp).toHaveBeenCalledWith({
        userId: 'user-2',
        type: 'MENTION',
        payload: {
          boardId: 'board-1',
          threadId: 'thread-1',
          commentId: 'comment-1',
          actorUserId: 'user-1',
          actorName: 'Alice',
          bodyPreview: 'Hey @bob take a look',
        },
      });
      expect(notificationsService.enqueueMentionEmail).toHaveBeenCalledWith({
        to: 'bob@example.com',
        recipientName: 'Bob',
        actorName: 'Alice',
        boardId: 'board-1',
        threadId: 'thread-1',
        commentId: 'comment-1',
        bodyPreview: 'Hey @bob take a look',
        frontendUrl: 'http://localhost:3001',
      });
      expect(realtimeService.broadcastCommentCreated).toHaveBeenCalledWith(
        'board-1',
        {
          boardId: 'board-1',
          threadId: 'thread-1',
          commentId: 'comment-1',
          userId: 'user-1',
        },
      );
      expect(commentThreadRepository.findByIdWithComments).toHaveBeenCalledWith(
        'thread-1',
      );
      expect(result).toMatchObject({ id: 'thread-1' });
    });

    it('skips mention notifications when no mentions resolve', async () => {
      memberRepository.findByBoard.mockResolvedValue([]);

      await service.createThread(USER, 'board-1', {
        x: 1,
        y: 2,
        body: 'No mentions here',
      });

      expect(notificationsService.createInApp).not.toHaveBeenCalled();
      expect(notificationsService.enqueueMentionEmail).not.toHaveBeenCalled();
    });

    it('does not notify the author themselves', async () => {
      const selfMention = {
        ...bobMember,
        userId: 'user-1',
        user: {
          ...bobMember.user,
          id: 'user-1',
          email: 'alice@example.com',
          name: 'Alice',
        },
      };
      memberRepository.findByBoard.mockResolvedValue([selfMention]);

      await service.createThread(USER, 'board-1', {
        x: 1,
        y: 2,
        body: 'Hello @alice',
      });

      expect(notificationsService.createInApp).not.toHaveBeenCalled();
    });

    it('resolves mentions by local email part', async () => {
      memberRepository.findByBoard.mockResolvedValue([
        { ...bobMember, user: { ...bobMember.user, name: null } },
      ]);

      await service.createThread(USER, 'board-1', {
        x: 1,
        y: 2,
        body: 'ping @bob',
      });

      expect(commentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mentions: [{ userId: 'user-2', username: 'bob@example.com' }],
        }),
      );
    });

    it('dedupes repeated mentions of the same member', async () => {
      await service.createThread(USER, 'board-1', {
        x: 1,
        y: 2,
        body: '@bob and @bob again',
      });

      expect(commentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mentions: [{ userId: 'user-2', username: 'Bob' }],
        }),
      );
      expect(notificationsService.createInApp).toHaveBeenCalledTimes(1);
    });

    it('skips mention emails when the author user row is missing', async () => {
      userRepository.findById.mockResolvedValue(null);

      await service.createThread(USER, 'board-1', {
        x: 1,
        y: 2,
        body: 'Hey @bob',
      });

      expect(notificationsService.createInApp).not.toHaveBeenCalled();
      expect(notificationsService.enqueueMentionEmail).not.toHaveBeenCalled();
    });
  });

  describe('addReply', () => {
    it('adds a reply to an existing thread and broadcasts', async () => {
      const result = await service.addReply(USER, 'board-1', 'thread-1', {
        body: 'Reply @bob',
      });

      expect(commentThreadRepository.findById).toHaveBeenCalledWith('thread-1');
      expect(commentRepository.create).toHaveBeenCalledWith({
        threadId: 'thread-1',
        authorId: 'user-1',
        body: 'Reply @bob',
        mentions: [{ userId: 'user-2', username: 'Bob' }],
      });
      expect(realtimeService.broadcastCommentCreated).toHaveBeenCalledWith(
        'board-1',
        {
          boardId: 'board-1',
          threadId: 'thread-1',
          commentId: 'comment-1',
          userId: 'user-1',
        },
      );
      expect(result).toMatchObject({ id: 'comment-1', body: 'Reply @bob' });
    });

    it('rejects a reply to a missing thread', async () => {
      commentThreadRepository.findById.mockResolvedValue(null);

      await expect(
        service.addReply(USER, 'board-1', 'thread-1', { body: 'hi' }),
      ).rejects.toMatchObject({
        response: { code: COMMENTS_ERROR_CODES.THREAD_NOT_FOUND },
      });
      expect(commentRepository.create).not.toHaveBeenCalled();
    });

    it('rejects a reply to a thread on another board', async () => {
      commentThreadRepository.findById.mockResolvedValue(
        thread({ boardId: 'board-2' }),
      );

      await expect(
        service.addReply(USER, 'board-1', 'thread-1', { body: 'hi' }),
      ).rejects.toMatchObject({
        response: { code: COMMENTS_ERROR_CODES.THREAD_NOT_FOUND },
      });
      expect(commentRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('setResolved', () => {
    it('marks a thread resolved and broadcasts', async () => {
      const result = await service.setResolved(USER, 'board-1', 'thread-1', {
        resolved: true,
      });

      expect(commentThreadRepository.setResolved).toHaveBeenCalledWith(
        'thread-1',
        'user-1',
      );
      expect(commentThreadRepository.clearResolved).not.toHaveBeenCalled();
      expect(realtimeService.broadcastCommentResolved).toHaveBeenCalledWith(
        'board-1',
        {
          boardId: 'board-1',
          threadId: 'thread-1',
          userId: 'user-1',
          resolved: true,
          resolvedAt: expect.any(String) as string,
        },
      );
      expect(result).toMatchObject({ id: 'thread-1' });
    });

    it('clears resolution when unresolved', async () => {
      await service.setResolved(USER, 'board-1', 'thread-1', {
        resolved: false,
      });

      expect(commentThreadRepository.clearResolved).toHaveBeenCalledWith(
        'thread-1',
      );
      expect(commentThreadRepository.setResolved).not.toHaveBeenCalled();
      expect(realtimeService.broadcastCommentResolved).toHaveBeenCalledWith(
        'board-1',
        {
          boardId: 'board-1',
          threadId: 'thread-1',
          userId: 'user-1',
          resolved: false,
          resolvedAt: null,
        },
      );
    });

    it('rejects resolving a missing or foreign thread', async () => {
      commentThreadRepository.findById.mockResolvedValue(
        thread({ boardId: 'board-2' }),
      );

      await expect(
        service.setResolved(USER, 'board-1', 'thread-1', { resolved: true }),
      ).rejects.toMatchObject({
        response: { code: COMMENTS_ERROR_CODES.THREAD_NOT_FOUND },
      });
      expect(commentThreadRepository.setResolved).not.toHaveBeenCalled();
    });
  });
});
