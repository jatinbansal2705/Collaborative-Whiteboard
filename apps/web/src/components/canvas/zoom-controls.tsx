'use client';

import { ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  zoomFitCommand,
  zoomInCommand,
  zoomOutCommand,
  zoomResetCommand,
} from '@/lib/canvas/commands';
import { useCameraStore } from '@/stores/camera-store';

/** Floating zoom controls pinned to the bottom-right of the canvas. */
export function ZoomControls() {
  const zoom = useCameraStore((state) => state.zoom);
  const percent = Math.round(zoom * 100);

  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5 shadow-md backdrop-blur">
      <Button
        variant="ghost"
        size="icon"
        onClick={zoomOutCommand}
        aria-label="Zoom out"
        title="Zoom out (Ctrl/Cmd+-)"
        className="size-7"
      >
        <ZoomOut aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={zoomResetCommand}
        className="min-w-12 px-1 text-center text-xs font-medium tabular-nums hover:bg-accent rounded-sm"
        aria-label="Reset zoom to 100%"
        title="Reset zoom (Ctrl/Cmd+0)"
      >
        {percent}%
      </button>
      <Button
        variant="ghost"
        size="icon"
        onClick={zoomInCommand}
        aria-label="Zoom in"
        title="Zoom in (Ctrl/Cmd+=)"
        className="size-7"
      >
        <ZoomIn aria-hidden="true" />
      </Button>
      <div className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
      <Button
        variant="ghost"
        size="sm"
        onClick={zoomFitCommand}
        aria-label="Fit to content"
        title="Fit to content (Shift+1)"
        className="h-7 px-2 text-xs"
      >
        Fit
      </Button>
    </div>
  );
}
