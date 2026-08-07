import type { ChatReadReceipt } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { encodeDateCursor } from '../../common/utils/date-cursor';
import { RealtimeService } from '../realtime/realtime.service';
import { CHAT_ERROR_CODES } from './chat.errors';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';
import type { ChatMessageSourceRow } from './dto/chat-message.response.dto';

const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'alice@example.com',
  role: 'USER',
  sessionId: 'session-1',
};

const messageRow = (
  overrides: Partial<
    ChatMessageSourceRow & { deletedAt: Date | null; updatedAt: Date }
  > = {},
): ChatMessageSourceRow & { deletedAt: Date | null; updatedAt: Date } => ({
  id: 'message-1',
  boardId: 'board-1',
  authorId: 'user-1',
  body: 'Hello team',
  attachmentUrl: null,
  deletedAt: null,
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  author: { id: 'user-1', name: 'Alice', avatarUrl: null },
  ...overrides,
});

const readReceipt = (
  overrides: Partial<ChatReadReceipt> = {},
): ChatReadReceipt =>
  ({
    boardId: 'board-1',
    userId: 'user-1',
    lastReadMessageId: 'message-1',
    lastReadAt: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  }) as ChatReadReceipt;

describe('ChatService', () => {
  let chatRepository: jest.Mocked<
    Pick<
      ChatRepository,
      | 'listByBoard'
      | 'createMessage'
      | 'findById'
      | 'upsertReadReceipt'
      | 'findReadReceipt'
    >
  >;
  let realtimeService: jest.Mocked<
    Pick<RealtimeService, 'broadcastChatMessage'>
  >;
  let service: ChatService;

  beforeEach(() => {
    chatRepository = {
      listByBoard: jest.fn().mockResolvedValue({
        items: [messageRow()],
        pageInfo: {
          hasNextPage: false,
          hasPrevPage: false,
          nextCursor: null,
          prevCursor: null,
        },
      }),
      createMessage: jest.fn().mockResolvedValue(messageRow()),
      findById: jest.fn().mockResolvedValue(messageRow()),
      upsertReadReceipt: jest.fn().mockResolvedValue(readReceipt()),
      findReadReceipt: jest.fn().mockResolvedValue(readReceipt()),
    };
    realtimeService = {
      broadcastChatMessage: jest.fn(),
    };
    service = new ChatService(
      chatRepository as unknown as ChatRepository,
      realtimeService as unknown as RealtimeService,
    );
  });

  describe('listMessages', () => {
    it('lists messages and maps the page to DTOs', async () => {
      chatRepository.listByBoard.mockResolvedValue({
        items: [messageRow({ body: null, attachmentUrl: 'https://x/a.png' })],
        pageInfo: {
          hasNextPage: true,
          hasPrevPage: false,
          nextCursor: 'cursor-next',
          prevCursor: null,
        },
      });

      const result = await service.listMessages(USER, 'board-1', {});

      expect(chatRepository.listByBoard).toHaveBeenCalledWith({
        boardId: 'board-1',
        cursor: null,
        limit: 50,
      });
      expect(result).toEqual({
        data: [
          {
            id: 'message-1',
            boardId: 'board-1',
            authorId: 'user-1',
            body: null,
            attachmentUrl: 'https://x/a.png',
            createdAt: new Date('2026-08-01T00:00:00.000Z'),
            author: { id: 'user-1', name: 'Alice', avatarUrl: null },
          },
        ],
        meta: {
          hasNextPage: true,
          hasPrevPage: false,
          nextCursor: 'cursor-next',
          prevCursor: null,
        },
      });
    });

    it('decodes a valid before cursor and passes it through', async () => {
      const cursor = encodeDateCursor(
        new Date('2026-08-01T00:00:00.000Z'),
        'message-1',
      );

      await service.listMessages(USER, 'board-1', { before: cursor });

      expect(chatRepository.listByBoard).toHaveBeenCalledWith({
        boardId: 'board-1',
        cursor: { value: '2026-08-01T00:00:00.000Z', id: 'message-1' },
        limit: 50,
      });
    });

    it('applies a custom limit', async () => {
      await service.listMessages(USER, 'board-1', { limit: 5 });

      expect(chatRepository.listByBoard).toHaveBeenCalledWith({
        boardId: 'board-1',
        cursor: null,
        limit: 5,
      });
    });

    it('rejects an invalid cursor', async () => {
      await expect(
        service.listMessages(USER, 'board-1', { before: 'not-a-cursor' }),
      ).rejects.toMatchObject({
        response: { code: CHAT_ERROR_CODES.INVALID_CURSOR },
      });
      expect(chatRepository.listByBoard).not.toHaveBeenCalled();
    });
  });

  describe('createMessage', () => {
    it('creates a message and broadcasts it to the board room', async () => {
      const result = await service.createMessage(USER, 'board-1', {
        body: '  Hello team  ',
      });

      expect(chatRepository.createMessage).toHaveBeenCalledWith({
        boardId: 'board-1',
        authorId: 'user-1',
        body: 'Hello team',
        attachmentUrl: null,
      });
      expect(result).toMatchObject({ id: 'message-1', body: 'Hello team' });
      expect(realtimeService.broadcastChatMessage).toHaveBeenCalledWith(
        'board-1',
        {
          id: 'message-1',
          boardId: 'board-1',
          authorId: 'user-1',
          body: 'Hello team',
          attachmentUrl: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          author: { id: 'user-1', name: 'Alice', avatarUrl: null },
        },
      );
    });

    it('allows attachment-only messages with a null body', async () => {
      await service.createMessage(USER, 'board-1', {
        body: '   ',
        attachmentUrl: 'https://x/chat/attachment.png',
      });

      expect(chatRepository.createMessage).toHaveBeenCalledWith({
        boardId: 'board-1',
        authorId: 'user-1',
        body: null,
        attachmentUrl: 'https://x/chat/attachment.png',
      });
    });

    it('rejects a message with neither body nor attachment', async () => {
      await expect(
        service.createMessage(USER, 'board-1', {}),
      ).rejects.toMatchObject({
        response: { code: CHAT_ERROR_CODES.MESSAGE_EMPTY },
      });
      expect(chatRepository.createMessage).not.toHaveBeenCalled();
      expect(realtimeService.broadcastChatMessage).not.toHaveBeenCalled();
    });
  });

  describe('recordReadReceipt', () => {
    it('records a receipt when the message belongs to the board', async () => {
      const result = await service.recordReadReceipt(
        'board-1',
        'user-1',
        'message-1',
      );

      expect(chatRepository.findById).toHaveBeenCalledWith('message-1');
      expect(chatRepository.upsertReadReceipt).toHaveBeenCalledWith({
        boardId: 'board-1',
        userId: 'user-1',
        lastReadMessageId: 'message-1',
        lastReadAt: expect.any(Date) as Date,
      });
      expect(result).toMatchObject({ lastReadMessageId: 'message-1' });
    });

    it('returns null for a missing message', async () => {
      chatRepository.findById.mockResolvedValue(null);

      const result = await service.recordReadReceipt(
        'board-1',
        'user-1',
        'message-1',
      );

      expect(result).toBeNull();
      expect(chatRepository.upsertReadReceipt).not.toHaveBeenCalled();
    });

    it('returns null when the message belongs to another board', async () => {
      chatRepository.findById.mockResolvedValue(
        messageRow({ boardId: 'board-2' }),
      );

      const result = await service.recordReadReceipt(
        'board-1',
        'user-1',
        'message-1',
      );

      expect(result).toBeNull();
      expect(chatRepository.upsertReadReceipt).not.toHaveBeenCalled();
    });

    it('returns null for a deleted message', async () => {
      chatRepository.findById.mockResolvedValue(
        messageRow({ deletedAt: new Date() }),
      );

      const result = await service.recordReadReceipt(
        'board-1',
        'user-1',
        'message-1',
      );

      expect(result).toBeNull();
      expect(chatRepository.upsertReadReceipt).not.toHaveBeenCalled();
    });
  });

  describe('getReadReceipt', () => {
    it('returns the stored receipt', async () => {
      const result = await service.getReadReceipt('board-1', 'user-1');

      expect(chatRepository.findReadReceipt).toHaveBeenCalledWith(
        'board-1',
        'user-1',
      );
      expect(result).toMatchObject({ lastReadMessageId: 'message-1' });
    });

    it('returns null when no receipt exists', async () => {
      chatRepository.findReadReceipt.mockResolvedValue(null);

      const result = await service.getReadReceipt('board-1', 'user-1');

      expect(result).toBeNull();
    });
  });
});
