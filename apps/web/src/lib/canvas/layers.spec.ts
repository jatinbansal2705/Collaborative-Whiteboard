import type { WhiteboardElement } from '@whiteboard/shared';
import { describe, expect, it } from 'vitest';
import {
  bringForward,
  bringToFront,
  elementIndex,
  moveToIndex,
  sendBackward,
  sendToBack,
  topmostFirst,
} from '@/lib/canvas/layers';

function rectangle(id: string): WhiteboardElement {
  return {
    id,
    type: 'rectangle',
    version: 0,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
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

const ids = (elements: readonly WhiteboardElement[]): string[] =>
  elements.map((element) => element.id);

describe('layers (z-order)', () => {
  it('reports the array index as the z-index', () => {
    const elements = [rectangle('a'), rectangle('b'), rectangle('c')];
    expect(elementIndex(elements, 'b')).toBe(1);
    expect(elementIndex(elements, 'missing')).toBe(-1);
  });

  it('orders top-most first for the layers panel', () => {
    expect(ids(topmostFirst([rectangle('a'), rectangle('b')]))).toEqual([
      'b',
      'a',
    ]);
  });

  it('moves a single element to a target index', () => {
    const elements = [rectangle('a'), rectangle('b'), rectangle('c')];
    expect(ids(moveToIndex(elements, 'a', 2))).toEqual(['b', 'c', 'a']);
    expect(ids(moveToIndex(elements, 'c', 0))).toEqual(['c', 'a', 'b']);
  });

  it('returns a fresh array for no-op re-orders', () => {
    const elements = [rectangle('a'), rectangle('b')];
    expect(moveToIndex(elements, 'a', 0)).not.toBe(elements);
  });

  it('brings the selection to the front preserving relative order', () => {
    const elements = [rectangle('a'), rectangle('b'), rectangle('c')];
    expect(ids(bringToFront(elements, ['a', 'c']))).toEqual(['b', 'a', 'c']);
  });

  it('sends the selection to the back preserving relative order', () => {
    const elements = [rectangle('a'), rectangle('b'), rectangle('c')];
    expect(ids(sendToBack(elements, ['a', 'c']))).toEqual(['a', 'c', 'b']);
  });

  it('brings a selection forward one step as a block', () => {
    const elements = [
      rectangle('a'),
      rectangle('b'),
      rectangle('c'),
      rectangle('d'),
    ];
    expect(ids(bringForward(elements, ['a', 'b']))).toEqual([
      'c',
      'a',
      'b',
      'd',
    ]);
  });

  it('sends a selection backward one step as a block', () => {
    const elements = [
      rectangle('a'),
      rectangle('b'),
      rectangle('c'),
      rectangle('d'),
    ];
    expect(ids(sendBackward(elements, ['c', 'd']))).toEqual([
      'a',
      'c',
      'd',
      'b',
    ]);
  });
});
