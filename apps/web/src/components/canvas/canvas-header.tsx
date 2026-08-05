'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  History,
  Keyboard,
  Layers,
  MessageSquare,
  MessageSquareText,
  Redo2,
  Share2,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PresenceAvatars } from '@/components/realtime/presence-avatars';
import { NotificationBell } from '@/components/realtime/notification-bell';
import { ImportExportMenu } from '@/components/canvas/import-export-menu';
import { SaveStatus } from '@/components/canvas/save-status';
import { redoCommand, undoCommand } from '@/lib/canvas/commands';
import {
  selectCanvasCanRedo,
  selectCanvasCanUndo,
  useCanvasHistoryStore,
} from '@/stores/canvas-history-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useChatStore } from '@/stores/chat-store';
import { cn } from '@/lib/utils';

interface CanvasHeaderProps {
  title: string;
  onOpenShortcuts: () => void;
  onOpenVersionHistory: () => void;
  chatOpen: boolean;
  commentsOpen: boolean;
  commentMode: boolean;
  canComment: boolean;
  canEdit: boolean;
  readOnly: boolean;
  onToggleChat: () => void;
  onToggleComments: () => void;
  onToggleCommentMode: () => void;
  onOpenShare: () => void;
}

/** Top bar of the board editor: navigation, presence and board actions. */
export function CanvasHeader({
  title,
  onOpenShortcuts,
  onOpenVersionHistory,
  chatOpen,
  commentsOpen,
  commentMode,
  canComment,
  canEdit,
  readOnly,
  onToggleChat,
  onToggleComments,
  onToggleCommentMode,
  onOpenShare,
}: CanvasHeaderProps) {
  const canUndo = useCanvasHistoryStore(selectCanvasCanUndo);
  const canRedo = useCanvasHistoryStore(selectCanvasCanRedo);
  const layersPanelVisible = useCanvasStore(
    (state) => state.layersPanelVisible,
  );
  const toggleLayersPanel = useCanvasStore((state) => state.toggleLayersPanel);
  const chatUnread = useChatStore((state) => state.unreadCount);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <Button
        variant="ghost"
        size="icon"
        asChild
        aria-label="Back to dashboard"
      >
        <Link href="/">
          <ArrowLeft aria-hidden="true" />
        </Link>
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-sm font-medium" title={title}>
        {title}
      </h1>
      <SaveStatus />
      <PresenceAvatars />
      {readOnly ? (
        <span className="border-input text-muted-foreground hidden rounded-md border px-2 py-1 text-xs sm:inline-block">
          View only
        </span>
      ) : null}
      <div className="flex items-center gap-1">
        {canComment ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCommentMode}
            aria-label="Add a comment"
            aria-pressed={commentMode}
            title="Comment tool (C)"
            className={cn(
              'size-8',
              commentMode && 'bg-accent text-accent-foreground',
            )}
          >
            <MessageSquareText aria-hidden="true" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleChat}
          aria-label="Open chat"
          aria-pressed={chatOpen}
          title="Chat"
          className={cn(
            'relative size-8',
            chatOpen && 'bg-accent text-accent-foreground',
          )}
        >
          <MessageSquare aria-hidden="true" />
          {chatUnread > 0 ? (
            <span className="bg-destructive text-destructive-foreground absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full text-[9px] font-semibold">
              {chatUnread > 99 ? '99+' : chatUnread}
            </span>
          ) : null}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleComments}
          aria-label="Open comments"
          aria-pressed={commentsOpen}
          title="Comments"
          className={cn(
            'size-8',
            commentsOpen && 'bg-accent text-accent-foreground',
          )}
        >
          <MessageSquareText aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenShare}
          aria-label="Share board"
          title="Share"
          className="size-8"
        >
          <Share2 aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenVersionHistory}
          aria-label="Version history"
          title="Version history"
          className="size-8"
        >
          <History aria-hidden="true" />
        </Button>
        <ImportExportMenu title={title} canEdit={canEdit} />
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          onClick={undoCommand}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
          className="size-8"
        >
          <Undo2 aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redoCommand}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          className="size-8"
        >
          <Redo2 aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLayersPanel}
          aria-label="Layers panel"
          aria-pressed={layersPanelVisible}
          title="Layers"
          className={cn(
            'size-8',
            layersPanelVisible && 'bg-accent text-accent-foreground',
          )}
        >
          <Layers aria-hidden="true" />
        </Button>
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (Shift+/)"
          className="size-8"
        >
          <Keyboard aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
