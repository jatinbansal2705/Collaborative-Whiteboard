'use client';

import { parseWhiteboardDocument } from '@whiteboard/shared';
import { use, useEffect, useState } from 'react';
import { BoardCanvas } from '@/components/canvas/board-canvas';
import { CanvasHeader } from '@/components/canvas/canvas-header';
import { CanvasToolbar } from '@/components/canvas/canvas-toolbar';
import { IconPicker } from '@/components/canvas/icon-picker';
import { ImageInsertDialog } from '@/components/canvas/image-insert-dialog';
import { KeyboardShortcutsDialog } from '@/components/canvas/keyboard-shortcuts-dialog';
import { LayersPanel } from '@/components/canvas/layers-panel';
import { Minimap } from '@/components/canvas/minimap';
import { StyleBar } from '@/components/canvas/style-bar';
import { TextStyleBar } from '@/components/canvas/text-style-bar';
import { ZoomControls } from '@/components/canvas/zoom-controls';
import { ChatPanel } from '@/components/realtime/chat-panel';
import { CommentComposer } from '@/components/realtime/comment-composer';
import { CommentsPanel } from '@/components/realtime/comments-panel';
import { ShareDialog } from '@/components/realtime/share-dialog';
import { ErrorState } from '@/components/state/error-state';
import { LoadingState } from '@/components/state/loading-state';
import { getErrorMessage } from '@/lib/api/errors';
import { registerCommand, unregisterCommand } from '@/lib/canvas/commands';
import { boardService } from '@/lib/api/services/board-service';
import { useBoardRealtime } from '@/hooks/use-board-realtime';
import { useCanvasHotkeys } from '@/hooks/use-canvas-hotkeys';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCommentsStore } from '@/stores/comments-store';
import type { BoardMemberRole } from '@/types/board';
import type { CommentThread } from '@/types/comment';

interface BoardPageProps {
  params: Promise<{ id: string }>;
}

const READ_ONLY_ROLES: ReadonlySet<BoardMemberRole> = new Set([
  'COMMENTER',
  'VIEWER',
]);

function canComment(role: BoardMemberRole | null): boolean {
  return role !== null && role !== 'VIEWER';
}

export default function BoardPage({ params }: BoardPageProps) {
  const boardId = use(params).id;
  const [title, setTitle] = useState('Board');
  const [myRole, setMyRole] = useState<BoardMemberRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const [pendingComment, setPendingComment] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const minimapVisible = useCanvasStore((state) => state.minimapVisible);
  const layersPanelVisible = useCanvasStore(
    (state) => state.layersPanelVisible,
  );

  useCanvasHotkeys();
  useBoardRealtime(boardId, myRole ?? 'VIEWER');

  useEffect(() => {
    registerCommand('help', () => setShortcutsOpen(true));
    return () => unregisterCommand('help');
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadBoard(): Promise<void> {
      try {
        const board = await boardService.get(boardId);
        if (cancelled) {
          return;
        }
        setTitle(board.title);
        setMyRole(board.myRole);
        useCanvasStore.getState().reset();
        useCanvasStore
          .getState()
          .setReadOnly(READ_ONLY_ROLES.has(board.myRole));
        const document =
          board.data === null ? null : parseWhiteboardDocument(board.data);
        if (document !== null) {
          useCanvasStore.getState().setElements(document.elements);
        }
        setLoading(false);
      } catch (cause) {
        if (cancelled) {
          return;
        }
        setError(getErrorMessage(cause));
        setLoading(false);
      }
    }

    void loadBoard();

    return () => {
      cancelled = true;
      useCanvasStore.getState().reset();
    };
  }, [boardId]);

  useEffect(() => {
    useCanvasStore.getState().setCommentMode(commentMode);
  }, [commentMode]);

  function toggleCommentMode(): void {
    setCommentMode((current) => {
      if (!canComment(myRole)) {
        return current;
      }
      return !current;
    });
  }

  function handleCommentCreated(thread: CommentThread): void {
    useCommentsStore.getState().upsertThread(thread);
    setPendingComment(null);
    setCommentMode(false);
    setCommentsOpen(true);
    useCommentsStore.getState().setActiveThread(thread.id);
  }

  function handleSelectThread(threadId: string): void {
    useCommentsStore.getState().setActiveThread(threadId);
    setCommentsOpen(true);
  }

  if (loading) {
    return <LoadingState label="Opening board…" className="m-auto" />;
  }

  if (error !== null) {
    return (
      <ErrorState
        title="Could not open this board"
        description={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
          const current = boardId;
          void boardService
            .get(current)
            .then((board) => {
              useCanvasStore.getState().reset();
              useCanvasStore
                .getState()
                .setReadOnly(READ_ONLY_ROLES.has(board.myRole));
              const document =
                board.data === null
                  ? null
                  : parseWhiteboardDocument(board.data);
              if (document !== null) {
                useCanvasStore.getState().setElements(document.elements);
              }
              setTitle(board.title);
              setMyRole(board.myRole);
              setLoading(false);
            })
            .catch((cause) => {
              setError(getErrorMessage(cause));
              setLoading(false);
            });
        }}
      />
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <CanvasHeader
        title={title}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        chatOpen={chatOpen}
        commentsOpen={commentsOpen}
        commentMode={commentMode}
        canComment={canComment(myRole)}
        readOnly={READ_ONLY_ROLES.has(myRole ?? 'VIEWER')}
        onToggleChat={() => setChatOpen((open) => !open)}
        onToggleComments={() => setCommentsOpen((open) => !open)}
        onToggleCommentMode={toggleCommentMode}
        onOpenShare={() => setShareOpen(true)}
      />
      <div className="relative min-h-0 flex-1">
        <BoardCanvas
          commentMode={commentMode}
          onPlaceComment={(x, y) => setPendingComment({ x, y })}
          onSelectThread={handleSelectThread}
        />
        <div className="absolute top-1/2 left-3 -translate-y-1/2">
          <CanvasToolbar />
        </div>
        <div className="absolute top-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
          <StyleBar />
          <TextStyleBar />
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2">
          {minimapVisible ? <Minimap /> : null}
          <ZoomControls />
        </div>
        {layersPanelVisible ? (
          <div className="absolute top-3 right-3 bottom-3 z-30 w-64">
            <LayersPanel />
          </div>
        ) : null}
        {chatOpen ? (
          <div className="absolute top-3 right-3 bottom-3 z-20 w-80">
            <ChatPanel
              boardId={boardId}
              open={chatOpen}
              onOpenChange={setChatOpen}
            />
          </div>
        ) : null}
        {commentsOpen ? (
          <div className="absolute top-3 right-3 bottom-3 z-20 w-80">
            <CommentsPanel
              boardId={boardId}
              open={commentsOpen}
              onOpenChange={setCommentsOpen}
            />
          </div>
        ) : null}
        <IconPicker />
        <ImageInsertDialog />
      </div>
      <CommentComposer
        boardId={boardId}
        point={pendingComment}
        onClose={() => setPendingComment(null)}
        onCreated={handleCommentCreated}
      />
      <ShareDialog
        boardId={boardId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  );
}
