'use client';

import { useCallback } from 'react';
import {
  selectToasts,
  useToastStore,
  type Toast,
  type ToastInput,
} from '@/stores/toast-store';

export interface UseToastResult {
  toasts: Toast[];
  add: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

/** Read-only view of the toast store plus stable, bound actions. */
export function useToast(): UseToastResult {
  const toasts = useToastStore(selectToasts);

  const add = useCallback(
    (input: ToastInput): string => useToastStore.getState().add(input),
    [],
  );
  const dismiss = useCallback(
    (id: string): void => useToastStore.getState().dismiss(id),
    [],
  );
  const dismissAll = useCallback(
    (): void => useToastStore.getState().dismissAll(),
    [],
  );

  return { toasts, add, dismiss, dismissAll };
}
