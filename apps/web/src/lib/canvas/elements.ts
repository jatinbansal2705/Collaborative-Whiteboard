import {
  ELEMENT_DEFAULTS,
  ELEMENT_TYPES,
  type ConnectorElement,
  type IconElement,
  type ImageElement,
  type Point,
  type StickyElement,
  type TextElement,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { normalizePoints, rectFromPoints } from './geometry';
import {
  ICON_DEFAULT_SIZE,
  IMAGE_SIZE,
  STICKY_COLOR_DEFAULT,
  STICKY_SIZE,
  TEXT_DEFAULT_COLOR,
  TEXT_DEFAULT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
  TEXT_SIZE,
} from './constants';
import { FILLABLE_ELEMENT_TYPES, type ElementStyle } from './types';

export interface CreateElementOptions {
  id: string;
  style: ElementStyle;
  ownerId: string | null;
  now?: number;
}

const FILLABLE_TYPES = FILLABLE_ELEMENT_TYPES;

/**
 * Builds a validated, version-0 element from raw world-space points. Shapes
 * take two opposite corners; line/arrow/freehand take the polyline; bezier
 * takes the smoothed cubic control points.
 */
export function createElement(
  type: WhiteboardElement['type'],
  rawPoints: readonly Point[],
  options: CreateElementOptions,
  pressures: readonly number[] = [],
): WhiteboardElement {
  const now = options.now ?? Date.now();
  const base = {
    id: options.id,
    version: ELEMENT_DEFAULTS.version,
    angle: ELEMENT_DEFAULTS.angle,
    opacity: options.style.opacity,
    strokeColor: options.style.strokeColor,
    fillColor: FILLABLE_TYPES.has(type) ? options.style.fillColor : null,
    strokeWidth: options.style.strokeWidth,
    strokeStyle: options.style.strokeStyle,
    shadow: options.style.shadow,
    lastModifiedBy: options.ownerId,
    createdAt: now,
    updatedAt: now,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
  } as const;

  switch (type) {
    case ELEMENT_TYPES.RECTANGLE:
    case ELEMENT_TYPES.ELLIPSE:
    case ELEMENT_TYPES.TRIANGLE:
    case ELEMENT_TYPES.DIAMOND: {
      const rect = rectFromPoints(
        rawPoints[0],
        rawPoints[rawPoints.length - 1],
      );
      return {
        ...base,
        type,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }
    case ELEMENT_TYPES.LINE:
    case ELEMENT_TYPES.ARROW: {
      const normalized = normalizePoints(rawPoints);
      return {
        ...base,
        type,
        x: normalized.minX,
        y: normalized.minY,
        width: normalized.width,
        height: normalized.height,
        points: normalized.points,
      };
    }
    case ELEMENT_TYPES.PEN:
    case ELEMENT_TYPES.PENCIL:
    case ELEMENT_TYPES.HIGHLIGHTER: {
      const normalized = normalizePoints(rawPoints);
      return {
        ...base,
        type,
        x: normalized.minX,
        y: normalized.minY,
        width: normalized.width,
        height: normalized.height,
        points: normalized.points,
        pressures: [...pressures],
      };
    }
    case ELEMENT_TYPES.BEZIER: {
      const normalized = normalizePoints(rawPoints);
      return {
        ...base,
        type,
        x: normalized.minX,
        y: normalized.minY,
        width: normalized.width,
        height: normalized.height,
        points: normalized.points,
      };
    }
  }
  throw new Error(`Unsupported element type: ${type as string}`);
}

function baseFields(options: CreateElementOptions): {
  id: string;
  version: number;
  angle: number;
  opacity: number;
  strokeColor: string;
  fillColor: string | null;
  strokeWidth: number;
  strokeStyle: WhiteboardElement['strokeStyle'];
  shadow: WhiteboardElement['shadow'];
  lastModifiedBy: string | null;
  createdAt: number;
  updatedAt: number;
  name: null;
  groupId: null;
  locked: boolean;
  hidden: boolean;
} {
  const now = options.now ?? Date.now();
  return {
    id: options.id,
    version: ELEMENT_DEFAULTS.version,
    angle: ELEMENT_DEFAULTS.angle,
    opacity: options.style.opacity,
    strokeColor: options.style.strokeColor,
    fillColor: options.style.fillColor,
    strokeWidth: options.style.strokeWidth,
    strokeStyle: options.style.strokeStyle,
    shadow: options.style.shadow,
    lastModifiedBy: options.ownerId,
    createdAt: now,
    updatedAt: now,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
  };
}

/** Creates a rich-text element at a point with the default editor size. */
export function createTextElement(
  point: Point,
  options: CreateElementOptions,
): TextElement {
  return {
    ...baseFields(options),
    type: ELEMENT_TYPES.TEXT,
    x: point.x,
    y: point.y,
    width: TEXT_SIZE.width,
    height: TEXT_SIZE.height,
    paragraphs: [{ runs: [{ text: 'Text' }], align: 'left', listType: null }],
    fontFamily: 'Inter',
    fontSize: TEXT_DEFAULT_FONT_SIZE,
    lineHeight: TEXT_LINE_HEIGHT,
    color: TEXT_DEFAULT_COLOR,
    autoWidth: true,
  };
}

/** Creates a sticky note at a point with the default size and background. */
export function createStickyElement(
  point: Point,
  options: CreateElementOptions,
): StickyElement {
  return {
    ...baseFields(options),
    type: ELEMENT_TYPES.STICKY,
    x: point.x,
    y: point.y,
    width: STICKY_SIZE.width,
    height: STICKY_SIZE.height,
    fillColor: options.style.fillColor ?? STICKY_COLOR_DEFAULT,
    text: '',
    fontSize: TEXT_DEFAULT_FONT_SIZE,
  };
}

/** Creates a connector between two world anchors (routing cached by build). */
export function createConnectorElement(
  start: Point,
  end: Point,
  options: CreateElementOptions,
): ConnectorElement {
  return {
    ...baseFields(options),
    type: ELEMENT_TYPES.CONNECTOR,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    start,
    end,
    startElementId: null,
    startHandle: null,
    endElementId: null,
    endHandle: null,
    points: [],
    arrowEnd: true,
  };
}

/** Creates an image element referencing a remote URL or local data URL. */
export function createImageElement(
  point: Point,
  src: string,
  options: CreateElementOptions,
): ImageElement {
  return {
    ...baseFields(options),
    type: ELEMENT_TYPES.IMAGE,
    x: point.x,
    y: point.y,
    width: IMAGE_SIZE.width,
    height: IMAGE_SIZE.height,
    src,
  };
}

/** Creates an icon/emoji element at a point with the default size. */
export function createIconElement(
  point: Point,
  kind: 'emoji' | 'icon',
  value: string,
  options: CreateElementOptions,
): IconElement {
  const size = ICON_DEFAULT_SIZE;
  return {
    ...baseFields(options),
    type: ELEMENT_TYPES.ICON,
    x: point.x,
    y: point.y,
    width: size,
    height: size,
    kind,
    value,
    size,
  };
}

/** Deep copy of an element with a fresh id, offset and version (for duplicate/paste). */
export function duplicateElement(
  element: WhiteboardElement,
  id: string,
  offsetX: number,
  offsetY: number,
): WhiteboardElement {
  return {
    ...element,
    id,
    x: element.x + offsetX,
    y: element.y + offsetY,
    version: element.version + 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastModifiedBy: null,
  };
}

/** Applies style fields to an element (fill only where supported). */
export function applyStyle(
  element: WhiteboardElement,
  style: ElementStyle,
): WhiteboardElement {
  if (FILLABLE_TYPES.has(element.type)) {
    return { ...element, ...style };
  }
  const { fillColor: _fillColor, ...rest } = style;
  return { ...element, ...rest };
}

const DASH_PATTERNS: Record<
  WhiteboardElement['strokeStyle'],
  number[] | undefined
> = {
  solid: undefined,
  dashed: [12, 8],
  dotted: [2, 8],
  'dash-dot': [12, 8, 2, 8],
};

/** Konva dash array for a stroke style (scaled so patterns track line width). */
export function dashArray(
  strokeStyle: WhiteboardElement['strokeStyle'],
  strokeWidth: number,
): number[] | undefined {
  const pattern = DASH_PATTERNS[strokeStyle];
  if (pattern === undefined) {
    return undefined;
  }
  const scale = Math.max(0.25, strokeWidth / 2);
  return pattern.map((value) => value * scale);
}
