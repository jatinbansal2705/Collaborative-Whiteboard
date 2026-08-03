import { beforeEach, describe, expect, it } from 'vitest';
import {
  selectCanRedo,
  selectCanUndo,
  selectPresentEntry,
  useHistoryStore,
} from '@/stores/history-store';

function entry(id: string) {
  return { id, data: { id }, createdAt: Date.now() };
}

function resetStore(): void {
  useHistoryStore.setState({
    past: [],
    present: null,
    future: [],
    maxEntries: 100,
  });
}

beforeEach(() => {
  resetStore();
});

describe('history store', () => {
  it('starts empty with no undo/redo', () => {
    const state = useHistoryStore.getState();
    expect(selectPresentEntry(state)).toBeNull();
    expect(selectCanUndo(state)).toBe(false);
    expect(selectCanRedo(state)).toBe(false);
  });

  it('push moves the previous present into the past', () => {
    useHistoryStore.getState().push(entry('e1'));
    useHistoryStore.getState().push(entry('e2'));

    const state = useHistoryStore.getState();
    expect(selectPresentEntry(state)?.id).toBe('e2');
    expect(state.past.map((e) => e.id)).toEqual(['e1']);
  });

  it('push clears the future stack', () => {
    useHistoryStore.getState().push(entry('e1'));
    useHistoryStore.getState().push(entry('e2'));
    useHistoryStore.getState().undo();
    expect(selectCanRedo(useHistoryStore.getState())).toBe(true);

    useHistoryStore.getState().push(entry('e3'));
    expect(selectCanRedo(useHistoryStore.getState())).toBe(false);
    expect(selectPresentEntry(useHistoryStore.getState())?.id).toBe('e3');
  });

  it('undo returns the previous entry and pushes present into future', () => {
    useHistoryStore.getState().push(entry('e1'));
    useHistoryStore.getState().push(entry('e2'));

    const previous = useHistoryStore.getState().undo();

    const state = useHistoryStore.getState();
    expect(previous?.id).toBe('e1');
    expect(selectPresentEntry(state)?.id).toBe('e1');
    expect(state.future.map((e) => e.id)).toEqual(['e2']);
  });

  it('undo with an empty past returns null and leaves state unchanged', () => {
    expect(useHistoryStore.getState().undo()).toBeNull();

    const state = useHistoryStore.getState();
    expect(selectPresentEntry(state)).toBeNull();
    expect(selectCanUndo(state)).toBe(false);
  });

  it('redo returns the next entry and restores the past', () => {
    useHistoryStore.getState().push(entry('e1'));
    useHistoryStore.getState().push(entry('e2'));
    useHistoryStore.getState().undo();

    const next = useHistoryStore.getState().redo();

    const state = useHistoryStore.getState();
    expect(next?.id).toBe('e2');
    expect(selectPresentEntry(state)?.id).toBe('e2');
    expect(state.past.map((e) => e.id)).toEqual(['e1']);
  });

  it('redo with an empty future returns null', () => {
    useHistoryStore.getState().push(entry('e1'));

    expect(useHistoryStore.getState().redo()).toBeNull();
  });

  it('trims the past to maxEntries', () => {
    useHistoryStore.setState({ maxEntries: 3 });

    for (const id of ['e1', 'e2', 'e3', 'e4', 'e5']) {
      useHistoryStore.getState().push(entry(id));
    }

    const state = useHistoryStore.getState();
    expect(state.past.map((e) => e.id)).toEqual(['e2', 'e3', 'e4']);
    expect(selectPresentEntry(state)?.id).toBe('e5');
  });

  it('reset clears all stacks', () => {
    useHistoryStore.getState().push(entry('e1'));
    useHistoryStore.getState().push(entry('e2'));

    useHistoryStore.getState().reset();

    const state = useHistoryStore.getState();
    expect(state.past).toEqual([]);
    expect(selectPresentEntry(state)).toBeNull();
    expect(state.future).toEqual([]);
  });
});
