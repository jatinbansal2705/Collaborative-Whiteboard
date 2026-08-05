import { create } from 'zustand';
import type { ChatMessage } from '@/types/chat';

interface ChatReadReceiptState {
  lastReadMessageId: string;
  readAt: string;
}

interface ChatState {
  messages: ChatMessage[];
  typingUserIds: string[];
  /** Most recently seen message id (local read receipt). */
  lastReadMessageId: string | null;
  /** Read receipts received from peers, keyed by user id. */
  readReceipts: Record<string, ChatReadReceiptState>;
  unreadCount: number;
  setMessages: (messages: ChatMessage[]) => void;
  appendMessage: (message: ChatMessage) => void;
  setTyping: (userId: string, isTyping: boolean) => void;
  setReadReceipt: (messageId: string) => void;
  applyPeerReadReceipt: (userId: string, receipt: ChatReadReceiptState) => void;
  clearUnread: () => void;
  incrementUnread: () => void;
  clear: () => void;
}

/** Live chat state for the current board session. */
export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  typingUserIds: [],
  lastReadMessageId: null,
  readReceipts: {},
  unreadCount: 0,
  setMessages: (messages) => set({ messages }),
  appendMessage: (message) =>
    set((state) =>
      state.messages.some((entry) => entry.id === message.id)
        ? state
        : { messages: [...state.messages, message] },
    ),
  setTyping: (userId, isTyping) =>
    set((state) => {
      const has = state.typingUserIds.includes(userId);
      if (isTyping && !has) {
        return { typingUserIds: [...state.typingUserIds, userId] };
      }
      if (!isTyping && has) {
        return {
          typingUserIds: state.typingUserIds.filter(
            (entry) => entry !== userId,
          ),
        };
      }
      return state;
    }),
  setReadReceipt: (messageId) =>
    set((state) => {
      if (state.lastReadMessageId === messageId) {
        return state;
      }
      return { lastReadMessageId: messageId };
    }),
  applyPeerReadReceipt: (userId, receipt) =>
    set((state) => {
      const current = state.readReceipts[userId];
      if (
        current !== undefined &&
        current.lastReadMessageId === receipt.lastReadMessageId
      ) {
        return state;
      }
      return {
        readReceipts: { ...state.readReceipts, [userId]: receipt },
      };
    }),
  clearUnread: () => set({ unreadCount: 0 }),
  incrementUnread: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clear: () =>
    set({
      messages: [],
      typingUserIds: [],
      lastReadMessageId: null,
      readReceipts: {},
      unreadCount: 0,
    }),
}));

export const selectMessages = (state: ChatState): ChatMessage[] =>
  state.messages;
export const selectTypingUserIds = (state: ChatState): string[] =>
  state.typingUserIds;
export const selectChatUnreadCount = (state: ChatState): number =>
  state.unreadCount;
