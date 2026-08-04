'use client';

import { memo } from 'react';
import { Arrow, Ellipse, Line, Rect } from 'react-konva';
import type { WhiteboardElement } from '@whiteboard/shared';
import { HIT_PADDING } from '@/lib/canvas/constants';
import { dashArray } from '@/lib/canvas/elements';

function toFlatPoints(points: readonly { x: number; y: number }[]): number[] {
  const flat = new Array<number>(points.length * 2);
  for (let i = 0; i < points.length; i += 1) {
    flat[i * 2] = points[i].x;
    flat[i * 2 + 1] = points[i].y;
  }
  return flat;
}

function freehandMaxWidth(element: WhiteboardElement): number {
  let maxPressure = 1;
  if (
    element.type === 'pen' ||
    element.type === 'pencil' ||
    element.type === 'highlighter'
  ) {
    for (const pressure of element.pressures) {
      maxPressure = Math.max(maxPressure, pressure);
    }
  }
  return Math.max(element.strokeWidth, element.strokeWidth * maxPressure);
}

interface ElementNodeProps {
  element: WhiteboardElement;
  zoom: number;
}

function ElementNodeComponent({ element, zoom }: ElementNodeProps) {
  const dash = dashArray(element.strokeStyle, element.strokeWidth);
  const common = {
    id: element.id,
    name: 'element',
    x: element.x,
    y: element.y,
    rotation: element.angle,
    opacity: element.opacity,
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    dash,
    hitStrokeWidth: (element.strokeWidth + HIT_PADDING) / zoom,
    shadowColor: element.shadow?.color,
    shadowBlur: element.shadow?.blur,
    shadowOffsetX: element.shadow?.offsetX,
    shadowOffsetY: element.shadow?.offsetY,
    shadowOpacity: element.shadow === null ? 0 : 1,
    perfectDrawEnabled: false,
  };

  switch (element.type) {
    case 'rectangle':
      return (
        <Rect
          {...common}
          width={element.width}
          height={element.height}
          fill={element.fillColor ?? undefined}
        />
      );
    case 'ellipse':
      return (
        <Ellipse
          {...common}
          radiusX={element.width / 2}
          radiusY={element.height / 2}
          fill={element.fillColor ?? undefined}
        />
      );
    case 'triangle':
      return (
        <Line
          {...common}
          closed
          points={[
            element.width / 2,
            0,
            element.width,
            element.height,
            0,
            element.height,
          ]}
          fill={element.fillColor ?? undefined}
        />
      );
    case 'diamond':
      return (
        <Line
          {...common}
          closed
          points={[
            element.width / 2,
            0,
            element.width,
            element.height / 2,
            element.width / 2,
            element.height,
            0,
            element.height / 2,
          ]}
          fill={element.fillColor ?? undefined}
        />
      );
    case 'line':
      return <Line {...common} points={toFlatPoints(element.points)} />;
    case 'arrow':
      return (
        <Arrow
          {...common}
          points={toFlatPoints(element.points)}
          pointerLength={Math.max(8, element.strokeWidth * 3)}
          pointerWidth={Math.max(8, element.strokeWidth * 3)}
        />
      );
    case 'pen':
    case 'pencil':
    case 'highlighter':
      return (
        <Line
          {...common}
          points={toFlatPoints(element.points)}
          strokeWidth={freehandMaxWidth(element)}
          lineCap="round"
          lineJoin="round"
          opacity={
            element.type === 'highlighter'
              ? element.opacity * 0.45
              : element.opacity
          }
        />
      );
    case 'bezier':
      return <Line {...common} bezier points={toFlatPoints(element.points)} />;
  }
}

/** Memoized per-element node; only re-renders when the element changes identity. */
export const ElementNode = memo(ElementNodeComponent, (prev, next) => {
  return prev.element === next.element && prev.zoom === next.zoom;
});
