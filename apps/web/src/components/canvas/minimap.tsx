'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { MINIMAP_SIZE, MINIMAP_PADDING } from '@/lib/canvas/constants';
import { elementBBox, elementsBoundingBox } from '@/lib/canvas/geometry';
import { getViewportWorldRect } from '@/lib/canvas/coords';
import { cn } from '@/lib/utils';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasStore } from '@/stores/canvas-store';
import type { WorldRect } from '@/lib/canvas/types';

interface MinimapProps {
  className?: string;
}

/** Scaled overview of the world with a draggable viewport indicator. */
export function Minimap({ className }: MinimapProps) {
  const elements = useCanvasStore((state) => state.elements);
  const zoom = useCameraStore((state) => state.zoom);
  const offsetX = useCameraStore((state) => state.offsetX);
  const offsetY = useCameraStore((state) => state.offsetY);
  const viewportWidth = useCameraStore((state) => state.viewportWidth);
  const viewportHeight = useCameraStore((state) => state.viewportHeight);
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const worldBounds = useMemo(() => elementsBoundingBox(elements), [elements]);

  const mapping = useMemo(() => {
    const base: WorldRect = { x: 0, y: 0, width: 1, height: 1 };
    const bounds = worldBounds ?? base;
    const availableWidth = MINIMAP_SIZE.width - MINIMAP_PADDING * 2;
    const availableHeight = MINIMAP_SIZE.height - MINIMAP_PADDING * 2;
    const scale =
      bounds.width <= 0 || bounds.height <= 0
        ? 1
        : Math.min(
            availableWidth / bounds.width,
            availableHeight / bounds.height,
          );
    const centeredWidth = bounds.width * scale;
    const centeredHeight = bounds.height * scale;
    const originX = (MINIMAP_SIZE.width - centeredWidth) / 2;
    const originY = (MINIMAP_SIZE.height - centeredHeight) / 2;
    const toLocal = (rect: WorldRect): WorldRect => ({
      x: originX + (rect.x - bounds.x) * scale,
      y: originY + (rect.y - bounds.y) * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    });
    const toWorld = (lx: number, ly: number): { x: number; y: number } => ({
      x: bounds.x + (lx - originX) / scale,
      y: bounds.y + (ly - originY) / scale,
    });
    return { toLocal, toWorld };
  }, [worldBounds]);

  const viewportRect = useMemo(
    () =>
      mapping.toLocal(
        getViewportWorldRect({
          zoom,
          offsetX,
          offsetY,
          viewportWidth,
          viewportHeight,
        }),
      ),
    [mapping, zoom, offsetX, offsetY, viewportWidth, viewportHeight],
  );

  const recenter = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (container === null) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const world = mapping.toWorld(localX, localY);
      const camera = useCameraStore.getState();
      useCameraStore.getState().setTransform({
        zoom: camera.zoom,
        offsetX: world.x - camera.viewportWidth / 2 / camera.zoom,
        offsetY: world.y - camera.viewportHeight / 2 / camera.zoom,
      });
    },
    [mapping],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      recenter(event.clientX, event.clientY);
    },
    [recenter],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) {
        return;
      }
      recenter(event.clientX, event.clientY);
    },
    [recenter],
  );

  const endDrag = useCallback(() => {
    draggingRef.current = false;
    setDragging(false);
  }, []);

  const fill = resolvedTheme === 'dark' ? '#27272a' : '#e4e4e7';
  const viewportStroke = resolvedTheme === 'dark' ? '#ffffff' : '#18181b';

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label="Minimap"
      className={cn(
        'rounded-md border bg-background/90 p-1.5 shadow-md backdrop-blur',
        dragging && 'cursor-grabbing',
        className,
      )}
      style={{ width: MINIMAP_SIZE.width, height: MINIMAP_SIZE.height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          recenter(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      }}
    >
      <svg
        viewBox={`0 0 ${MINIMAP_SIZE.width} ${MINIMAP_SIZE.height}`}
        className="h-full w-full"
        aria-hidden="true"
      >
        {worldBounds === null ? null : (
          <g>
            {elements.map((element) => {
              const rect = mapping.toLocal(elementBBox(element));
              return (
                <rect
                  key={element.id}
                  x={rect.x}
                  y={rect.y}
                  width={Math.max(rect.width, 1)}
                  height={Math.max(rect.height, 1)}
                  rx={0.5}
                  fill={fill}
                />
              );
            })}
          </g>
        )}
        <rect
          x={viewportRect.x}
          y={viewportRect.y}
          width={viewportRect.width}
          height={viewportRect.height}
          fill="none"
          stroke={viewportStroke}
          strokeWidth={1}
          rx={1}
        />
      </svg>
    </div>
  );
}
