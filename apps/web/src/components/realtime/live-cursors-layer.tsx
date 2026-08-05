'use client';

import { elementsBoundingBox } from '@/lib/canvas/geometry';
import { userColor } from '@/lib/realtime/presence-ui';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useRealtimeStore } from '@/stores/realtime-store';

const CURSOR_WIDTH = 22;
const CURSOR_HEIGHT = 22;

/**
 * Overlay that renders remote cursors and selection highlights on top of the
 * Konva stage. Cursor positions are world coordinates converted to screen
 * space via the camera transform, so peers' pointers track pan/zoom correctly.
 */
export function LiveCursorsLayer() {
  const cursors = useRealtimeStore((state) => state.cursors);
  const presence = useRealtimeStore((state) => state.presence);
  const remoteSelections = useRealtimeStore((state) => state.remoteSelections);
  const zoom = useCameraStore((state) => state.zoom);
  const offsetX = useCameraStore((state) => state.offsetX);
  const offsetY = useCameraStore((state) => state.offsetY);
  const elements = useCanvasStore((state) => state.elements);

  const memberById = new Map(presence.map((member) => [member.userId, member]));
  const cursorIds = Object.keys(cursors);

  const toScreenX = (x: number): number => (x - offsetX) * zoom;
  const toScreenY = (y: number): number => (y - offsetY) * zoom;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      {Object.entries(remoteSelections)
        .filter(([, ids]) => ids.length > 0)
        .map(([userId, ids]) => {
          const selected = elements.filter((element) =>
            ids.includes(element.id),
          );
          const bounds = elementsBoundingBox(selected);
          if (bounds === null) {
            return null;
          }
          const color = userColor(userId);
          return (
            <div
              key={`selection-${userId}`}
              className="absolute rounded-sm border-2"
              style={{
                left: toScreenX(bounds.x),
                top: toScreenY(bounds.y),
                width: bounds.width * zoom,
                height: bounds.height * zoom,
                borderColor: color,
                opacity: 0.85,
              }}
            />
          );
        })}
      {cursorIds.map((userId) => {
        const cursor = cursors[userId];
        if (cursor === undefined) {
          return null;
        }
        const member = memberById.get(userId);
        const color = userColor(userId);
        const name = member?.name ?? 'Guest';
        return (
          <div
            key={`cursor-${userId}`}
            className="absolute"
            style={{
              transform: `translate(${toScreenX(cursor.x)}px, ${toScreenY(cursor.y)}px)`,
            }}
          >
            <div
              className="absolute top-[-26px] left-[12px] max-w-40 truncate rounded-sm px-1.5 py-0.5 text-[11px] leading-tight font-medium whitespace-nowrap text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {name}
            </div>
            <svg
              width={CURSOR_WIDTH}
              height={CURSOR_HEIGHT}
              viewBox="0 0 22 22"
              className="drop-shadow-sm"
            >
              <path
                d="M3 1l18 10-7.5 2L10 20z"
                fill={color}
                stroke="white"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
