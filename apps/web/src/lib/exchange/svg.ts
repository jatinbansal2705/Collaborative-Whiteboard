import {
  BOARD_DOCUMENT_SCHEMA_VERSION,
  type WhiteboardDocument,
  type WhiteboardElement,
} from '@whiteboard/shared';
import {
  STICKY_COLOR_DEFAULT,
  STICKY_LINE_HEIGHT,
  STICKY_PADDING,
} from '@/lib/canvas/constants';
import { dashArray } from '@/lib/canvas/elements';
import { elementsBoundingBox } from '@/lib/canvas/geometry';
import { iconDataUrl } from '@/lib/canvas/icon-assets';
import { layoutRichText } from '@/lib/canvas/text';
import type { ExportOptions } from './types';

export interface SvgBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Math.round(value * 1000) / 1000);
}

function toPoints(points: readonly { x: number; y: number }[]): string {
  return points
    .map((point) => `${formatNumber(point.x)} ${formatNumber(point.y)}`)
    .join(' ');
}

function strokeDash(
  strokeStyle: WhiteboardElement['strokeStyle'],
  strokeWidth: number,
): string | null {
  if (strokeStyle === 'solid') {
    return null;
  }
  const dash = dashArray(strokeStyle, strokeWidth);
  return dash === undefined ? null : dash.join(' ');
}

function shadowFilter(shadow: WhiteboardElement['shadow']): string | null {
  if (shadow === null) {
    return null;
  }
  const dy = formatNumber(shadow.offsetY);
  const dx = formatNumber(shadow.offsetX);
  const blur = formatNumber(shadow.blur);
  return `drop-shadow(${dx}px ${dy}px ${blur}px ${shadow.color})`;
}

function wrapElement(
  element: WhiteboardElement,
  inner: string,
  opacityOverride?: number,
): string {
  const rotate =
    element.angle === 0 ? '' : ` rotate(${formatNumber(element.angle)})`;
  const attrs = [
    `transform="translate(${formatNumber(element.x)} ${formatNumber(element.y)})${rotate}"`,
  ];
  const opacity = opacityOverride ?? element.opacity;
  if (opacity < 1) {
    attrs.push(`opacity="${formatNumber(opacity)}"`);
  }
  const filter = shadowFilter(element.shadow);
  if (filter !== null) {
    attrs.push(`style="filter:${filter}"`);
  }
  return `<g ${attrs.join(' ')}>${inner}</g>`;
}

function shapeAttrs(element: WhiteboardElement): string[] {
  const attrs = [
    `fill="${element.fillColor === null ? 'none' : element.fillColor}"`,
    `stroke="${element.strokeColor}"`,
    `stroke-width="${formatNumber(element.strokeWidth)}"`,
  ];
  const dash = strokeDash(element.strokeStyle, element.strokeWidth);
  if (dash !== null) {
    attrs.push(`stroke-dasharray="${dash}"`);
  }
  return attrs;
}

function arrowHead(
  from: { x: number; y: number },
  to: { x: number; y: number },
  strokeWidth: number,
  color: string,
): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const length = Math.max(8, strokeWidth * 3);
  const width = Math.max(8, strokeWidth * 3);
  const baseX = to.x - length * Math.cos(angle);
  const baseY = to.y - length * Math.sin(angle);
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);
  const points = [
    to.x + normalX * 0,
    to.y + normalY * 0,
    baseX + normalX * width,
    baseY + normalY * width,
    baseX - normalX * width,
    baseY - normalY * width,
  ]
    .map(formatNumber)
    .join(' ');
  return `<polygon points="${points}" fill="${color}" stroke="none" />`;
}

function renderTextElement(
  element: Extract<WhiteboardElement, { type: 'text' }>,
): string {
  const layout = layoutRichText(element.paragraphs, {
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    lineHeight: element.lineHeight,
    color: element.color,
    maxWidth: element.autoWidth ? 0 : element.width,
    wrap: !element.autoWidth,
  });
  const nodes: string[] = [];
  for (const line of layout.lines) {
    for (const segment of line.segments) {
      const style = [
        `font-family="${escapeXml(segment.fontFamily)}"`,
        `font-size="${formatNumber(segment.fontSize)}"`,
        `fill="${segment.color}"`,
      ];
      if (segment.bold) {
        style.push('font-weight="bold"');
      }
      if (segment.italic) {
        style.push('font-style="italic"');
      }
      if (segment.underline) {
        style.push('text-decoration="underline"');
      }
      nodes.push(
        `<text x="${formatNumber(segment.x)}" y="${formatNumber(segment.y + segment.fontSize)}" ${style.join(' ')}>${escapeXml(segment.text)}</text>`,
      );
    }
  }
  return nodes.join('');
}

interface StickySegment {
  text: string;
  x: number;
  y: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

function renderStickyElement(
  element: Extract<WhiteboardElement, { type: 'sticky' }>,
): string {
  const innerWidth = Math.max(1, element.width - STICKY_PADDING * 2);
  const layout =
    element.text.length === 0
      ? { lines: [] as { segments: StickySegment[] }[] }
      : layoutRichText(
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
  const nodes: string[] = [
    `<rect width="${formatNumber(element.width)}" height="${formatNumber(element.height)}" rx="2" fill="${element.fillColor ?? STICKY_COLOR_DEFAULT}" stroke="${element.strokeColor}" stroke-opacity="0.18" stroke-width="1" />`,
  ];
  for (const line of layout.lines) {
    for (const segment of line.segments) {
      const style = [
        'font-family="Inter"',
        `font-size="${formatNumber(element.fontSize)}"`,
        `fill="${segment.color}"`,
      ];
      if (segment.bold) {
        style.push('font-weight="bold"');
      }
      if (segment.italic) {
        style.push('font-style="italic"');
      }
      nodes.push(
        `<text x="${formatNumber(STICKY_PADDING + segment.x)}" y="${formatNumber(STICKY_PADDING + segment.y + element.fontSize)}" ${style.join(' ')}>${escapeXml(segment.text)}</text>`,
      );
    }
  }
  return nodes.join('');
}

function buildBezierPath(points: readonly { x: number; y: number }[]): string {
  if (points.length < 4) {
    return `M ${toPoints(points)}`;
  }
  const parts = [`M ${formatNumber(points[0].x)} ${formatNumber(points[0].y)}`];
  for (let i = 1; i + 2 < points.length; i += 3) {
    parts.push(
      `C ${formatNumber(points[i].x)} ${formatNumber(points[i].y)} ${formatNumber(points[i + 1].x)} ${formatNumber(points[i + 1].y)} ${formatNumber(points[i + 2].x)} ${formatNumber(points[i + 2].y)}`,
    );
  }
  return parts.join(' ');
}

function renderElement(element: WhiteboardElement): string {
  switch (element.type) {
    case 'text':
      return wrapElement(element, renderTextElement(element));
    case 'sticky':
      return wrapElement(element, renderStickyElement(element));
    case 'connector': {
      const dash = strokeDash(element.strokeStyle, element.strokeWidth);
      const line = `<polyline points="${toPoints(element.points)}" fill="none" stroke="${element.strokeColor}" stroke-width="${formatNumber(element.strokeWidth)}" stroke-linejoin="round" stroke-linecap="round"${dash === null ? '' : ` stroke-dasharray="${dash}"`} />`;
      const head =
        element.arrowEnd && element.points.length >= 2
          ? arrowHead(
              element.points[element.points.length - 2],
              element.points[element.points.length - 1],
              element.strokeWidth,
              element.strokeColor,
            )
          : '';
      return wrapElement(element, line + head);
    }
    case 'image':
      return wrapElement(
        element,
        `<image href="${escapeXml(element.src)}" width="${formatNumber(element.width)}" height="${formatNumber(element.height)}" preserveAspectRatio="none" />`,
      );
    case 'icon':
      if (element.kind === 'emoji') {
        const text = `<text x="${formatNumber(element.width / 2)}" y="${formatNumber(element.height / 2)}" font-size="${formatNumber(element.size)}" text-anchor="middle" dominant-baseline="central">${escapeXml(element.value)}</text>`;
        return wrapElement(element, text);
      }
      return wrapElement(
        element,
        `<image href="${escapeXml(iconDataUrl(element.value))}" width="${formatNumber(element.width)}" height="${formatNumber(element.height)}" preserveAspectRatio="none" />`,
      );
    case 'rectangle':
      return wrapElement(
        element,
        `<rect width="${formatNumber(element.width)}" height="${formatNumber(element.height)}" ${shapeAttrs(element).join(' ')} />`,
      );
    case 'ellipse':
      return wrapElement(
        element,
        `<ellipse cx="${formatNumber(element.width / 2)}" cy="${formatNumber(element.height / 2)}" rx="${formatNumber(element.width / 2)}" ry="${formatNumber(element.height / 2)}" ${shapeAttrs(element).join(' ')} />`,
      );
    case 'triangle':
      return wrapElement(
        element,
        `<polygon points="${formatNumber(element.width / 2)},0 ${formatNumber(element.width)},${formatNumber(element.height)} 0,${formatNumber(element.height)}" ${shapeAttrs(element).join(' ')} />`,
      );
    case 'diamond':
      return wrapElement(
        element,
        `<polygon points="${formatNumber(element.width / 2)},0 ${formatNumber(element.width)},${formatNumber(element.height / 2)} ${formatNumber(element.width / 2)},${formatNumber(element.height)} 0,${formatNumber(element.height / 2)}" ${shapeAttrs(element).join(' ')} />`,
      );
    case 'line': {
      const [start, end] = element.points;
      const dash = strokeDash(element.strokeStyle, element.strokeWidth);
      return wrapElement(
        element,
        `<line x1="${formatNumber(start.x)}" y1="${formatNumber(start.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="${element.strokeColor}" stroke-width="${formatNumber(element.strokeWidth)}" stroke-linecap="round"${dash === null ? '' : ` stroke-dasharray="${dash}"`} />`,
      );
    }
    case 'arrow': {
      const [start, end] = element.points;
      const dash = strokeDash(element.strokeStyle, element.strokeWidth);
      const line = `<line x1="${formatNumber(start.x)}" y1="${formatNumber(start.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="${element.strokeColor}" stroke-width="${formatNumber(element.strokeWidth)}" stroke-linecap="round"${dash === null ? '' : ` stroke-dasharray="${dash}"`} />`;
      return wrapElement(
        element,
        line + arrowHead(start, end, element.strokeWidth, element.strokeColor),
      );
    }
    case 'pen':
    case 'pencil':
    case 'highlighter': {
      let maxPressure = 1;
      for (const pressure of element.pressures) {
        maxPressure = Math.max(maxPressure, pressure);
      }
      const strokeWidth = Math.max(
        element.strokeWidth,
        element.strokeWidth * maxPressure,
      );
      const opacity =
        element.type === 'highlighter'
          ? element.opacity * 0.45
          : element.opacity;
      const inner = `<polyline points="${toPoints(element.points)}" fill="none" stroke="${element.strokeColor}" stroke-width="${formatNumber(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" />`;
      return wrapElement(element, inner, opacity);
    }
    case 'bezier': {
      const dash = strokeDash(element.strokeStyle, element.strokeWidth);
      return wrapElement(
        element,
        `<path d="${buildBezierPath(element.points)}" fill="none" stroke="${element.strokeColor}" stroke-width="${formatNumber(element.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${dash === null ? '' : ` stroke-dasharray="${dash}"`} />`,
      );
    }
  }
}

export function computeDocumentBounds(
  document: WhiteboardDocument,
  padding = 0,
): SvgBounds {
  if (document.elements.length === 0) {
    return { x: 0, y: 0, width: padding * 2, height: padding * 2 };
  }
  const box = elementsBoundingBox(document.elements);
  if (box === null) {
    return { x: 0, y: 0, width: padding * 2, height: padding * 2 };
  }
  return {
    x: box.x - padding,
    y: box.y - padding,
    width: box.width + padding * 2,
    height: box.height + padding * 2,
  };
}

export function documentToSvg(
  document: WhiteboardDocument,
  options: ExportOptions = {},
): string {
  const padding = options.padding ?? 32;
  const bounds = computeDocumentBounds(document, padding);
  const width = Math.max(1, Math.ceil(bounds.width));
  const height = Math.max(1, Math.ceil(bounds.height));
  const attrs = [
    `xmlns="${SVG_NS}"`,
    `width="${width}"`,
    `height="${height}"`,
    `viewBox="${formatNumber(bounds.x)} ${formatNumber(bounds.y)} ${formatNumber(width)} ${formatNumber(height)}"`,
  ];
  const parts: string[] = [];
  if (options.background !== null && options.background !== undefined) {
    parts.push(
      `<rect x="${formatNumber(bounds.x)}" y="${formatNumber(bounds.y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" fill="${escapeXml(options.background)}" />`,
    );
  }
  for (const element of document.elements) {
    if (element.hidden) {
      continue;
    }
    parts.push(renderElement(element));
  }
  return `<svg ${attrs.join(' ')}>${parts.join('')}</svg>`;
}

export function documentToJson(document: WhiteboardDocument): string {
  return JSON.stringify(
    {
      app: 'collaborative-whiteboard',
      schemaVersion: BOARD_DOCUMENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      elements: document.elements,
    },
    null,
    2,
  );
}
