import {
  ELEMENT_DEFAULTS,
  ELEMENT_TYPES,
  type Point,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { normalizePoints, rectFromPoints } from './geometry';
import type { DashStyle, ElementStyle } from './types';

export interface CreateElementOptions {
  id: string;
  style: ElementStyle;
  ownerId: string | null;
  now?: number;
}

const FILLABLE_TYPES = new Set<WhiteboardElement['type']>([
  ELEMENT_TYPES.RECTANGLE,
  ELEMENT_TYPES.ELLIPSE,
  ELEMENT_TYPES.TRIANGLE,
  ELEMENT_TYPES.DIAMOND,
]);

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
  };

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

const DASH_PATTERNS: Record<DashStyle, number[] | undefined> = {
  solid: undefined,
  dashed: [12, 8],
  dotted: [2, 8],
  'dash-dot': [12, 8, 2, 8],
};

/** Konva dash array for a stroke style (scaled so patterns track line width). */
export function dashArray(
  strokeStyle: DashStyle,
  strokeWidth: number,
): number[] | undefined {
  const pattern = DASH_PATTERNS[strokeStyle];
  if (pattern === undefined) {
    return undefined;
  }
  const scale = Math.max(0.25, strokeWidth / 2);
  return pattern.map((value) => value * scale);
}
