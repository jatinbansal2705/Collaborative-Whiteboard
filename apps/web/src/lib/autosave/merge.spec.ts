import { describe, expect, it } from 'vitest';
import {
  createEmptyWhiteboardDocument,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { documentsEqual, mergeDocuments } from '@/lib/autosave/merge';

function makeElement(
  id: string,
  version: number,
  overrides: Partial<WhiteboardElement> = {},
): WhiteboardElement {
  const now = Date.now();
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
    createdAt: now,
    updatedAt: now,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
    ...overrides,
  } as WhiteboardElement;
}

describe('mergeDocuments', () => {
  it('keeps the higher-version copy of a shared element', () => {
    const local = createEmptyWhiteboardDocument();
    local.elements.push(makeElement('a', 3, { x: 100 }));
    const authoritative = createEmptyWhiteboardDocument();
    authoritative.elements.push(makeElement('a', 2, { x: 5 }));

    const merged = mergeDocuments(local, authoritative);
    expect(merged.elements).toHaveLength(1);
    expect(merged.elements[0].x).toBe(100);
  });

  it('prefers the authoritative copy on a version tie', () => {
    const local = createEmptyWhiteboardDocument();
    local.elements.push(makeElement('a', 2, { x: 100 }));
    const authoritative = createEmptyWhiteboardDocument();
    authoritative.elements.push(makeElement('a', 2, { x: 5 }));

    const merged = mergeDocuments(local, authoritative);
    expect(merged.elements[0].x).toBe(5);
  });

  it('keeps local-only elements and appends them last', () => {
    const local = createEmptyWhiteboardDocument();
    local.elements.push(makeElement('local', 0));
    const authoritative = createEmptyWhiteboardDocument();
    authoritative.elements.push(makeElement('server', 5));

    const merged = mergeDocuments(local, authoritative);
    expect(merged.elements.map((element) => element.id)).toEqual([
      'server',
      'local',
    ]);
  });

  it('uses the authoritative schema version', () => {
    const local = {
      schemaVersion: 1 as const,
      elements: [] as WhiteboardElement[],
    };
    const authoritative = {
      schemaVersion: 1 as const,
      elements: [] as WhiteboardElement[],
    };
    expect(mergeDocuments(local, authoritative).schemaVersion).toBe(1);
  });
});

describe('documentsEqual', () => {
  it('reports equal documents', () => {
    const first = createEmptyWhiteboardDocument();
    first.elements.push(makeElement('a', 1));
    const second = createEmptyWhiteboardDocument();
    second.elements.push(makeElement('a', 1));
    expect(documentsEqual(first, second)).toBe(true);
  });

  it('is order-sensitive', () => {
    const first = createEmptyWhiteboardDocument();
    first.elements.push(makeElement('a', 1), makeElement('b', 1));
    const second = createEmptyWhiteboardDocument();
    second.elements.push(makeElement('b', 1), makeElement('a', 1));
    expect(documentsEqual(first, second)).toBe(false);
  });

  it('detects length mismatch', () => {
    const first = createEmptyWhiteboardDocument();
    first.elements.push(makeElement('a', 1));
    const second = createEmptyWhiteboardDocument();
    expect(documentsEqual(first, second)).toBe(false);
  });

  it('detects a changed element', () => {
    const first = createEmptyWhiteboardDocument();
    first.elements.push(makeElement('a', 1, { x: 5 }));
    const second = createEmptyWhiteboardDocument();
    second.elements.push(makeElement('a', 1, { x: 6 }));
    expect(documentsEqual(first, second)).toBe(false);
  });
});
