'use client';

import { parseWhiteboardDocument } from '@whiteboard/shared';
import { use, useEffect, useState } from 'react';
import { BoardCanvas } from '@/components/canvas/board-canvas';
import { CanvasHeader } from '@/components/canvas/canvas-header';
import { CanvasToolbar } from '@/components/canvas/canvas-toolbar';
import { KeyboardShortcutsDialog } from '@/components/canvas/keyboard-shortcuts-dialog';
import { Minimap } from '@/components/canvas/minimap';
import { StyleBar } from '@/components/canvas/style-bar';
import { ZoomControls } from '@/components/canvas/zoom-controls';
import { ErrorState } from '@/components/state/error-state';
import { LoadingState } from '@/components/state/loading-state';
import { getErrorMessage } from '@/lib/api/errors';
import { registerCommand, unregisterCommand } from '@/lib/canvas/commands';
import { boardService } from '@/lib/api/services/board-service';
import { useCanvasHotkeys } from '@/hooks/use-canvas-hotkeys';
import { useCanvasStore } from '@/stores/canvas-store';

interface BoardPageProps {
  params: Promise<{ id: string }>;
}

export default function BoardPage({ params }: BoardPageProps) {
  const boardId = use(params).id;
  const [title, setTitle] = useState('Board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const minimapVisible = useCanvasStore((state) => state.minimapVisible);

  useCanvasHotkeys();

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
        useCanvasStore.getState().reset();
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
              const document =
                board.data === null
                  ? null
                  : parseWhiteboardDocument(board.data);
              if (document !== null) {
                useCanvasStore.getState().setElements(document.elements);
              }
              setTitle(board.title);
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
      />
      <div className="relative min-h-0 flex-1">
        <BoardCanvas />
        <div className="absolute top-1/2 left-3 -translate-y-1/2">
          <CanvasToolbar />
        </div>
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <StyleBar />
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2">
          {minimapVisible ? <Minimap /> : null}
          <ZoomControls />
        </div>
      </div>
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  );
}
