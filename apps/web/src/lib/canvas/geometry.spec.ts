import type { WhiteboardElement } from '@whiteboard/shared';
import { describe, expect, it } from 'vitest';
import {
  catmullRomToBezier,
  distance,
  distanceToPolyline,
  elementBBox,
  findGuides,
  moveElement,
  normalizePoints,
  pointInElement,
  pointInRect,
  rectFromPoints,
  rectsIntersect,
  resizeElement,
} from '@/lib/canvas/geometry';
import type { WorldRect } from '@/lib/canvas/types';

function baseElement(overrides: Partial<WhiteboardElement>): WhiteboardElement {
  return {
    id: 'el-1',
    type: 'rectangle',
    version: 0,
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle: 0,
    opacity: 1,
    strokeColor: '#000000',
    fillColor: null,
    strokeWidth: 2,
    strokeStyle: 'solid',
    shadow: null,
    lastModifiedBy: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as WhiteboardElement;
}

describe('geometry primitives', () => {
  it('computes euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('measures distance to a segment', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(distanceToPolyline({ x: 5, y: 3 }, [a, b])).toBeCloseTo(3);
    expect(distanceToPolyline({ x: 12, y: 0 }, [a, b])).toBeCloseTo(2);
  });

  it('hit-tests rectangles and intersections', () => {
    const rect: WorldRect = { x: 0, y: 0, width: 10, height: 10 };
    expect(pointInRect({ x: 5, y: 5 }, rect)).toBe(true);
    expect(pointInRect({ x: 15, y: 5 }, rect)).toBe(false);
    expect(rectsIntersect(rect, { x: 5, y: 5, width: 10, height: 10 })).toBe(
      true,
    );
    expect(rectsIntersect(rect, { x: 20, y: 20, width: 5, height: 5 })).toBe(
      false,
    );
  });

  it('normalizes raw points into a local frame', () => {
    const raw = [
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 10, y: 60 },
    ];
    const result = normalizePoints(raw);
    expect(result.minX).toBe(10);
    expect(result.minY).toBe(20);
    expect(result.width).toBe(30);
    expect(result.height).toBe(40);
    expect(result.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('builds a rect from two corners', () => {
    expect(rectFromPoints({ x: 10, y: 20 }, { x: 5, y: 40 })).toEqual({
      x: 5,
      y: 20,
      width: 5,
      height: 20,
    });
  });

  it('moves an element by a delta', () => {
    const moved = moveElement(baseElement({}), 5, -3);
    expect(moved.x).toBe(5);
    expect(moved.y).toBe(-3);
  });
});

describe('pointInElement', () => {
  it('hits shapes at their centre', () => {
    const element = baseElement({ type: 'rectangle' });
    expect(pointInElement(element, { x: 50, y: 25 })).toBe(true);
    expect(pointInElement(element, { x: 150, y: 25 })).toBe(false);
  });

  it('honours the ellipse boundary', () => {
    const element = baseElement({ type: 'ellipse' });
    expect(pointInElement(element, { x: 50, y: 25 })).toBe(true);
    expect(pointInElement(element, { x: 0, y: 25 })).toBe(true);
    expect(pointInElement(element, { x: 0, y: 0 })).toBe(false);
  });

  it('rotated elements hit-test in local space', () => {
    const element = baseElement({ type: 'rectangle', angle: 90 });
    expect(pointInElement(element, { x: 50, y: 25 })).toBe(true);
    expect(pointInElement(element, { x: 0, y: 0 })).toBe(false);
  });

  it('hits polyline elements within their stroke width', () => {
    const element = baseElement({
      type: 'line',
      width: 40,
      height: 0,
      strokeWidth: 4,
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
      ],
    });
    expect(pointInElement(element, { x: 20, y: 1 })).toBe(true);
    expect(pointInElement(element, { x: 20, y: 10 })).toBe(false);
  });

  it('hits freehand elements using the sampled path', () => {
    const element = baseElement({
      type: 'pen',
      width: 20,
      height: 0,
      strokeWidth: 2,
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ],
      pressures: [1, 1],
    });
    expect(pointInElement(element, { x: 10, y: 0 })).toBe(true);
  });

  it('hits bezier curves along their path', () => {
    const points = catmullRomToBezier([
      { x: 0, y: 0 },
      { x: 20, y: 10 },
    ]);
    const element = baseElement({
      type: 'bezier',
      width: 20,
      height: 10,
      strokeWidth: 2,
      points,
    });
    expect(pointInElement(element, { x: 10, y: 5 })).toBe(true);
    expect(pointInElement(element, { x: 30, y: 5 })).toBe(false);
  });
});

describe('elementBBox', () => {
  it('matches the element rect when unrotated', () => {
    const element = baseElement({});
    const bbox = elementBBox(element);
    expect(bbox).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('expands when rotated', () => {
    const element = baseElement({ angle: 90 });
    const bbox = elementBBox(element);
    expect(bbox.width).toBeCloseTo(50);
    expect(bbox.height).toBeCloseTo(100);
  });
});

describe('resizeElement', () => {
  it('resizes from the south-east corner, keeping the north-west anchored', () => {
    const element = baseElement({});
    const resized = resizeElement(element, 'se', { x: 150, y: 80 });
    expect(resized.x).toBe(0);
    expect(resized.y).toBe(0);
    expect(resized.width).toBe(150);
    expect(resized.height).toBe(80);
  });

  it('resizes from the north-west corner, keeping the south-east anchored', () => {
    const element = baseElement({});
    const resized = resizeElement(element, 'nw', { x: 30, y: 10 });
    expect(resized.width).toBe(70);
    expect(resized.height).toBe(40);
    expect(resized.x).toBeCloseTo(30);
    expect(resized.y).toBeCloseTo(10);
  });

  it('preserves aspect ratio when requested', () => {
    const element = baseElement({});
    const resized = resizeElement(
      element,
      'se',
      { x: 200, y: 60 },
      { maintainAspect: true },
    );
    expect(resized.width / resized.height).toBeCloseTo(2);
    expect(resized.height).toBeGreaterThanOrEqual(50);
  });

  it('enforces a minimum size', () => {
    const element = baseElement({});
    const resized = resizeElement(element, 'se', { x: 2, y: 1 });
    expect(resized.width).toBeGreaterThanOrEqual(4);
    expect(resized.height).toBeGreaterThanOrEqual(4);
  });
});

describe('findGuides', () => {
  it('snaps a moved rect edge to a neighbour edge', () => {
    const moved = { x: 0, y: 0, width: 10, height: 10 };
    const target = { x: 60, y: 0, width: 10, height: 10 };
    const guides = findGuides([moved], [target], 48, 0, 6);
    expect(guides.dx).toBe(50);
    expect(guides.linesX).toContain(60);
  });

  it('leaves deltas unchanged when nothing is within tolerance', () => {
    const moved = { x: 0, y: 0, width: 10, height: 10 };
    const target = { x: 200, y: 0, width: 10, height: 10 };
    const guides = findGuides([moved], [target], 48, 5, 6);
    expect(guides.dx).toBe(48);
    expect(guides.dy).toBe(5);
    expect(guides.linesX).toHaveLength(0);
  });
});

describe('catmullRomToBezier', () => {
  it('returns an empty array for fewer than two anchors', () => {
    expect(catmullRomToBezier([{ x: 0, y: 0 }])).toEqual([]);
  });

  it('produces 3n+1 control points', () => {
    const anchors = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
    ];
    const points = catmullRomToBezier(anchors);
    expect(points).toHaveLength(7);
    expect(points[0]).toEqual(anchors[0]);
    expect(points[6]).toEqual(anchors[2]);
  });
});
