'use client';

import { Fragment, memo, useEffect, useMemo, useState } from 'react';
import {
  Arrow,
  Ellipse,
  Group,
  Image,
  Line,
  Rect,
  Text as KonvaText,
} from 'react-konva';
import type {
  ConnectorElement,
  IconElement,
  ImageElement,
  StickyElement,
  TextElement,
  WhiteboardElement,
} from '@whiteboard/shared';
import {
  HIT_PADDING,
  STICKY_COLOR_DEFAULT,
  STICKY_LINE_HEIGHT,
  STICKY_PADDING,
} from '@/lib/canvas/constants';
import { dashArray } from '@/lib/canvas/elements';
import { layoutRichText } from '@/lib/canvas/text';
import { iconDataUrl } from '@/lib/canvas/icon-assets';

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

/** Loads an image (data URL or remote) into a browser image element. */
function useLoadedImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let alive = true;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (alive) {
        setImage(img);
      }
    };
    img.onerror = () => {
      if (alive) {
        setImage(null);
      }
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return image;
}

function fontStyle(segment: { bold: boolean; italic: boolean }): string {
  return `${segment.italic ? 'italic ' : ''}${segment.bold ? 'bold ' : ''}`;
}

function TextNode({ element }: { element: TextElement }) {
  const layout = useMemo(
    () =>
      layoutRichText(element.paragraphs, {
        fontFamily: element.fontFamily,
        fontSize: element.fontSize,
        lineHeight: element.lineHeight,
        color: element.color,
        maxWidth: element.autoWidth ? 0 : element.width,
        wrap: !element.autoWidth,
      }),
    [element],
  );
  return (
    <Group
      x={element.x}
      y={element.y}
      rotation={element.angle}
      opacity={element.opacity}
    >
      <Rect
        width={element.width}
        height={element.height}
        fill="rgba(0,0,0,0)"
        id={element.id}
        name="element"
        perfectDrawEnabled={false}
      />
      {layout.lines.map((line, lineIndex) =>
        line.segments.map((segment, segmentIndex) => (
          <Fragment key={`${lineIndex}-${segmentIndex}`}>
            <KonvaText
              x={segment.x}
              y={segment.y}
              text={segment.text}
              fontFamily={element.fontFamily}
              fontSize={element.fontSize}
              fontStyle={fontStyle(segment)}
              fill={segment.color}
              listening={false}
              perfectDrawEnabled={false}
            />
            {segment.underline ? (
              <Line
                x={segment.x}
                y={segment.y}
                points={[
                  0,
                  element.fontSize + 2,
                  segment.width,
                  element.fontSize + 2,
                ]}
                stroke={segment.color}
                strokeWidth={1}
                listening={false}
                perfectDrawEnabled={false}
              />
            ) : null}
          </Fragment>
        )),
      )}
    </Group>
  );
}

function StickyNode({ element }: { element: StickyElement }) {
  const innerWidth = Math.max(1, element.width - STICKY_PADDING * 2);
  const layout = useMemo(() => {
    if (element.text.length === 0) {
      return { lines: [], width: 0, height: 0 };
    }
    return layoutRichText(
      [{ runs: [{ text: element.text }], align: 'left', listType: null }],
      {
        fontFamily: 'Inter',
        fontSize: element.fontSize,
        lineHeight: STICKY_LINE_HEIGHT,
        color: element.strokeColor,
        maxWidth: innerWidth,
        wrap: true,
      },
    );
  }, [element, innerWidth]);
  return (
    <Group
      x={element.x}
      y={element.y}
      rotation={element.angle}
      opacity={element.opacity}
    >
      <Rect
        width={element.width}
        height={element.height}
        fill={element.fillColor ?? STICKY_COLOR_DEFAULT}
        stroke={element.strokeColor}
        strokeWidth={1}
        strokeOpacity={0.18}
        cornerRadius={2}
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={8}
        shadowOffsetX={2}
        shadowOffsetY={3}
        shadowOpacity={1}
        id={element.id}
        name="element"
        perfectDrawEnabled={false}
      />
      {layout.lines.map((line, lineIndex) =>
        line.segments.map((segment, segmentIndex) => (
          <KonvaText
            key={`${lineIndex}-${segmentIndex}`}
            x={STICKY_PADDING + segment.x}
            y={STICKY_PADDING + segment.y}
            text={segment.text}
            fontFamily="Inter"
            fontSize={element.fontSize}
            fontStyle={fontStyle(segment)}
            fill={segment.color}
            listening={false}
            perfectDrawEnabled={false}
          />
        )),
      )}
    </Group>
  );
}

function ConnectorNode({ element }: { element: ConnectorElement }) {
  const dash = dashArray(element.strokeStyle, element.strokeWidth);
  return (
    <Group
      x={element.x}
      y={element.y}
      rotation={element.angle}
      opacity={element.opacity}
    >
      <Arrow
        points={toFlatPoints(element.points)}
        stroke={element.strokeColor}
        strokeWidth={element.strokeWidth}
        dash={dash}
        fill={element.strokeColor}
        pointerLength={Math.max(8, element.strokeWidth * 3)}
        pointerWidth={Math.max(8, element.strokeWidth * 3)}
        hitStrokeWidth={element.strokeWidth + HIT_PADDING}
        id={element.id}
        name="element"
        perfectDrawEnabled={false}
      />
    </Group>
  );
}

function ImageNode({ element }: { element: ImageElement }) {
  const image = useLoadedImage(element.src);
  return (
    <Group
      x={element.x}
      y={element.y}
      rotation={element.angle}
      opacity={element.opacity}
    >
      {image === null ? (
        <Rect
          width={element.width}
          height={element.height}
          fill="#e4e4e7"
          stroke={element.strokeColor}
          strokeWidth={1}
          id={element.id}
          name="element"
          perfectDrawEnabled={false}
        />
      ) : (
        <Image
          image={image}
          width={element.width}
          height={element.height}
          id={element.id}
          name="element"
          alt=""
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
}

function IconNode({ element }: { element: IconElement }) {
  const image = useLoadedImage(
    element.kind === 'emoji' ? '' : iconDataUrl(element.value),
  );
  if (element.kind === 'emoji') {
    return (
      <KonvaText
        x={element.x}
        y={element.y}
        text={element.value}
        fontSize={element.size}
        width={element.width}
        height={element.height}
        align="center"
        verticalAlign="middle"
        opacity={element.opacity}
        id={element.id}
        name="element"
        perfectDrawEnabled={false}
      />
    );
  }
  return (
    <Group
      x={element.x}
      y={element.y}
      rotation={element.angle}
      opacity={element.opacity}
    >
      {image === null ? (
        <Rect
          width={element.width}
          height={element.height}
          fill="rgba(0,0,0,0)"
          id={element.id}
          name="element"
          perfectDrawEnabled={false}
        />
      ) : (
        <Image
          image={image}
          width={element.width}
          height={element.height}
          id={element.id}
          name="element"
          alt=""
          perfectDrawEnabled={false}
        />
      )}
    </Group>
  );
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
    case 'text':
      return <TextNode element={element} />;
    case 'sticky':
      return <StickyNode element={element} />;
    case 'connector':
      return <ConnectorNode element={element} />;
    case 'image':
      return <ImageNode element={element} />;
    case 'icon':
      return <IconNode element={element} />;
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
