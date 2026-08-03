import { beforeEach, describe, expect, it } from 'vitest';
import { selectToasts, toast, useToastStore } from '@/stores/toast-store';

beforeEach(() => {
  useToastStore.getState().dismissAll();
});

describe('toast store', () => {
  it('add returns a unique id and appends a toast', () => {
    const id = useToastStore.getState().add({ title: 'Hello' });

    const toasts = selectToasts(useToastStore.getState());
    expect(id).toBeTruthy();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ id, title: 'Hello', variant: 'default' });
  });

  it('applies the default duration by variant', () => {
    const state = useToastStore.getState();
    state.add({ title: 'a', variant: 'default' });
    state.add({ title: 'b', variant: 'success' });
    state.add({ title: 'c', variant: 'error' });
    state.add({ title: 'd', variant: 'info' });

    const toasts = selectToasts(useToastStore.getState());
    expect(toasts[0].duration).toBe(5_000);
    expect(toasts[1].duration).toBe(4_000);
    expect(toasts[2].duration).toBe(8_000);
    expect(toasts[3].duration).toBe(5_000);
  });

  it('honours an explicit duration override', () => {
    const id = useToastStore.getState().add({ title: 'sticky', duration: 0 });

    const toasts = selectToasts(useToastStore.getState());
    expect(toasts[0].id).toBe(id);
    expect(toasts[0].duration).toBe(0);
  });

  it('dismiss removes only the targeted toast', () => {
    const first = useToastStore.getState().add({ title: 'one' });
    const second = useToastStore.getState().add({ title: 'two' });

    useToastStore.getState().dismiss(first);

    const toasts = selectToasts(useToastStore.getState());
    expect(toasts.map((t) => t.id)).toEqual([second]);
  });

  it('dismissAll clears every toast', () => {
    useToastStore.getState().add({ title: 'one' });
    useToastStore.getState().add({ title: 'two' });

    useToastStore.getState().dismissAll();

    expect(selectToasts(useToastStore.getState())).toEqual([]);
  });

  it('imperative helper queues toasts with the right variant', () => {
    toast.success('Saved', 'Board updated');
    toast.error('Failed');

    const toasts = selectToasts(useToastStore.getState());
    expect(toasts[0].variant).toBe('success');
    expect(toasts[0].description).toBe('Board updated');
    expect(toasts[1].variant).toBe('error');
  });
});
