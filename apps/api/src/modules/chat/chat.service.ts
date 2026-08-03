import { Inject, Injectable, forwardRef } from '@nestjs/common';
import type { ChatReadReceipt } from '../../generated/prisma/client';
import type { ChatMessageEvent } from '@whiteboard/shared';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { decodeDateCursor } from '../../common/utils/date-cursor';
import { RealtimeService } from '../realtime/realtime.service';
import { CHAT_LIST_DEFAULT_LIMIT } from './chat.constants';
import { invalidChatCursor, messageEmpty } from './chat.errors';
import { ChatRepository } from './chat.repository';
import {
  toChatMessage,
  toChatMessageListMeta,
  type ChatMessageListResponseDto,
  type ChatMessageResponseDto,
} from './dto/chat-message.response.dto';
import type { CreateChatMessageDto } from './dto/create-chat-message.dto';
import type { ListChatMessagesQueryDto } from './dto/list-chat-messages.query.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService: RealtimeService,
  ) {}

  async listMessages(
    user: AuthenticatedUser,
    boardId: string,
    query: ListChatMessagesQueryDto,
  ): Promise<ChatMessageListResponseDto> {
    const limit = query.limit ?? CHAT_LIST_DEFAULT_LIMIT;
    const cursor =
      query.before === undefined ? null : decodeDateCursor(query.before);
    if (query.before !== undefined && cursor === null) {
      throw invalidChatCursor();
    }

    const page = await this.chatRepository.listByBoard({
      boardId,
      cursor,
      limit,
    });
    return {
      data: page.items.map(toChatMessage),
      meta: toChatMessageListMeta(page.pageInfo),
    };
  }

  async createMessage(
    user: AuthenticatedUser,
    boardId: string,
    dto: CreateChatMessageDto,
  ): Promise<ChatMessageResponseDto> {
    const body = dto.body?.trim() || null;
    const attachmentUrl = dto.attachmentUrl ?? null;
    if (body === null && attachmentUrl === null) {
      throw messageEmpty();
    }

    const message = await this.chatRepository.createMessage({
      boardId,
      authorId: user.id,
      body,
      attachmentUrl,
    });
    const response = toChatMessage(message);
    this.realtimeService.broadcastChatMessage(
      boardId,
      this.toChatMessageEvent(response),
    );
    return response;
  }

  async recordReadReceipt(
    boardId: string,
    userId: string,
    lastReadMessageId: string,
  ): Promise<ChatReadReceipt | null> {
    const message = await this.chatRepository.findById(lastReadMessageId);
    if (
      message === null ||
      message.boardId !== boardId ||
      message.deletedAt !== null
    ) {
      return null;
    }
    return this.chatRepository.upsertReadReceipt({
      boardId,
      userId,
      lastReadMessageId,
      lastReadAt: new Date(),
    });
  }

  async getReadReceipt(
    boardId: string,
    userId: string,
  ): Promise<ChatReadReceipt | null> {
    return this.chatRepository.findReadReceipt(boardId, userId);
  }

  private toChatMessageEvent(
    message: ChatMessageResponseDto,
  ): ChatMessageEvent {
    return {
      id: message.id,
      boardId: message.boardId,
      authorId: message.authorId,
      body: message.body,
      attachmentUrl: message.attachmentUrl,
      createdAt: message.createdAt.toISOString(),
      author: message.author,
    };
  }
}
