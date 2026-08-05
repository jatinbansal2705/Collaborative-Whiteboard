import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectChatUnreadCount,
  selectMessages,
  selectTypingUserIds,
  useChatStore,
} from '@/stores/chat-store';
import type { ChatMessage } from '@/types/chat';

function message(id: string): ChatMessage {
  return {
    id,
    boardId: 'board-1',
    authorId: 'user-1',
    body: `message ${id}`,
    attachmentUrl: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    author: { id: 'user-1', name: 'Ada', avatarUrl: null },
  };
}

function resetStore(): void {
  useChatStore.setState({
    messages: [],
    typingUserIds: [],
    lastReadMessageId: null,
    readReceipts: {},
    unreadCount: 0,
  });
}

beforeEach(() => {
  resetStore();
});

describe('chat store', () => {
  it('starts empty', () => {
    expect(selectMessages(useChatStore.getState())).toEqual([]);
    expect(useChatStore.getState().unreadCount).toBe(0);
  });

  it('appends unique messages and dedupes by id', () => {
    const first = message('m1');
    useChatStore.getState().appendMessage(first);
    useChatStore.getState().appendMessage(first);
    expect(selectMessages(useChatStore.getState())).toHaveLength(1);
  });

  it('tracks typing users per user id', () => {
    useChatStore.getState().setTyping('user-1', true);
    useChatStore.getState().setTyping('user-2', true);
    useChatStore.getState().setTyping('user-1', true);
    expect(selectTypingUserIds(useChatStore.getState())).toEqual([
      'user-1',
      'user-2',
    ]);
    useChatStore.getState().setTyping('user-1', false);
    expect(selectTypingUserIds(useChatStore.getState())).toEqual(['user-2']);
  });

  it('stores the latest local read receipt', () => {
    useChatStore.getState().setReadReceipt('m1');
    useChatStore.getState().setReadReceipt('m2');
    expect(useChatStore.getState().lastReadMessageId).toBe('m2');
  });

  it('stores peer read receipts keyed by user id', () => {
    useChatStore.getState().applyPeerReadReceipt('user-2', {
      lastReadMessageId: 'm1',
      readAt: '2026-01-01T00:00:00.000Z',
    });
    useChatStore.getState().applyPeerReadReceipt('user-2', {
      lastReadMessageId: 'm2',
      readAt: '2026-01-01T00:00:00.000Z',
    });
    expect(
      useChatStore.getState().readReceipts['user-2'].lastReadMessageId,
    ).toBe('m2');
  });

  it('increments unread and clear resets everything', () => {
    useChatStore.getState().incrementUnread();
    useChatStore.getState().incrementUnread();
    expect(selectChatUnreadCount(useChatStore.getState())).toBe(2);
    useChatStore.getState().clearUnread();
    expect(selectChatUnreadCount(useChatStore.getState())).toBe(0);
    useChatStore.getState().appendMessage(message('m1'));
    useChatStore.getState().clear();
    expect(selectMessages(useChatStore.getState())).toEqual([]);
    expect(selectTypingUserIds(useChatStore.getState())).toEqual([]);
  });
});
