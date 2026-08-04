import type { WhiteboardElement } from '@whiteboard/shared';
import { describe, expect, it } from 'vitest';
import { alignSelection, distributeSelection } from '@/lib/canvas/alignment';
import { elementBBox } from '@/lib/canvas/geometry';

function rectangle(
  id: string,
  x: number,
  y: number,
  width = 20,
  height = 10,
): WhiteboardElement {
  return {
    id,
    type: 'rectangle',
    version: 0,
    x,
    y,
    width,
    height,
    angle: 0,
    opacity: 1,
    strokeColor: '#000',
    fillColor: null,
    strokeWidth: 2,
    strokeStyle: 'solid',
    shadow: null,
    lastModifiedBy: null,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('alignment', () => {
  it('returns a fresh array when nothing is selected', () => {
    const elements = [rectangle('a', 0, 0)];
    expect(alignSelection(elements, [], 'left')).not.toBe(elements);
  });

  it('aligns left edges to the bounding box', () => {
    const elements = [rectangle('a', 10, 0), rectangle('b', 50, 0)];
    const result = alignSelection(elements, ['a', 'b'], 'left');
    expect(result[0]?.x).toBe(10);
    expect(result[1]?.x).toBe(10);
  });

  it('aligns to the right edge', () => {
    const elements = [rectangle('a', 0, 0), rectangle('b', 30, 0)];
    const result = alignSelection(elements, ['a', 'b'], 'right');
    const right = 30 + 20;
    expect(result[0]?.x).toBe(right - 20);
    expect(result[1]?.x).toBe(30);
    expect(result[1]?.x + 20).toBe(right);
  });

  it('aligns to the vertical center', () => {
    const elements = [rectangle('a', 0, 0), rectangle('b', 40, 0)];
    const result = alignSelection(elements, ['a', 'b'], 'center');
    const centerX = (0 + 40 + 20) / 2;
    expect(result[0]?.x).toBe(centerX - 10);
    expect(result[1]?.x).toBe(centerX - 10);
  });

  it('aligns to the middle', () => {
    const elements = [rectangle('a', 0, 0), rectangle('b', 0, 50)];
    const result = alignSelection(elements, ['a', 'b'], 'middle');
    const middleY = 30;
    expect(result[0]?.y).toBe(middleY - 5);
    expect(result[1]?.y).toBe(middleY - 5);
  });

  it('aligns to the bottom', () => {
    const elements = [rectangle('a', 0, 0), rectangle('b', 0, 40)];
    const result = alignSelection(elements, ['a', 'b'], 'bottom');
    const bottom = 50;
    expect(result[0]?.y).toBe(bottom - 10);
    expect(result[1]?.y).toBe(40);
    expect(result[1]?.y + 10).toBe(bottom);
  });

  it('preserves rotation while aligning the world box', () => {
    const rotated = { ...rectangle('a', 0, 0, 20, 10), angle: 90 };
    const other = rectangle('b', 100, 0);
    const result = alignSelection([rotated, other], ['a', 'b'], 'left');
    expect(result[0]?.angle).toBe(90);
    expect(elementBBox(result[0]).x).toBeCloseTo(elementBBox(result[1]).x);
  });

  it('distributes elements evenly between the extremes', () => {
    const elements = [
      rectangle('a', 0, 0),
      rectangle('b', 60, 0),
      rectangle('c', 120, 0),
    ];
    const result = distributeSelection(elements, ['a', 'b', 'c'], 'horizontal');
    expect(result[0]?.x).toBe(0);
    expect(result[1]?.x).toBe(60);
    expect(result[2]?.x).toBe(120);
  });

  it('distributes by leading edges, not widths', () => {
    const elements = [
      rectangle('a', 0, 0, 10),
      rectangle('b', 100, 0, 40),
      rectangle('c', 200, 0, 20),
    ];
    const result = distributeSelection(elements, ['a', 'b', 'c'], 'horizontal');
    expect(result[0]?.x).toBe(0);
    expect(result[1]?.x).toBe(100);
    expect(result[2]?.x).toBe(200);
  });

  it('requires at least three elements to distribute', () => {
    const elements = [rectangle('a', 0, 0), rectangle('b', 50, 0)];
    const result = distributeSelection(elements, ['a', 'b'], 'horizontal');
    expect(result[1]?.x).toBe(50);
  });
});
