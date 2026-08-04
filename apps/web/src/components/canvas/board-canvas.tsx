'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Layer, Stage } from 'react-konva';
import { useTheme } from 'next-themes';
import { CANVAS_COLORS } from '@/lib/canvas/constants';
import { useCameraStore } from '@/stores/camera-store';
import { useCanvasStore } from '@/stores/canvas-store';
import { useToolStore } from '@/stores/tool-store';
import { useCanvasInteraction } from '@/hooks/use-canvas-interaction';
import { CanvasContextMenu } from './canvas-context-menu';
import { ElementNode } from './element-node';
import { GridLayer } from './grid-layer';
import { GuidesLayer } from './guides-layer';
import { RichTextEditor } from './rich-text-editor';
import { SelectionLayer } from './selection-layer';
import { StickyEditor } from './sticky-editor';

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
  const { stageRef, onPointerDown, onDoubleClick, onWheel, onTouchStart } =
    useCanvasInteraction();
  const [menuPosition, setMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const zoom = useCameraStore((state) => state.zoom);
  const offsetX = useCameraStore((state) => state.offsetX);
  const offsetY = useCameraStore((state) => state.offsetY);
  const viewportWidth = useCameraStore((state) => state.viewportWidth);
  const viewportHeight = useCameraStore((state) => state.viewportHeight);
  const setViewportSize = useCameraStore((state) => state.setViewportSize);
  const elements = useCanvasStore((state) => state.elements);
  const draft = useCanvasStore((state) => state.draft);
  const editingId = useCanvasStore((state) => state.editingId);
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
    setMenuPosition({ x: event.clientX, y: event.clientY });
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
        onDblClick={onDoubleClick}
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
      {editingId !== null ? (
        <>
          <RichTextEditor />
          <StickyEditor />
        </>
      ) : null}
      <CanvasContextMenu
        position={menuPosition}
        onClose={() => setMenuPosition(null)}
      />
    </div>
  );
}
