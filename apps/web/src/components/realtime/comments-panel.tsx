'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { VariableSizeList, type ListChildComponentProps } from 'react-window';
import {
  Check,
  CheckCircle2,
  CornerDownRight,
  Loader2,
  MessageSquare,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { commentService } from '@/lib/api/services/comment-service';
import { userColor, userInitials } from '@/lib/realtime/presence-ui';
import {
  selectActiveThreadId,
  selectCommentThreads,
  useCommentsStore,
} from '@/stores/comments-store';
import { toast } from '@/stores/toast-store';
import type { CommentThread } from '@/types/comment';
import { cn } from '@/lib/utils';

const COMMENT_ROW_ESTIMATE = 64;

interface CommentsPanelProps {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface ThreadRowData {
  threads: CommentThread[];
  expanded: string | null;
  replyingTo: string | null;
  drafts: Record<string, string>;
  busy: string | null;
  activeThreadId: string | null;
  onToggle: (thread: CommentThread, isExpanded: boolean) => void;
  onSetReplying: (threadId: string) => void;
  onDraftChange: (threadId: string, value: string) => void;
  onReply: (threadId: string) => void;
  onResolve: (thread: CommentThread) => void;
  onMeasure: (id: string, node: HTMLDivElement | null) => void;
}

const ThreadRow = memo(function ThreadRow({
  index,
  style,
  data,
}: ListChildComponentProps<ThreadRowData>) {
  const thread = data.threads[index];
  const color = userColor(thread.comments[0]?.authorId ?? thread.id);
  const isResolved = thread.resolvedAt !== null;
  const isExpanded = data.expanded === thread.id;
  const isActive = data.activeThreadId === thread.id;

  return (
    <div style={style} className="pb-2">
      <div
        ref={(node) => data.onMeasure(thread.id, node)}
        className={cn(
          'rounded-md border p-2',
          isActive ? 'border-ring' : 'border-border',
          isResolved && 'opacity-70',
        )}
      >
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2"
          aria-expanded={isExpanded}
          onClick={() => data.onToggle(thread, isExpanded)}
        >
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            {thread.comments.length} comment
            {thread.comments.length === 1 ? '' : 's'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDateTime(thread.createdAt)}
          </span>
        </button>
        {isExpanded ? (
          <div className="mt-2 space-y-2">
            {thread.comments.map((comment) => {
              const authorColor = userColor(comment.authorId);
              return (
                <div key={comment.id} className="flex gap-2">
                  <Avatar className="size-6">
                    {comment.author.avatarUrl !== null ? (
                      <AvatarImage src={comment.author.avatarUrl} alt="" />
                    ) : null}
                    <AvatarFallback
                      style={{
                        backgroundColor: `${authorColor}26`,
                        color: authorColor,
                      }}
                    >
                      {userInitials(comment.author.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {comment.author.name ?? 'Guest'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDateTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="break-words text-sm">{comment.body}</p>
                  </div>
                </div>
              );
            })}
            {data.replyingTo === thread.id ? (
              <div className="flex items-start gap-1">
                <Textarea
                  value={data.drafts[thread.id] ?? ''}
                  onChange={(event) =>
                    data.onDraftChange(thread.id, event.target.value)
                  }
                  placeholder="Write a reply…"
                  className="min-h-16 text-sm"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => void data.onReply(thread.id)}
                  disabled={data.busy === thread.id}
                  aria-label="Send reply"
                  className="size-8 shrink-0"
                >
                  <Check aria-hidden="true" />
                </Button>
              </div>
            ) : null}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => data.onSetReplying(thread.id)}
              >
                <CornerDownRight aria-hidden="true" />
                Reply
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void data.onResolve(thread)}
              >
                <CheckCircle2 aria-hidden="true" />
                {isResolved ? 'Reopen' : 'Resolve'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
});

/** Resolved comments list with replies and resolve actions (virtualized). */
export function CommentsPanel({
  boardId,
  open,
  onOpenChange,
}: CommentsPanelProps) {
  const threads = useCommentsStore(selectCommentThreads);
  const activeThreadId = useCommentsStore(selectActiveThreadId);
  const setActiveThread = useCommentsStore((state) => state.setActiveThread);
  const setResolved = useCommentsStore((state) => state.setResolved);

  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const listRef = useRef<VariableSizeList<ThreadRowData> | null>(null);
  const rowHeightsRef = useRef<Map<string, number>>(new Map());

  const refreshThreads = useCallback(async (): Promise<void> => {
    try {
      const next = await commentService.list(boardId);
      useCommentsStore.getState().setThreads(next);
    } catch {
      toast.error('Could not load comments');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLoading(true);
    void refreshThreads();
  }, [open, boardId, refreshThreads]);

  useEffect(() => {
    if (activeThreadId !== null && open) {
      setExpanded(activeThreadId);
      const frame = requestAnimationFrame(() => {
        const index = threads.findIndex(
          (thread) => thread.id === activeThreadId,
        );
        if (index >= 0) {
          listRef.current?.scrollToItem(index, 'center');
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [activeThreadId, open, threads]);

  const onMeasure = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node === null) {
      return;
    }
    const height = node.getBoundingClientRect().height;
    const previous = rowHeightsRef.current.get(id);
    if (previous !== height) {
      rowHeightsRef.current.set(id, height);
      listRef.current?.resetAfterIndex(0);
    }
  }, []);

  const getRowSize = useCallback(
    (index: number): number => {
      const thread = threads[index];
      return thread === undefined
        ? COMMENT_ROW_ESTIMATE
        : (rowHeightsRef.current.get(thread.id) ?? COMMENT_ROW_ESTIMATE);
    },
    [threads],
  );

  const handleReply = useCallback(
    async (threadId: string): Promise<void> => {
      const body = (drafts[threadId] ?? '').trim();
      if (body.length === 0) {
        return;
      }
      setBusy(threadId);
      try {
        await commentService.reply(threadId, { body });
        setDrafts((current) => ({ ...current, [threadId]: '' }));
        setReplyingTo(null);
        await refreshThreads();
      } catch {
        toast.error('Could not add reply');
      } finally {
        setBusy(null);
      }
    },
    [drafts, refreshThreads],
  );

  const handleResolve = useCallback(
    async (thread: CommentThread): Promise<void> => {
      const resolved = thread.resolvedAt === null;
      setResolved(
        thread.id,
        resolved,
        null,
        resolved ? new Date().toISOString() : null,
      );
      try {
        await commentService.resolve(thread.id, resolved);
      } catch {
        toast.error('Could not update thread');
        await refreshThreads();
      }
    },
    [refreshThreads, setResolved],
  );

  if (!open) {
    return null;
  }

  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l bg-background shadow-lg sm:w-80"
      aria-label="Comments"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare aria-hidden="true" className="size-4" />
          Comments
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="Close comments"
          className="size-8"
        >
          <X aria-hidden="true" />
        </Button>
      </header>
      <div className="min-h-0 flex-1 p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No comments yet. Use the comment tool on the canvas to leave one.
          </p>
        ) : (
          <VariableSizeList<ThreadRowData>
            ref={listRef}
            height="100%"
            width="100%"
            itemCount={threads.length}
            itemSize={getRowSize}
            estimatedItemSize={COMMENT_ROW_ESTIMATE}
            overscanCount={4}
            itemData={{
              threads,
              expanded,
              replyingTo,
              drafts,
              busy,
              activeThreadId,
              onToggle: (thread, isExpanded) => {
                setActiveThread(thread.id);
                setExpanded(isExpanded ? null : thread.id);
              },
              onSetReplying: (threadId) =>
                setReplyingTo(replyingTo === threadId ? null : threadId),
              onDraftChange: (threadId, value) =>
                setDrafts((current) => ({
                  ...current,
                  [threadId]: value,
                })),
              onReply: (threadId) => void handleReply(threadId),
              onResolve: handleResolve,
              onMeasure,
            }}
          >
            {ThreadRow}
          </VariableSizeList>
        )}
      </div>
    </aside>
  );
}
