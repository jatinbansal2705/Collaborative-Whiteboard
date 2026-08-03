/** REST shapes from the chat module (apps/api/src/modules/chat). */

export interface ChatMessageAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  boardId: string;
  authorId: string;
  body: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  author: ChatMessageAuthor;
}

export interface ChatMessageListResult {
  data: ChatMessage[];
  meta: {
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
  };
}

export interface CreateChatMessageInput {
  body?: string;
  attachmentUrl?: string;
  attachmentKey?: string;
}

export interface ChatReadReceipt {
  boardId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: string;
}
