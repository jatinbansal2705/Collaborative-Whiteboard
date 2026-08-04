import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectCanvasCanRedo,
  selectCanvasCanUndo,
  useCanvasHistoryStore,
} from '@/stores/canvas-history-store';
import type { WhiteboardElement } from '@whiteboard/shared';

function element(id: string): WhiteboardElement {
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
    strokeColor: '#000000',
    fillColor: null,
    strokeWidth: 2,
    strokeStyle: 'solid',
    shadow: null,
    lastModifiedBy: null,
    createdAt: 0,
    updatedAt: 0,
    name: null,
    groupId: null,
    locked: false,
    hidden: false,
  };
}

function resetStore(): void {
  useCanvasHistoryStore.setState({ past: [], future: [], maxEntries: 100 });
}

beforeEach(() => {
  resetStore();
});

describe('canvas history store', () => {
  it('starts with no undo/redo', () => {
    const state = useCanvasHistoryStore.getState();
    expect(selectCanvasCanUndo(state)).toBe(false);
    expect(selectCanvasCanRedo(state)).toBe(false);
  });

  it('push records a pre-mutation snapshot and clears redo', () => {
    useCanvasHistoryStore.getState().push([element('a')]);
    useCanvasHistoryStore.getState().push([element('a'), element('b')]);
    useCanvasHistoryStore.getState().undo();
    expect(selectCanvasCanRedo(useCanvasHistoryStore.getState())).toBe(true);

    useCanvasHistoryStore.getState().push([element('c')]);
    const state = useCanvasHistoryStore.getState();
    expect(selectCanvasCanRedo(state)).toBe(false);
    expect(state.past).toHaveLength(2);
    expect(state.past[1]?.[0]?.id).toBe('c');
  });

  it('undo returns the most recent snapshot and enables redo', () => {
    const before = [element('a')];
    const after = [element('a'), element('b')];
    useCanvasHistoryStore.getState().push(before);
    useCanvasHistoryStore.getState().push(after);

    const restored = useCanvasHistoryStore.getState().undo();
    expect(restored).toEqual(after);
    expect(selectCanvasCanRedo(useCanvasHistoryStore.getState())).toBe(true);
  });

  it('undo returns null when the past is empty', () => {
    expect(useCanvasHistoryStore.getState().undo()).toBeNull();
  });

  it('redo restores a snapshot that was undone', () => {
    useCanvasHistoryStore.getState().push([element('a')]);
    useCanvasHistoryStore.getState().undo();

    const restored = useCanvasHistoryStore.getState().redo();
    expect(restored?.[0]?.id).toBe('a');
    expect(selectCanvasCanUndo(useCanvasHistoryStore.getState())).toBe(true);
  });

  it('redo returns null when the future is empty', () => {
    expect(useCanvasHistoryStore.getState().redo()).toBeNull();
  });

  it('caps the past at maxEntries', () => {
    useCanvasHistoryStore.setState({ maxEntries: 3 });
    for (let i = 0; i < 5; i += 1) {
      useCanvasHistoryStore.getState().push([element(`e${i}`)]);
    }
    expect(useCanvasHistoryStore.getState().past).toHaveLength(3);
  });

  it('reset clears both stacks', () => {
    useCanvasHistoryStore.getState().push([element('a')]);
    useCanvasHistoryStore.getState().push([element('b')]);
    useCanvasHistoryStore.getState().undo();

    useCanvasHistoryStore.getState().reset();
    const state = useCanvasHistoryStore.getState();
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });
});
