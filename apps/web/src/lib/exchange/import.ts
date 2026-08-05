import {
  BOARD_DOCUMENT_SCHEMA_VERSION,
  ELEMENT_TYPES,
  FONT_FAMILIES,
  parseWhiteboardDocument,
  type Point,
  type TextParagraph,
  type WhiteboardDocument,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { IMAGE_SIZE } from '@/lib/canvas/constants';

export interface JsonImportResult {
  ok: boolean;
  document?: WhiteboardDocument;
  reason?: string;
}

/** Parses a `.json` board file produced by the exporter. */
export function parseDocumentJson(text: string): JsonImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'The file is not valid JSON.' };
  }
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'schemaVersion' in parsed &&
    parsed.schemaVersion !== BOARD_DOCUMENT_SCHEMA_VERSION
  ) {
    return {
      ok: false,
      reason: `Unsupported schema version ${String(parsed.schemaVersion)} (expected ${BOARD_DOCUMENT_SCHEMA_VERSION}).`,
    };
  }
  const document = parseWhiteboardDocument(parsed);
  if (document === null) {
    return {
      ok: false,
      reason: 'The file does not match the board document schema.',
    };
  }
  return { ok: true, document };
}

let sequence = 0;

function nextElementId(): string {
  sequence += 1;
  return `import-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

function colorOf(value: string | null, fallback: string | null): string | null {
  if (value === null || value === 'none' || value === 'transparent') {
    return fallback;
  }
  return value;
}

function baseElement(attrs: {
  type: WhiteboardElement['type'];
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number;
  opacity?: number;
}): WhiteboardElement {
  const now = Date.now();
  return {
    id: nextElementId(),
    type: attrs.type,
    version: 0,
    x: attrs.x,
    y: attrs.y,
    width: attrs.width,
    height: attrs.height,
    angle: 0,
    opacity: attrs.opacity ?? 1,
    strokeColor: colorOf(attrs.stroke ?? null, '#0f172a') ?? '#0f172a',
    fillColor: colorOf(attrs.fill ?? null, null),
    strokeWidth: attrs.strokeWidth ?? 2,
    strokeStyle: 'solid',
    shadow: null,
    lastModifiedBy: null,
    createdAt: now,
    updatedAt: now,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
  } as WhiteboardElement;
}

/** Number attribute with optional default; `0` is preserved when specified. */
function numberAttr(value: string | null, fallback: number): number {
  if (value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(
  element: Element,
  attribute: string,
): number | undefined {
  const value = element.getAttribute(attribute);
  return value === null ? undefined : numberAttr(value, 0);
}

interface SvgShape {
  kind: 'shape' | 'line' | 'path' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  shape?: 'rectangle' | 'ellipse' | 'triangle' | 'diamond';
  points?: Point[];
  closed?: boolean;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number;
  opacity?: number;
}

/**
 * Converts a subset of SVG (rect, ellipse/circle, line, polyline, polygon,
 * straight-segment and cubic paths, text, image) into whiteboard elements.
 * Curves are approximated by sampled polylines.
 */
export function parseSvgElements(svg: string): WhiteboardElement[] {
  if (typeof DOMParser === 'undefined') {
    return [];
  }
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (document.querySelector('parsererror') !== null) {
    return [];
  }
  const root = document.documentElement;
  if (root === null || root.localName !== 'svg') {
    return [];
  }
  const offsetX = numberAttr(root.getAttribute('x'), 0);
  const offsetY = numberAttr(root.getAttribute('y'), 0);
  const minX = offsetX;
  const minY = offsetY;

  const shapes = collectShapes(root, minX, minY);
  const elements: WhiteboardElement[] = [];
  for (const shape of shapes) {
    const width = Math.max(1, shape.width);
    const height = Math.max(1, shape.height);
    const common = {
      fill: shape.fill ?? null,
      stroke: shape.stroke ?? null,
      strokeWidth: shape.strokeWidth,
      opacity: shape.opacity,
    };
    if (shape.kind === 'text' && shape.text !== undefined) {
      const paragraphs: TextParagraph[] = [
        {
          runs: [{ text: shape.text }],
          align: 'left',
          listType: null,
        },
      ];
      const fontFamily = FONT_FAMILIES.includes(
        shape.fontFamily as (typeof FONT_FAMILIES)[number],
      )
        ? (shape.fontFamily as (typeof FONT_FAMILIES)[number])
        : 'Inter';
      const now = Date.now();
      const textElement: WhiteboardElement = {
        id: nextElementId(),
        type: ELEMENT_TYPES.TEXT,
        version: 0,
        x: shape.x,
        y: shape.y,
        width,
        height,
        angle: 0,
        opacity: shape.opacity ?? 1,
        strokeColor: colorOf(shape.stroke ?? null, '#0f172a') ?? '#0f172a',
        fillColor: null,
        strokeWidth: 2,
        strokeStyle: 'solid',
        shadow: null,
        lastModifiedBy: null,
        createdAt: now,
        updatedAt: now,
        name: null,
        groupId: null,
        locked: false,
        hidden: false,
        paragraphs,
        fontFamily,
        fontSize: shape.fontSize ?? 16,
        lineHeight: 1.2,
        color: colorOf(shape.fill ?? null, '#1f2937') ?? '#1f2937',
        autoWidth: true,
      };
      elements.push(textElement);
      continue;
    }
    if (shape.kind === 'path') {
      const points = shape.points ?? [];
      if (points.length >= 2) {
        elements.push(
          baseElement({
            type: ELEMENT_TYPES.PEN,
            x: shape.x,
            y: shape.y,
            width,
            height,
            ...common,
          }),
        );
        const pen = elements[elements.length - 1] as Extract<
          WhiteboardElement,
          { type: 'pen' }
        >;
        pen.points = points.map((point) => ({
          x: point.x - shape.x,
          y: point.y - shape.y,
        }));
        pen.pressures = points.map(() => 0.5);
      }
      continue;
    }
    if (shape.kind === 'line') {
      const points = (shape.points ?? []).map((point) => ({
        x: point.x - shape.x,
        y: point.y - shape.y,
      }));
      elements.push(
        baseElement({
          type: ELEMENT_TYPES.PEN,
          x: shape.x,
          y: shape.y,
          width,
          height,
          ...common,
        }) as WhiteboardElement,
      );
      const pen = elements[elements.length - 1] as Extract<
        WhiteboardElement,
        { type: 'pen' }
      >;
      pen.points = points;
      pen.pressures = points.map(() => 0.5);
      continue;
    }
    const shapeType = shape.shape === undefined ? 'rectangle' : shape.shape;
    elements.push(
      baseElement({
        type: shapeType,
        x: shape.x,
        y: shape.y,
        width,
        height,
        ...common,
      }),
    );
  }
  return elements;
}

function collectShapes(root: Element, minX: number, minY: number): SvgShape[] {
  const shapes: SvgShape[] = [];
  const walk = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      const tag = child.localName;
      const fill = child.getAttribute('fill');
      const stroke = child.getAttribute('stroke');
      const strokeWidth = optionalNumber(child, 'stroke-width');
      const opacity = optionalNumber(child, 'opacity');
      switch (tag) {
        case 'rect': {
          const x = numberAttr(child.getAttribute('x'), 0) - minX;
          const y = numberAttr(child.getAttribute('y'), 0) - minY;
          const width = Math.max(1, numberAttr(child.getAttribute('width'), 0));
          const height = Math.max(
            1,
            numberAttr(child.getAttribute('height'), 0),
          );
          shapes.push({
            kind: 'shape',
            shape: 'rectangle',
            x,
            y,
            width,
            height,
            fill: fill ?? null,
            stroke: stroke ?? null,
            strokeWidth,
            opacity,
          });
          break;
        }
        case 'circle': {
          const cx = numberAttr(child.getAttribute('cx'), 0) - minX;
          const cy = numberAttr(child.getAttribute('cy'), 0) - minY;
          const r = numberAttr(child.getAttribute('r'), 0);
          shapes.push({
            kind: 'shape',
            shape: 'ellipse',
            x: cx - r,
            y: cy - r,
            width: r * 2,
            height: r * 2,
            fill: fill ?? null,
            stroke: stroke ?? null,
            strokeWidth,
            opacity,
          });
          break;
        }
        case 'ellipse': {
          const cx = numberAttr(child.getAttribute('cx'), 0) - minX;
          const cy = numberAttr(child.getAttribute('cy'), 0) - minY;
          const rx = numberAttr(child.getAttribute('rx'), 0);
          const ry = numberAttr(child.getAttribute('ry'), 0);
          shapes.push({
            kind: 'shape',
            shape: 'ellipse',
            x: cx - rx,
            y: cy - ry,
            width: rx * 2,
            height: ry * 2,
            fill: fill ?? null,
            stroke: stroke ?? null,
            strokeWidth,
            opacity,
          });
          break;
        }
        case 'line': {
          const x1 = numberAttr(child.getAttribute('x1'), 0) - minX;
          const y1 = numberAttr(child.getAttribute('y1'), 0) - minY;
          const x2 = numberAttr(child.getAttribute('x2'), 0) - minX;
          const y2 = numberAttr(child.getAttribute('y2'), 0) - minY;
          const points = [
            { x: x1, y: y1 },
            { x: x2, y: y2 },
          ];
          shapes.push({
            kind: 'line',
            x: Math.min(x1, x2),
            y: Math.min(y1, y2),
            width: Math.abs(x2 - x1),
            height: Math.abs(y2 - y1),
            points,
            stroke: stroke ?? '#0f172a',
            strokeWidth: strokeWidth ?? 2,
            opacity,
          });
          break;
        }
        case 'polyline': {
          const points = parsePoints(child.getAttribute('points'), minX, minY);
          if (points.length >= 2) {
            shapes.push({
              kind: 'line',
              x: Math.min(...points.map((point) => point.x)),
              y: Math.min(...points.map((point) => point.y)),
              width: 0,
              height: 0,
              points,
              stroke: stroke ?? '#0f172a',
              strokeWidth: strokeWidth ?? 2,
              opacity,
            });
          }
          break;
        }
        case 'polygon': {
          const points = parsePoints(child.getAttribute('points'), minX, minY);
          if (points.length >= 3) {
            shapes.push({
              kind: 'line',
              x: Math.min(...points.map((point) => point.x)),
              y: Math.min(...points.map((point) => point.y)),
              width: 0,
              height: 0,
              points,
              stroke: stroke ?? '#0f172a',
              strokeWidth: strokeWidth ?? 2,
              opacity,
            });
          }
          break;
        }
        case 'path': {
          const parsed = parsePath(child.getAttribute('d'));
          if (parsed.length >= 2) {
            shapes.push({
              kind: 'path',
              x: Math.min(...parsed.map((point) => point.x)),
              y: Math.min(...parsed.map((point) => point.y)),
              width: 0,
              height: 0,
              points: parsed,
              stroke: stroke ?? '#0f172a',
              strokeWidth: strokeWidth ?? 2,
              opacity,
            });
          }
          break;
        }
        case 'text': {
          const text = child.textContent ?? '';
          if (text.trim().length > 0) {
            const x = numberAttr(child.getAttribute('x'), 0) - minX;
            const y = numberAttr(child.getAttribute('y'), 0) - minY;
            const fontSize = numberAttr(child.getAttribute('font-size'), 16);
            shapes.push({
              kind: 'text',
              x,
              y,
              width: text.length * fontSize * 0.6,
              height: fontSize * 1.4,
              text,
              fontSize,
              fontFamily: child.getAttribute('font-family') ?? undefined,
              fill: fill ?? null,
              stroke: null,
              strokeWidth: undefined,
              opacity,
            });
          }
          break;
        }
        default:
          break;
      }
      walk(child);
    }
  };
  walk(root);
  return shapes;
}

function parsePoints(
  value: string | null,
  minX: number,
  minY: number,
): Point[] {
  if (value === null) {
    return [];
  }
  const tokens = value
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const points: Point[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    points.push({
      x: Number.parseFloat(tokens[i]) - minX,
      y: Number.parseFloat(tokens[i + 1]) - minY,
    });
  }
  return points;
}

interface PathPoint extends Point {
  control?: { x: number; y: number; x2: number; y2: number } | null;
}

/** Samples an SVG path (`M/L/H/V/C/S/Q/A/Z`) into a polyline. */
export function parsePath(d: string | null): Point[] {
  if (d === null || d.trim() === '') {
    return [];
  }
  const tokens = d.trim().match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (tokens === null) {
    return [];
  }
  const points: PathPoint[] = [];
  let index = 0;
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  while (index < tokens.length) {
    const command = tokens[index];
    index += 1;
    if (command === 'M' || command === 'm') {
      const relative = command === 'm';
      const x = num(tokens, index);
      const y = num(tokens, index + 1);
      index += 2;
      current = relative ? { x: current.x + x, y: current.y + y } : { x, y };
      start = current;
      points.push({ ...current });
      let next = peek(tokens, index);
      while (next !== null && isNumberToken(next)) {
        const dx = num(tokens, index);
        const dy = num(tokens, index + 1);
        index += 2;
        current = relative
          ? { x: current.x + dx, y: current.y + dy }
          : { x: dx, y: dy };
        points.push({ ...current });
        next = peek(tokens, index);
      }
    } else if (command === 'L' || command === 'l') {
      const relative = command === 'l';
      while (index < tokens.length && isNumberToken(peek(tokens, index))) {
        const x = num(tokens, index);
        const y = num(tokens, index + 1);
        index += 2;
        current = relative ? { x: current.x + x, y: current.y + y } : { x, y };
        points.push({ ...current });
      }
    } else if (command === 'H' || command === 'h') {
      const relative = command === 'h';
      while (index < tokens.length && isNumberToken(peek(tokens, index))) {
        const x = num(tokens, index);
        index += 1;
        current = relative
          ? { x: current.x + x, y: current.y }
          : { x, y: current.y };
        points.push({ ...current });
      }
    } else if (command === 'V' || command === 'v') {
      const relative = command === 'v';
      while (index < tokens.length && isNumberToken(peek(tokens, index))) {
        const y = num(tokens, index);
        index += 1;
        current = relative
          ? { x: current.x, y: current.y + y }
          : { x: current.x, y };
        points.push({ ...current });
      }
    } else if (command === 'C' || command === 'c') {
      const relative = command === 'c';
      while (index + 5 < tokens.length) {
        const c1x = num(tokens, index);
        const c1y = num(tokens, index + 1);
        const c2x = num(tokens, index + 2);
        const c2y = num(tokens, index + 3);
        const x = num(tokens, index + 4);
        const y = num(tokens, index + 5);
        index += 6;
        const startPoint = current;
        current = relative
          ? { x: startPoint.x + x, y: startPoint.y + y }
          : { x, y };
        const c1 = relative
          ? { x: startPoint.x + c1x, y: startPoint.y + c1y }
          : { x: c1x, y: c1y };
        const c2 = relative
          ? { x: startPoint.x + c2x, y: startPoint.y + c2y }
          : { x: c2x, y: c2y };
        sampleCubic(startPoint, c1, c2, current, points);
      }
    } else if (command === 'S' || command === 's') {
      const relative = command === 's';
      while (index + 3 < tokens.length) {
        const c2x = num(tokens, index);
        const c2y = num(tokens, index + 1);
        const x = num(tokens, index + 2);
        const y = num(tokens, index + 3);
        index += 4;
        const startPoint = current;
        current = relative
          ? { x: startPoint.x + x, y: startPoint.y + y }
          : { x, y };
        const c1 = reflectControl(points, startPoint);
        const c2 = relative
          ? { x: startPoint.x + c2x, y: startPoint.y + c2y }
          : { x: c2x, y: c2y };
        sampleCubic(startPoint, c1, c2, current, points);
      }
    } else if (command === 'Q' || command === 'q') {
      const relative = command === 'q';
      while (index + 3 < tokens.length) {
        const cx = num(tokens, index);
        const cy = num(tokens, index + 1);
        const x = num(tokens, index + 2);
        const y = num(tokens, index + 3);
        index += 4;
        const startPoint = current;
        current = relative
          ? { x: startPoint.x + x, y: startPoint.y + y }
          : { x, y };
        const control = relative
          ? { x: startPoint.x + cx, y: startPoint.y + cy }
          : { x: cx, y: cy };
        sampleQuadratic(startPoint, control, current, points);
      }
    } else if (command === 'Z' || command === 'z') {
      points.push({ ...start });
      current = start;
    } else {
      break;
    }
  }
  return points;
}

function isNumberToken(token: string | null): boolean {
  return (
    token !== null &&
    token !== 'M' &&
    token !== 'L' &&
    token !== 'H' &&
    token !== 'V' &&
    token !== 'C' &&
    token !== 'S' &&
    token !== 'Q' &&
    token !== 'T' &&
    token !== 'A' &&
    token !== 'Z' &&
    token !== 'm' &&
    token !== 'l' &&
    token !== 'h' &&
    token !== 'v' &&
    token !== 'c' &&
    token !== 's' &&
    token !== 'q' &&
    token !== 't' &&
    token !== 'a' &&
    token !== 'z'
  );
}

function peek(tokens: string[], index: number): string | null {
  return index < tokens.length ? tokens[index] : null;
}

function num(tokens: string[], index: number): number {
  const value = tokens[index];
  return value === undefined ? 0 : Number.parseFloat(value);
}

function reflectControl(points: PathPoint[], end: Point): Point {
  if (points.length >= 2) {
    const previous = points[points.length - 1];
    const previousControl = previous.control ?? previous;
    return {
      x: end.x + (end.x - previousControl.x),
      y: end.y + (end.y - previousControl.y),
    };
  }
  return end;
}

function sampleCubic(
  start: Point,
  c1: Point,
  c2: Point,
  end: Point,
  points: Point[],
): void {
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * start.x +
      3 * mt * mt * t * c1.x +
      3 * mt * t * t * c2.x +
      t * t * t * end.x;
    const y =
      mt * mt * mt * start.y +
      3 * mt * mt * t * c1.y +
      3 * mt * t * t * c2.y +
      t * t * t * end.y;
    points.push({ x, y });
  }
}

function sampleQuadratic(
  start: Point,
  control: Point,
  end: Point,
  points: Point[],
): void {
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * start.x + 2 * mt * t * control.x + t * t * end.x;
    const y = mt * mt * start.y + 2 * mt * t * control.y + t * t * end.y;
    points.push({ x, y });
  }
}

/** Parses an imported SVG string into whiteboard elements. */
export function parseSvgImport(svg: string): WhiteboardElement[] {
  return parseSvgElements(svg);
}

/** Creates an image element from a local image file's data URL. */
export function imageToElement(dataUrl: string): WhiteboardElement {
  const now = Date.now();
  return {
    id: nextElementId(),
    type: ELEMENT_TYPES.IMAGE,
    version: 0,
    x: 0,
    y: 0,
    width: IMAGE_SIZE.width,
    height: IMAGE_SIZE.height,
    angle: 0,
    opacity: 1,
    strokeColor: '#0f172a',
    fillColor: null,
    strokeWidth: 2,
    strokeStyle: 'solid',
    shadow: null,
    lastModifiedBy: null,
    createdAt: now,
    updatedAt: now,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
    src: dataUrl,
  } as WhiteboardElement;
}
