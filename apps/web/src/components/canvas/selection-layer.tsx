'use client';

import { Fragment, memo, useMemo } from 'react';
import { Group, Line, Rect } from 'react-konva';
import type { WhiteboardElement } from '@whiteboard/shared';
import {
  HANDLE_BORDER_COLOR,
  HANDLE_COLOR,
  RESIZE_HANDLE_SIZE,
  ROTATE_HANDLE_OFFSET,
  SELECTION_COLOR,
} from '@/lib/canvas/constants';
import type { ResizeHandle } from '@/lib/canvas/types';
import { useCanvasStore } from '@/stores/canvas-store';
import { useCameraStore } from '@/stores/camera-store';

const HANDLES: readonly ResizeHandle[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

const HANDLE_POSITION: Record<ResizeHandle, { fx: number; fy: number }> = {
  nw: { fx: 0, fy: 0 },
  n: { fx: 0.5, fy: 0 },
  ne: { fx: 1, fy: 0 },
  e: { fx: 1, fy: 0.5 },
  se: { fx: 1, fy: 1 },
  s: { fx: 0.5, fy: 1 },
  sw: { fx: 0, fy: 1 },
  w: { fx: 0, fy: 0.5 },
};

interface SelectionOutlineProps {
  element: WhiteboardElement;
  zoom: number;
}

const SelectionOutline = memo(function SelectionOutline({
  element,
  zoom,
}: SelectionOutlineProps) {
  const strokeWidth = 1 / zoom;
  const handleSize = RESIZE_HANDLE_SIZE / zoom;
  const rotateOffset = ROTATE_HANDLE_OFFSET / zoom;
  const rotateHandleSize = RESIZE_HANDLE_SIZE / zoom;

  return (
    <Group x={element.x} y={element.y} rotation={element.angle}>
      <Rect
        width={element.width}
        height={element.height}
        stroke={SELECTION_COLOR}
        strokeWidth={strokeWidth}
        dash={[5 / zoom, 4 / zoom]}
        perfectDrawEnabled={false}
      />
      {!element.locked ? (
        <>
          <Line
            points={[element.width / 2, 0, element.width / 2, -rotateOffset]}
            stroke={SELECTION_COLOR}
            strokeWidth={strokeWidth}
            perfectDrawEnabled={false}
          />
          <Rect
            x={element.width / 2 - rotateHandleSize / 2}
            y={-rotateOffset - rotateHandleSize / 2}
            width={rotateHandleSize}
            height={rotateHandleSize}
            fill={HANDLE_COLOR}
            stroke={HANDLE_BORDER_COLOR}
            strokeWidth={strokeWidth}
            name="rotate-handle"
            dataElementId={element.id}
            perfectDrawEnabled={false}
          />
        </>
      ) : null}
      {!element.locked
        ? HANDLES.map((handle) => {
            const { fx, fy } = HANDLE_POSITION[handle];
            return (
              <Rect
                key={handle}
                x={element.width * fx - handleSize / 2}
                y={element.height * fy - handleSize / 2}
                width={handleSize}
                height={handleSize}
                fill={HANDLE_COLOR}
                stroke={HANDLE_BORDER_COLOR}
                strokeWidth={strokeWidth}
                name="resize-handle"
                dataHandle={handle}
                dataElementId={element.id}
                perfectDrawEnabled={false}
              />
            );
          })
        : null}
    </Group>
  );
});

/** Selection outlines, transform handles and the rubber-band rectangle. */
export function SelectionLayer() {
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const draft = useCanvasStore((state) => state.draft);
  const elements = useCanvasStore((state) => state.elements);
  const editingId = useCanvasStore((state) => state.editingId);
  const zoom = useCameraStore((state) => state.zoom);

  const selected = useMemo(
    () =>
      elements.filter(
        (element) =>
          selectedIds.includes(element.id) && element.id !== editingId,
      ),
    [elements, selectedIds, editingId],
  );

  const rubberBand =
    draft?.kind === 'select' && draft.rect !== undefined ? draft.rect : null;

  return (
    <Fragment>
      {selected.map((element) => (
        <SelectionOutline key={element.id} element={element} zoom={zoom} />
      ))}
      {rubberBand !== null ? (
        <Rect
          x={rubberBand.x}
          y={rubberBand.y}
          width={rubberBand.width}
          height={rubberBand.height}
          stroke={SELECTION_COLOR}
          strokeWidth={1 / zoom}
          dash={[5 / zoom, 4 / zoom]}
          fill={SELECTION_COLOR}
          fillOpacity={0.08}
          perfectDrawEnabled={false}
        />
      ) : null}
    </Fragment>
  );
}
