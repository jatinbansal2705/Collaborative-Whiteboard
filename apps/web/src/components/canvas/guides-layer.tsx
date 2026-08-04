'use client';

import { Line } from 'react-konva';
import { GUIDE_COLOR } from '@/lib/canvas/constants';
import { getViewportWorldRect } from '@/lib/canvas/coords';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasStore } from '@/stores/canvas-store';

/** Smart-alignment guides shown while moving a selection. */
export function GuidesLayer() {
  const guides = useCanvasStore((state) => state.guides);
  const zoom = useCameraStore((state) => state.zoom);
  const offsetX = useCameraStore((state) => state.offsetX);
  const offsetY = useCameraStore((state) => state.offsetY);
  const viewportWidth = useCameraStore((state) => state.viewportWidth);
  const viewportHeight = useCameraStore((state) => state.viewportHeight);

  if (guides === null) {
    return null;
  }

  const visible = getViewportWorldRect({
    zoom,
    offsetX,
    offsetY,
    viewportWidth,
    viewportHeight,
  });
  const strokeWidth = 1 / zoom;

  return (
    <>
      {guides.linesX.map((x) => (
        <Line
          key={`gx-${x}`}
          points={[x, visible.y, x, visible.y + visible.height]}
          stroke={GUIDE_COLOR}
          strokeWidth={strokeWidth}
          dash={[4 / zoom, 4 / zoom]}
          perfectDrawEnabled={false}
        />
      ))}
      {guides.linesY.map((y) => (
        <Line
          key={`gy-${y}`}
          points={[visible.x, y, visible.x + visible.width, y]}
          stroke={GUIDE_COLOR}
          strokeWidth={strokeWidth}
          dash={[4 / zoom, 4 / zoom]}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  );
}
