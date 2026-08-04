'use client';

import { useMemo } from 'react';
import { Line } from 'react-konva';
import { CANVAS_COLORS, GRID_SIZE } from '@/lib/canvas/constants';
import { getViewportWorldRect } from '@/lib/canvas/coords';
import { useCameraStore } from '@/stores/camera-store';
import { useTheme } from 'next-themes';

const MIN_SCREEN_SPACING = 24;
const MAX_SCREEN_SPACING = 96;

function adaptiveSpacing(base: number, zoom: number): number {
  let spacing = base;
  while (spacing * zoom < MIN_SCREEN_SPACING) {
    spacing *= 2;
  }
  while (spacing * zoom > MAX_SCREEN_SPACING) {
    spacing /= 2;
  }
  return spacing;
}

/** Dotted background grid, drawn in world space and scaled with the camera. */
export function GridLayer() {
  const zoom = useCameraStore((state) => state.zoom);
  const offsetX = useCameraStore((state) => state.offsetX);
  const offsetY = useCameraStore((state) => state.offsetY);
  const viewportWidth = useCameraStore((state) => state.viewportWidth);
  const viewportHeight = useCameraStore((state) => state.viewportHeight);
  const { resolvedTheme } = useTheme();
  const color =
    resolvedTheme === 'dark'
      ? CANVAS_COLORS.grid.dark
      : CANVAS_COLORS.grid.light;

  const lines = useMemo(() => {
    const visible = getViewportWorldRect({
      zoom,
      offsetX,
      offsetY,
      viewportWidth,
      viewportHeight,
    });
    const spacing = adaptiveSpacing(GRID_SIZE, zoom);
    const startX = Math.floor(visible.x / spacing) * spacing;
    const startY = Math.floor(visible.y / spacing) * spacing;
    const endX = visible.x + visible.width;
    const endY = visible.y + visible.height;
    const vertical: number[] = [];
    const horizontal: number[] = [];
    for (let x = startX; x <= endX; x += spacing) {
      vertical.push(x);
    }
    for (let y = startY; y <= endY; y += spacing) {
      horizontal.push(y);
    }
    const strokeWidth = 1 / zoom;
    return { vertical, horizontal, strokeWidth };
  }, [zoom, offsetX, offsetY, viewportWidth, viewportHeight]);

  const visible = getViewportWorldRect({
    zoom,
    offsetX,
    offsetY,
    viewportWidth,
    viewportHeight,
  });

  return (
    <>
      {lines.vertical.map((x) => (
        <Line
          key={`v-${x}`}
          points={[x, visible.y, x, visible.y + visible.height]}
          stroke={color}
          strokeWidth={lines.strokeWidth}
          perfectDrawEnabled={false}
        />
      ))}
      {lines.horizontal.map((y) => (
        <Line
          key={`h-${y}`}
          points={[visible.x, y, visible.x + visible.width, y]}
          stroke={color}
          strokeWidth={lines.strokeWidth}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  );
}
