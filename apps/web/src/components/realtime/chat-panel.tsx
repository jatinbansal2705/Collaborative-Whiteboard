'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatService } from '@/lib/api/services/chat-service';
import { userColor, userInitials } from '@/lib/realtime/presence-ui';
import { emitChatRead, emitChatTyping } from '@/lib/realtime/emit';
import {
  selectMessages,
  selectTypingUserIds,
  useChatStore,
} from '@/stores/chat-store';
import { useRealtimeStore } from '@/stores/realtime-store';
import { toast } from '@/stores/toast-store';
import type { ChatMessage } from '@/types/chat';

const TYPING_STOP_DEBOUNCE_MS = 1200;

interface ChatPanelProps {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Board chat: live messages, typing indicators and read receipts. */
export function ChatPanel({ boardId, open, onOpenChange }: ChatPanelProps) {
  const messages = useChatStore(selectMessages);
  const typingUserIds = useChatStore(selectTypingUserIds);
  const readReceipts = useChatStore((state) => state.readReceipts);
  const clearUnread = useChatStore((state) => state.clearUnread);
  const connectionStatus = useRealtimeStore((state) => state.connectionStatus);
  const presence = useRealtimeStore((state) => state.presence);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const isTypingRef = useRef(false);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const presenceById = new Map(
    presence.map((member) => [member.userId, member]),
  );

  const loadMessages = useCallback(async (): Promise<void> => {
    try {
      const result = await chatService.messages(boardId, { limit: 50 });
      useChatStore.getState().setMessages(result.data);
      const last = result.data[result.data.length - 1];
      if (last !== undefined) {
        useChatStore.getState().setReadReceipt(last.id);
        emitChatRead(boardId, last.id);
      }
    } catch {
      toast.error('Could not load chat messages');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLoading(true);
    clearUnread();
    void loadMessages();
  }, [open, boardId, clearUnread, loadMessages]);

  useEffect(() => {
    if (!open) {
      return;
    }
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const last = messages[messages.length - 1];
    if (last !== undefined) {
      useChatStore.getState().setReadReceipt(last.id);
      emitChatRead(boardId, last.id);
    }
  }, [messages, open, boardId]);

  const stopTyping = useCallback((): void => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emitChatTyping(boardId, false);
    }
    if (typingStopTimerRef.current !== null) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
  }, [boardId]);

  const handleDraftChange = useCallback(
    (value: string): void => {
      setDraft(value);
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        emitChatTyping(boardId, true);
      }
      if (typingStopTimerRef.current !== null) {
        clearTimeout(typingStopTimerRef.current);
      }
      typingStopTimerRef.current = setTimeout(
        stopTyping,
        TYPING_STOP_DEBOUNCE_MS,
      );
    },
    [boardId, stopTyping],
  );

  const handleSend = useCallback(async (): Promise<void> => {
    const body = draft.trim();
    if (body.length === 0 || sending) {
      return;
    }
    setSending(true);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      boardId,
      authorId: 'local',
      body,
      attachmentUrl: null,
      createdAt: new Date().toISOString(),
      author: {
        id: 'local',
        name: 'You',
        avatarUrl: null,
      },
    };
    useChatStore.getState().appendMessage(optimistic);
    setDraft('');
    stopTyping();
    try {
      const created = await chatService.send(boardId, { body });
      useChatStore.getState().appendMessage(created);
      useChatStore.getState().setReadReceipt(created.id);
      emitChatRead(boardId, created.id);
    } catch {
      useChatStore
        .getState()
        .setMessages(
          useChatStore
            .getState()
            .messages.filter((message) => message.id !== optimistic.id),
        );
      toast.error('Could not send message');
    } finally {
      setSending(false);
    }
  }, [boardId, draft, sending, stopTyping]);

  useEffect(() => {
    return () => {
      stopTyping();
      if (typingStopTimerRef.current !== null) {
        clearTimeout(typingStopTimerRef.current);
      }
    };
  }, [stopTyping]);

  if (!open) {
    return null;
  }

  const typingNames = typingUserIds
    .map((userId) => presenceById.get(userId)?.name ?? 'Someone')
    .filter(Boolean);
  const lastMessage = messages[messages.length - 1];
  const readerNames = Object.entries(readReceipts)
    .filter(
      (entry) =>
        lastMessage !== undefined &&
        entry[1].lastReadMessageId === lastMessage.id,
    )
    .map((entry) => {
      const member = presence.find((peer) => peer.userId === entry[0]);
      return member?.name ?? 'Someone';
    })
    .filter(Boolean);

  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 flex w-80 flex-col border-l bg-background shadow-lg"
      aria-label="Chat"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <h2 className="text-sm font-semibold">Chat</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="Close chat"
          className="size-8"
        >
          <X aria-hidden="true" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages yet. Say hello!
          </p>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => {
              const color = userColor(message.author.id);
              return (
                <li key={message.id} className="flex items-start gap-2">
                  <Avatar className="size-7">
                    {message.author.avatarUrl !== null ? (
                      <AvatarImage src={message.author.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback
                      style={{ backgroundColor: `${color}26`, color }}
                    >
                      {userInitials(message.author.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold">
                        {message.author.name ?? 'Guest'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="break-words text-sm">{message.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
      <footer className="shrink-0 border-t p-2">
        {typingNames.length > 0 ? (
          <p className="px-1 pb-1 text-xs text-muted-foreground">
            {typingNames.join(', ')} {typingNames.length > 1 ? 'are' : 'is'}{' '}
            typing…
          </p>
        ) : null}
        {readerNames.length > 0 && lastMessage !== undefined ? (
          <p className="px-1 pb-1 text-[10px] text-muted-foreground">
            Seen by {readerNames.join(', ')}
          </p>
        ) : null}
        <div className="flex items-center gap-1">
          <Input
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleSend();
              }
            }}
            placeholder="Type a message…"
            className="h-9"
            aria-label="Chat message"
          />
          <Button
            size="icon"
            onClick={() => void handleSend()}
            disabled={
              sending ||
              draft.trim().length === 0 ||
              connectionStatus !== 'connected'
            }
            aria-label="Send message"
            className="size-9"
          >
            <Send aria-hidden="true" />
          </Button>
        </div>
      </footer>
    </aside>
  );
}
