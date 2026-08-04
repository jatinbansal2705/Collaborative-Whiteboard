'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Group, Layer, Stage } from 'react-konva';
import { useTheme } from 'next-themes';
import { CANVAS_COLORS } from '@/lib/canvas/constants';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useToolStore } from '@/stores/tool-store';
import { useCanvasInteraction } from '@/hooks/use-canvas-interaction';
import { ElementNode } from './element-node';
import { GridLayer } from './grid-layer';
import { GuidesLayer } from './guides-layer';
import { SelectionLayer } from './selection-layer';

function canvasCursor(tool: string, dragging: boolean): string {
  if (dragging) {
    return tool === 'hand' ? 'grabbing' : 'default';
  }
  if (tool === 'hand') {
    return 'grab';
  }
  if (tool === 'select' || tool === 'eraser') {
    return 'default';
  }
  return 'crosshair';
}

/** Full-screen Konva stage implementing the infinite canvas viewport. */
export function BoardCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { stageRef, onPointerDown, onWheel, onTouchStart } =
    useCanvasInteraction();
  const zoom = useCameraStore((state) => state.zoom);
  const offsetX = useCameraStore((state) => state.offsetX);
  const offsetY = useCameraStore((state) => state.offsetY);
  const viewportWidth = useCameraStore((state) => state.viewportWidth);
  const viewportHeight = useCameraStore((state) => state.viewportHeight);
  const setViewportSize = useCameraStore((state) => state.setViewportSize);
  const elements = useCanvasStore((state) => state.elements);
  const draft = useCanvasStore((state) => state.draft);
  const gridVisible = useCanvasStore((state) => state.gridVisible);
  const tool = useToolStore((state) => state.transientTool ?? state.activeTool);
  const { resolvedTheme } = useTheme();

  const setViewportSizeRef = useRef(setViewportSize);
  useEffect(() => {
    setViewportSizeRef.current = setViewportSize;
  }, [setViewportSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) {
        return;
      }
      const { width, height } = entry.contentRect;
      setViewportSizeRef.current(width, height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const background =
    resolvedTheme === 'dark'
      ? CANVAS_COLORS.background.dark
      : CANVAS_COLORS.background.light;

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ background, cursor: canvasCursor(tool, false) }}
      onContextMenu={handleContextMenu}
    >
      <Stage
        ref={stageRef}
        width={viewportWidth}
        height={viewportHeight}
        onPointerDown={onPointerDown}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        style={{ display: 'block' }}
      >
        <Layer>
          <Group
            scaleX={zoom}
            scaleY={zoom}
            x={-offsetX * zoom}
            y={-offsetY * zoom}
          >
            {gridVisible ? <GridLayer /> : null}
            {elements.map((element) => (
              <ElementNode key={element.id} element={element} zoom={zoom} />
            ))}
            {draft?.kind === 'draw' && draft.element !== undefined ? (
              <ElementNode element={draft.element} zoom={zoom} />
            ) : null}
            <SelectionLayer />
            <GuidesLayer />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
