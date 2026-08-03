import { create } from 'zustand';

export type ToastVariant = 'default' | 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** Duration in ms; 0 renders until dismissed. */
  duration: number;
  createdAt: number;
}

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  add: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const DEFAULT_DURATION_BY_VARIANT: Record<ToastVariant, number> = {
  default: 5_000,
  success: 4_000,
  error: 8_000,
  info: 5_000,
};

let toastCounter = 0;

function createToastId(): string {
  toastCounter += 1;
  return `toast-${Date.now()}-${toastCounter}`;
}

/** Pure toast store; auto-dismiss timers live in the `<Toaster/>` component. */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  add: (input) => {
    const variant = input.variant ?? 'default';
    const id = createToastId();
    const toast: Toast = {
      id,
      title: input.title,
      description: input.description,
      variant,
      duration: input.duration ?? DEFAULT_DURATION_BY_VARIANT[variant],
      createdAt: Date.now(),
    };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  dismissAll: () => set({ toasts: [] }),
}));

export const selectToasts = (state: ToastState): Toast[] => state.toasts;

/** Imperative helpers for non-component call sites (e.g. API layer, hooks). */
export const toast = {
  default: (title: string, description?: string): string =>
    useToastStore.getState().add({ title, description, variant: 'default' }),
  success: (title: string, description?: string): string =>
    useToastStore.getState().add({ title, description, variant: 'success' }),
  error: (title: string, description?: string): string =>
    useToastStore.getState().add({ title, description, variant: 'error' }),
  info: (title: string, description?: string): string =>
    useToastStore.getState().add({ title, description, variant: 'info' }),
  dismiss: (id: string): void => useToastStore.getState().dismiss(id),
  dismissAll: (): void => useToastStore.getState().dismissAll(),
};
