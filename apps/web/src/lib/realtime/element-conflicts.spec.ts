import { describe, expect, it } from 'vitest';
import type { WhiteboardElement } from '@whiteboard/shared';
import {
  applyDrawPatch,
  applyElementCreate,
  applyElementDelete,
} from '@/lib/realtime/element-conflicts';

function element(id: string, version: number): WhiteboardElement {
  return {
    id,
    type: 'rectangle',
    version,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
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
  } as WhiteboardElement;
}

function patchEvent(
  id: string,
  version: number,
  patch: Record<string, unknown>,
): Parameters<typeof applyDrawPatch>[1] {
  return {
    boardId: 'board-1',
    id,
    patch,
    version,
    userId: 'peer-1',
    timestamp: 1000,
  } as Parameters<typeof applyDrawPatch>[1];
}

function createEvent(
  version: number,
  incoming: WhiteboardElement,
): Parameters<typeof applyElementCreate>[1] {
  return {
    boardId: 'board-1',
    element: incoming,
    userId: 'peer-1',
    timestamp: 1000,
    version,
  } as Parameters<typeof applyElementCreate>[1];
}

function deleteEvent(
  id: string,
  version: number,
): Parameters<typeof applyElementDelete>[1] {
  return {
    boardId: 'board-1',
    id,
    version,
    userId: 'peer-1',
    timestamp: 1000,
  } as Parameters<typeof applyElementDelete>[1];
}

describe('applyDrawPatch', () => {
  it('applies a patch when the event version matches the local version', () => {
    const elements = [element('a', 3)];
    const result = applyDrawPatch(elements, patchEvent('a', 3, { x: 50 }));
    expect(result.changed).toBe(true);
    expect(result.elements[0]).toMatchObject({
      id: 'a',
      x: 50,
      version: 3,
      lastModifiedBy: 'peer-1',
    });
  });

  it('applies a newer patch and adopts the event version and author', () => {
    const elements = [element('a', 1)];
    const result = applyDrawPatch(elements, patchEvent('a', 5, { width: 200 }));
    expect(result.elements[0]).toMatchObject({ width: 200, version: 5 });
  });

  it('rejects a stale patch from a lagging peer', () => {
    const elements = [element('a', 5)];
    const result = applyDrawPatch(elements, patchEvent('a', 2, { x: 999 }));
    expect(result.changed).toBe(false);
    expect(result.elements[0].x).toBe(0);
  });

  it('ignores structural keys in the patch', () => {
    const elements = [element('a', 1)];
    const result = applyDrawPatch(
      elements,
      patchEvent('a', 2, { id: 'b', type: 'ellipse', version: 99, x: 10 }),
    );
    expect(result.elements[0].id).toBe('a');
    expect(result.elements[0].type).toBe('rectangle');
    expect(result.elements[0].version).toBe(2);
    expect(result.elements[0].x).toBe(10);
  });

  it('reports no change when the element is missing', () => {
    const result = applyDrawPatch([element('a', 1)], patchEvent('b', 1, {}));
    expect(result.changed).toBe(false);
  });
});

describe('applyElementCreate', () => {
  it('adds a new element', () => {
    const incoming = element('b', 1);
    const result = applyElementCreate(
      [element('a', 1)],
      createEvent(1, incoming),
    );
    expect(result.changed).toBe(true);
    expect(result.elements).toHaveLength(2);
  });

  it('ignores an invalid element payload', () => {
    const incoming = {
      ...element('b', 1),
      x: 'oops',
    } as unknown as WhiteboardElement;
    const result = applyElementCreate([], createEvent(1, incoming));
    expect(result.changed).toBe(false);
  });

  it('replaces an element only when the incoming version is newer', () => {
    const existing = element('a', 4);
    const result = applyElementCreate(
      [existing],
      createEvent(3, element('a', 3)),
    );
    expect(result.changed).toBe(false);
    expect(result.elements[0].version).toBe(4);
  });
});

describe('applyElementDelete', () => {
  it('deletes the element when the event version is not older', () => {
    const result = applyElementDelete([element('a', 3)], deleteEvent('a', 3));
    expect(result.changed).toBe(true);
    expect(result.elements).toHaveLength(0);
  });

  it('ignores a delete whose version is older than the local edit', () => {
    const result = applyElementDelete([element('a', 5)], deleteEvent('a', 2));
    expect(result.changed).toBe(false);
    expect(result.elements).toHaveLength(1);
  });

  it('ignores a delete for a missing element', () => {
    const result = applyElementDelete([element('a', 1)], deleteEvent('b', 1));
    expect(result.changed).toBe(false);
  });
});
