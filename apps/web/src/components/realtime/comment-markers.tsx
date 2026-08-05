'use client';

import { useCallback } from 'react';
import { MessageSquareText } from 'lucide-react';
import { screenToWorld } from '@/lib/canvas/coords';
import { userColor } from '@/lib/realtime/presence-ui';
import { useCameraStore } from '@/stores/camera-store';
import { useCommentsStore } from '@/stores/comments-store';
import { cn } from '@/lib/utils';

interface CommentMarkersProps {
  /** When true, clicks on the canvas create a comment at that point. */
  commentMode: boolean;
  onPlaceComment: (x: number, y: number) => void;
  onSelectThread: (threadId: string) => void;
}

/**
 * Canvas overlay that renders comment thread pins in world coordinates and,
 * in comment mode, captures clicks to place new comment anchors.
 */
export function CommentMarkers({
  commentMode,
  onPlaceComment,
  onSelectThread,
}: CommentMarkersProps) {
  const threads = useCommentsStore((state) => state.threads);
  const zoom = useCameraStore((state) => state.zoom);
  const offsetX = useCameraStore((state) => state.offsetX);
  const offsetY = useCameraStore((state) => state.offsetY);

  const toScreenX = (x: number): number => (x - offsetX) * zoom;
  const toScreenY = (y: number): number => (y - offsetY) * zoom;

  const handleCanvasClick = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const rect = event.currentTarget.getBoundingClientRect();
      const screen = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const world = screenToWorld(
        useCameraStore.getState(),
        screen.x,
        screen.y,
      );
      onPlaceComment(world.x, world.y);
    },
    [onPlaceComment],
  );

  return (
    <div
      className={cn(
        'absolute inset-0 z-30',
        commentMode ? 'cursor-crosshair' : 'pointer-events-none',
      )}
    >
      {commentMode ? (
        <div
          className="absolute inset-0"
          onPointerDown={handleCanvasClick}
          aria-label="Click on the canvas to leave a comment"
        />
      ) : null}
      {threads.map((thread) => {
        const color = userColor(thread.comments[0]?.authorId ?? thread.id);
        const resolved = thread.resolvedAt !== null;
        return (
          <button
            key={thread.id}
            type="button"
            aria-label={`Open comment thread (${thread.comments.length} comments)`}
            className={cn(
              'absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium shadow-sm transition-transform hover:scale-110',
              resolved ? 'opacity-60' : 'pointer-events-auto',
            )}
            style={{
              left: toScreenX(thread.x),
              top: toScreenY(thread.y),
              backgroundColor: `${color}1f`,
              borderColor: color,
              color,
            }}
            onClick={() => onSelectThread(thread.id)}
          >
            <MessageSquareText aria-hidden="true" className="size-3.5" />
            {thread.comments.length}
          </button>
        );
      })}
    </div>
  );
}
