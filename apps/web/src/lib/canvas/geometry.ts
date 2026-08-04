import type { Point, WhiteboardElement } from '@whiteboard/shared';
import { MIN_ELEMENT_SIZE, ROTATE_SNAP_STEP } from './constants';
import type { GuideLines, ResizeHandle, WorldRect } from './types';

const DEG = Math.PI / 180;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return distance(p, a);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPolyline(p: Point, points: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    best = Math.min(best, distanceToSegment(p, points[i - 1], points[i]));
  }
  return best;
}

const BEZIER_SAMPLES = 24;

/** Distance from a point to a cubic bezier polyline (points = `3n + 1`). */
export function distanceToBezier(p: Point, points: Point[]): number {
  const segments = Math.floor((points.length - 1) / 3);
  let best = Infinity;
  for (let s = 0; s < segments; s += 1) {
    const p0 = points[s * 3];
    const c1 = points[s * 3 + 1];
    const c2 = points[s * 3 + 2];
    const p3 = points[s * 3 + 3];
    let prev: Point = p0;
    for (let i = 1; i <= BEZIER_SAMPLES; i += 1) {
      const t = i / BEZIER_SAMPLES;
      const mt = 1 - t;
      const point: Point = {
        x:
          mt * mt * mt * p0.x +
          3 * mt * mt * t * c1.x +
          3 * mt * t * t * c2.x +
          t * t * t * p3.x,
        y:
          mt * mt * mt * p0.y +
          3 * mt * mt * t * c1.y +
          3 * mt * t * t * c2.y +
          t * t * t * p3.y,
      };
      best = Math.min(best, distanceToSegment(p, prev, point));
      prev = point;
    }
  }
  return best;
}

export function pointInRect(p: Point, rect: WorldRect): boolean {
  return (
    p.x >= rect.x &&
    p.x <= rect.x + rect.width &&
    p.y >= rect.y &&
    p.y <= rect.y + rect.height
  );
}

export function rectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function rectContainsRect(outer: WorldRect, inner: WorldRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function unionRects(a: WorldRect, b: WorldRect): WorldRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function elementCenter(element: WhiteboardElement): Point {
  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  };
}

/** Maps a world point into the element's local (pre-rotation) frame. */
export function worldToElementLocal(
  element: WhiteboardElement,
  worldPoint: Point,
): Point {
  const cx = element.width / 2;
  const cy = element.height / 2;
  const rad = -element.angle * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = worldPoint.x - element.x - cx;
  const dy = worldPoint.y - element.y - cy;
  return {
    x: dx * cos - dy * sin + cx,
    y: dx * sin + dy * cos + cy,
  };
}

/** Maps an element-local (pre-rotation) point back into world space. */
export function elementLocalToWorld(
  element: WhiteboardElement,
  localPoint: Point,
): Point {
  const cx = element.width / 2;
  const cy = element.height / 2;
  const rad = element.angle * DEG;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = localPoint.x - cx;
  const dy = localPoint.y - cy;
  return {
    x: element.x + dx * cos - dy * sin + cx,
    y: element.y + dx * sin + dy * cos + cy,
  };
}

/** World-space position of a bbox corner at fraction `(fx, fy)`. */
export function elementCornerWorld(
  element: WhiteboardElement,
  fx: number,
  fy: number,
): Point {
  return elementLocalToWorld(element, {
    x: fx * element.width,
    y: fy * element.height,
  });
}

/** Axis-aligned world bounding box of an element, including rotation. */
export function elementBBox(element: WhiteboardElement): WorldRect {
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  const rad = Math.abs(element.angle) * DEG;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const width = element.width * cos + element.height * sin;
  const height = element.width * sin + element.height * cos;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Union of world bounding boxes; `null` when no elements are given. */
export function elementsBoundingBox(
  elements: readonly WhiteboardElement[],
): WorldRect | null {
  let result: WorldRect | null = null;
  for (const element of elements) {
    result =
      result === null
        ? elementBBox(element)
        : unionRects(result, elementBBox(element));
  }
  return result;
}

function freehandMaxWidth(element: WhiteboardElement): number {
  if (
    element.type === 'pen' ||
    element.type === 'pencil' ||
    element.type === 'highlighter'
  ) {
    let max = 0;
    for (const pressure of element.pressures) {
      max = Math.max(max, pressure);
    }
    return Math.max(element.strokeWidth * max, element.strokeWidth / 2);
  }
  return element.strokeWidth;
}

/** Precise hit test for a world point against an element, in world units. */
export function pointInElement(
  element: WhiteboardElement,
  worldPoint: Point,
  tolerance = 0,
): boolean {
  const local = worldToElementLocal(element, worldPoint);
  const w = element.width;
  const h = element.height;
  const pad = tolerance;

  switch (element.type) {
    case 'rectangle':
      return (
        local.x >= -pad &&
        local.x <= w + pad &&
        local.y >= -pad &&
        local.y <= h + pad
      );
    case 'ellipse': {
      const rx = w / 2 + pad;
      const ry = h / 2 + pad;
      const nx = (local.x - w / 2) / rx;
      const ny = (local.y - h / 2) / ry;
      return nx * nx + ny * ny <= 1;
    }
    case 'triangle':
      return pointInPolygon(local, [
        { x: w / 2, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ]);
    case 'diamond':
      return pointInPolygon(local, [
        { x: w / 2, y: 0 },
        { x: w, y: h / 2 },
        { x: w / 2, y: h },
        { x: 0, y: h / 2 },
      ]);
    case 'line':
    case 'arrow':
      return (
        distanceToPolyline(local, element.points) <=
        element.strokeWidth / 2 + pad
      );
    case 'pen':
    case 'pencil':
    case 'highlighter':
      return (
        distanceToPolyline(local, element.points) <=
        freehandMaxWidth(element) / 2 + pad
      );
    case 'bezier':
      return (
        distanceToBezier(local, element.points) <= element.strokeWidth / 2 + pad
      );
    case 'text':
    case 'sticky':
    case 'image':
    case 'icon':
      return (
        local.x >= -pad &&
        local.x <= w + pad &&
        local.y >= -pad &&
        local.y <= h + pad
      );
    case 'connector':
      return element.points.length === 0
        ? false
        : distanceToPolyline(local, element.points) <=
            element.strokeWidth / 2 + pad;
  }
}

const HANDLE_ANCHOR: Record<ResizeHandle, { fx: number; fy: number }> = {
  nw: { fx: 0, fy: 0 },
  n: { fx: 0.5, fy: 0 },
  ne: { fx: 1, fy: 0 },
  e: { fx: 1, fy: 0.5 },
  se: { fx: 1, fy: 1 },
  s: { fx: 0.5, fy: 1 },
  sw: { fx: 0, fy: 1 },
  w: { fx: 0, fy: 0.5 },
};

export interface ResizeOptions {
  maintainAspect?: boolean;
  minSize?: number;
}

function scalePoints(
  element: WhiteboardElement,
  scaleX: number,
  scaleY: number,
): WhiteboardElement {
  if (
    element.type !== 'line' &&
    element.type !== 'arrow' &&
    element.type !== 'pen' &&
    element.type !== 'pencil' &&
    element.type !== 'highlighter' &&
    element.type !== 'bezier'
  ) {
    return element;
  }
  const points = element.points.map((point) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  }));
  if (
    element.type === 'pen' ||
    element.type === 'pencil' ||
    element.type === 'highlighter'
  ) {
    return { ...element, points };
  }
  return { ...element, points };
}

/**
 * Resizes an element by dragging the handle whose anchor corner stays fixed.
 * Operates in the element's local frame so rotated elements behave correctly.
 * Returns a new element (the caller bumps the version for undo/history).
 */
export function resizeElement(
  element: WhiteboardElement,
  handle: ResizeHandle,
  pointerWorld: Point,
  options: ResizeOptions = {},
): WhiteboardElement {
  const maintainAspect = options.maintainAspect ?? false;
  const minSize = options.minSize ?? MIN_ELEMENT_SIZE;
  const anchor = HANDLE_ANCHOR[handle];
  const pointer = worldToElementLocal(element, pointerWorld);
  const fixedX = (1 - anchor.fx) * element.width;
  const fixedY = (1 - anchor.fy) * element.height;
  const ratio = element.height === 0 ? 1 : element.width / element.height;

  const movingX = anchor.fx !== 0.5;
  const movingY = anchor.fy !== 0.5;

  let x0 = 0;
  let y0 = 0;
  let width: number;
  let height: number;

  if (maintainAspect && movingX && movingY) {
    const dx = Math.abs(pointer.x - fixedX);
    const dy = Math.abs(pointer.y - fixedY);
    if (dx >= dy * ratio) {
      width = Math.max(dx, minSize);
      height = width / ratio;
    } else {
      height = Math.max(dy, minSize);
      width = height * ratio;
    }
    x0 = anchor.fx === 0 ? element.width - width : 0;
    y0 = anchor.fy === 0 ? element.height - height : 0;
  } else {
    if (anchor.fx === 0) {
      width = Math.max(element.width - pointer.x, minSize);
      x0 = element.width - width;
    } else if (anchor.fx === 1) {
      width = Math.max(pointer.x, minSize);
      x0 = 0;
    } else {
      width = element.width;
      x0 = 0;
    }
    if (anchor.fy === 0) {
      height = Math.max(element.height - pointer.y, minSize);
      y0 = element.height - height;
    } else if (anchor.fy === 1) {
      height = Math.max(pointer.y, minSize);
      y0 = 0;
    } else {
      height = element.height;
      y0 = 0;
    }
  }

  const scaleX = element.width === 0 ? 1 : width / element.width;
  const scaleY = element.height === 0 ? 1 : height / element.height;

  return {
    ...scalePoints(element, scaleX, scaleY),
    x: element.x + x0,
    y: element.y + y0,
    width,
    height,
  };
}

/** Rotates an element by an absolute angle in degrees. */
export function rotateElement(
  element: WhiteboardElement,
  angle: number,
): WhiteboardElement {
  return { ...element, angle: normalizeAngle(angle) };
}

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function snapAngle(
  angle: number,
  step: number = ROTATE_SNAP_STEP,
): number {
  return Math.round(angle / step) * step;
}

export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

export function moveElement(
  element: WhiteboardElement,
  dx: number,
  dy: number,
): WhiteboardElement {
  return { ...element, x: element.x + dx, y: element.y + dy };
}

const GUIDE_FRACTIONS = [0, 0.5, 1] as const;

function collectGuideLines(rects: readonly WorldRect[]): {
  xs: number[];
  ys: number[];
} {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const rect of rects) {
    for (const fraction of GUIDE_FRACTIONS) {
      xs.push(rect.x + rect.width * fraction);
      ys.push(rect.y + rect.height * fraction);
    }
  }
  return { xs, ys };
}

function snapAxis(
  moved: number[],
  targets: number[],
  delta: number,
  tolerance: number,
): { delta: number; lines: number[] } {
  let bestAbs = Infinity;
  let bestDiff = 0;
  const lines = new Set<number>();
  for (const value of moved) {
    const candidate = value + delta;
    for (const target of targets) {
      const diff = candidate - target;
      const abs = Math.abs(diff);
      if (abs <= tolerance) {
        lines.add(target);
        if (abs < bestAbs) {
          bestAbs = abs;
          bestDiff = diff;
        }
      }
    }
  }
  if (bestAbs === Infinity) {
    return { delta, lines: [] };
  }
  return { delta: delta - bestDiff, lines: [...lines] };
}

/**
 * Smart alignment guides: finds the best snap for `delta` so the moved rects
 * align with neighbor rects' edges/centers, returning the adjusted delta and
 * the guide lines to draw.
 */
export function findGuides(
  selectedRects: readonly WorldRect[],
  otherRects: readonly WorldRect[],
  dx: number,
  dy: number,
  tolerance: number,
): GuideLines {
  const movedXs = selectedRects.flatMap((rect) => [
    rect.x,
    rect.x + rect.width / 2,
    rect.x + rect.width,
  ]);
  const movedYs = selectedRects.flatMap((rect) => [
    rect.y,
    rect.y + rect.height / 2,
    rect.y + rect.height,
  ]);
  const { xs: targetXs, ys: targetYs } = collectGuideLines(otherRects);
  const snappedX = snapAxis(movedXs, targetXs, dx, tolerance);
  const snappedY = snapAxis(movedYs, targetYs, dy, tolerance);
  return {
    dx: snappedX.delta,
    dy: snappedY.delta,
    linesX: snappedX.lines,
    linesY: snappedY.lines,
  };
}

/** Normalizes raw world-space points into `{ points, minX, minY, width, height }`. */
export function normalizePoints(rawPoints: readonly Point[]): {
  points: Point[];
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of rawPoints) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    points: rawPoints.map((point) => ({
      x: point.x - minX,
      y: point.y - minY,
    })),
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function rectFromPoints(a: Point, b: Point): WorldRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/**
 * Catmull-Rom smoothing: converts anchor points into cubic bezier control
 * points (`3n + 1` values). Two anchors produce a straight cubic segment.
 */
export function catmullRomToBezier(anchors: readonly Point[]): Point[] {
  if (anchors.length < 2) {
    return [];
  }
  if (anchors.length === 2) {
    const [a, b] = anchors;
    const third = { x: (b.x - a.x) / 3, y: (b.y - a.y) / 3 };
    return [
      a,
      { x: a.x + third.x, y: a.y + third.y },
      { x: b.x - third.x, y: b.y - third.y },
      b,
    ];
  }
  const result: Point[] = [anchors[0]];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const p0 = anchors[i - 1] ?? anchors[i];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = anchors[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    result.push(c1, c2, p2);
  }
  return result;
}
