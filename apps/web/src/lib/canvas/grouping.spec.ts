import type { WhiteboardElement } from '@whiteboard/shared';
import { describe, expect, it } from 'vitest';
import {
  createGroup,
  expandSelectionToGroups,
  groupBounds,
  groupIds,
  groupMembers,
  selectionHasGroups,
  ungroupElements,
  ungroupSelection,
} from '@/lib/canvas/grouping';

function rectangle(
  id: string,
  groupId: string | null = null,
): WhiteboardElement {
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
    groupId,
    locked: false,
    hidden: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('grouping', () => {
  it('assigns a group id to the given members only', () => {
    const elements = [rectangle('a'), rectangle('b'), rectangle('c')];
    const grouped = createGroup(elements, ['a', 'b'], 'g1');
    expect(grouped[0]?.groupId).toBe('g1');
    expect(grouped[1]?.groupId).toBe('g1');
    expect(grouped[2]?.groupId).toBeNull();
  });

  it('requires at least two members to form a group', () => {
    const elements = [rectangle('a')];
    expect(createGroup(elements, ['a'], 'g1')).toEqual(elements);
  });

  it('clears membership for every element in a group', () => {
    const elements = [
      rectangle('a', 'g1'),
      rectangle('b', 'g1'),
      rectangle('c'),
    ];
    const ungrouped = ungroupElements(elements, 'g1');
    expect(groupIds(ungrouped)).toEqual([]);
    expect(groupMembers(elements, 'g1').map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('clears membership for the given elements only', () => {
    const elements = [rectangle('a', 'g1'), rectangle('b', 'g1')];
    const result = ungroupSelection(elements, ['a']);
    expect(result[0]?.groupId).toBeNull();
    expect(result[1]?.groupId).toBe('g1');
  });

  it('lists distinct group ids in document order', () => {
    const elements = [
      rectangle('a', 'g2'),
      rectangle('b', 'g1'),
      rectangle('c', 'g1'),
    ];
    expect(groupIds(elements)).toEqual(['g2', 'g1']);
  });

  it('expands a selection to whole groups', () => {
    const elements = [
      rectangle('a', 'g1'),
      rectangle('b', 'g1'),
      rectangle('c'),
    ];
    expect(expandSelectionToGroups(elements, ['a']).sort()).toEqual(['a', 'b']);
    expect(expandSelectionToGroups(elements, ['c'])).toEqual(['c']);
  });

  it('detects group members in a selection', () => {
    const elements = [rectangle('a', 'g1'), rectangle('b')];
    expect(selectionHasGroups(elements, ['a'])).toBe(true);
    expect(selectionHasGroups(elements, ['b'])).toBe(false);
  });

  it('computes the union bounding box of a group', () => {
    const elements = [
      { ...rectangle('a', 'g1'), x: 0, y: 0 },
      { ...rectangle('b', 'g1'), x: 20, y: 10 },
    ];
    expect(groupBounds(elements, 'g1')).toEqual({
      x: 0,
      y: 0,
      width: 30,
      height: 20,
    });
  });
});
