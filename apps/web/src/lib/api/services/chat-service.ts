import type {
  ChatMessage,
  ChatMessageListResult,
  CreateChatMessageInput,
} from '@/types/chat';
import { API_ENDPOINTS } from '../endpoints';
import { httpClient } from '../http-client';

/** Board chat domain service. */
export const chatService = {
  async messages(
    boardId: string,
    query: { cursor?: string; limit?: number } = {},
  ): Promise<ChatMessageListResult> {
    const { data } = await httpClient.get<ChatMessageListResult>(
      API_ENDPOINTS.chat.messages(boardId),
      { query },
    );
    return data;
  },

  async send(
    boardId: string,
    input: CreateChatMessageInput,
  ): Promise<ChatMessage> {
    const { data } = await httpClient.post<ChatMessage>(
      API_ENDPOINTS.chat.messages(boardId),
      input,
    );
    return data;
  },
};
