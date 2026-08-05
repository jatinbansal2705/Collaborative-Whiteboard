import { beforeEach, describe, expect, it } from 'vitest';
import {
  createEmptyWhiteboardDocument,
  type WhiteboardElement,
} from '@whiteboard/shared';
import { isQueuePersistent, offlineQueue } from '@/lib/autosave/offline-queue';

function makeDraft() {
  const document = createEmptyWhiteboardDocument();
  document.elements.push({
    id: 'e1',
    type: 'rectangle',
    version: 1,
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
    createdAt: 1,
    updatedAt: 1,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
  } as WhiteboardElement);
  return {
    document,
    baseRevision: 4,
    updatedAt: 1000,
  };
}

describe('offlineQueue', () => {
  beforeEach(async () => {
    for (const boardId of await offlineQueue.list()) {
      await offlineQueue.clear(boardId);
    }
  });

  it('stores and returns the latest draft for a board', async () => {
    const draft = makeDraft();
    await offlineQueue.set('b1', draft);

    const stored = await offlineQueue.get('b1');
    expect(stored).not.toBeNull();
    expect(stored?.boardId).toBe('b1');
    expect(stored?.baseRevision).toBe(4);
    expect(stored?.document.elements).toHaveLength(1);
  });

  it('keeps a single draft per board (latest wins)', async () => {
    await offlineQueue.set('b1', makeDraft());
    const newer = makeDraft();
    newer.updatedAt = 2000;
    newer.document.elements[0].version = 2;
    await offlineQueue.set('b1', newer);

    const stored = await offlineQueue.get('b1');
    expect(stored?.updatedAt).toBe(2000);
    expect(stored?.document.elements[0].version).toBe(2);
    expect(await offlineQueue.list()).toEqual(['b1']);
  });

  it('returns null for an unknown board', async () => {
    expect(await offlineQueue.get('missing')).toBeNull();
  });

  it('clears a draft', async () => {
    await offlineQueue.set('b1', makeDraft());
    await offlineQueue.clear('b1');
    expect(await offlineQueue.get('b1')).toBeNull();
    expect(await offlineQueue.list()).toEqual([]);
  });

  it('lists all boards with pending drafts', async () => {
    await offlineQueue.set('b1', makeDraft());
    await offlineQueue.set('b2', makeDraft());
    expect((await offlineQueue.list()).sort()).toEqual(['b1', 'b2']);
  });

  it('is not persistent under jsdom (memory fallback)', () => {
    expect(isQueuePersistent()).toBe(false);
  });
});
