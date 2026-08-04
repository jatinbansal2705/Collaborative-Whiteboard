'use client';

import Link from 'next/link';
import { ArrowLeft, Keyboard, Layers, Redo2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { redoCommand, undoCommand } from '@/lib/canvas/commands';
import {
  selectCanvasCanRedo,
  selectCanvasCanUndo,
  useCanvasHistoryStore,
} from '@/stores/canvas-history-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { cn } from '@/lib/utils';

interface CanvasHeaderProps {
  title: string;
  onOpenShortcuts: () => void;
}

/** Top bar of the board editor: navigation, title and history actions. */
export function CanvasHeader({ title, onOpenShortcuts }: CanvasHeaderProps) {
  const canUndo = useCanvasHistoryStore(selectCanvasCanUndo);
  const canRedo = useCanvasHistoryStore(selectCanvasCanRedo);
  const layersPanelVisible = useCanvasStore(
    (state) => state.layersPanelVisible,
  );
  const toggleLayersPanel = useCanvasStore((state) => state.toggleLayersPanel);

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
      <div className="flex items-center gap-1">
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
