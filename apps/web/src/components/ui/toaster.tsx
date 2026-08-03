'use client';

import * as ToastPrimitives from '@radix-ui/react-toast';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useToastStore, type ToastVariant } from '@/stores/toast-store';

const ACCENT_BY_VARIANT: Record<ToastVariant, string> = {
  default: '',
  success: 'border-l-4 border-l-success',
  error: 'border-l-4 border-l-destructive',
  info: 'border-l-4 border-l-info',
};

const ICON_BY_VARIANT: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
};

const ICON_CLASS_BY_VARIANT: Record<ToastVariant, string> = {
  default: 'text-muted-foreground',
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-info',
};

interface ToastCardProps {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

function ToastCard({
  id,
  title,
  description,
  variant,
  duration,
}: ToastCardProps) {
  const dismiss = useToastStore((state) => state.dismiss);
  const Icon = ICON_BY_VARIANT[variant];

  return (
    <ToastPrimitives.Root
      duration={duration === 0 ? Number.POSITIVE_INFINITY : duration}
      onOpenChange={(open) => {
        if (!open) {
          dismiss(id);
        }
      }}
      className={cn(
        'pointer-events-auto relative flex w-full items-start gap-3 rounded-lg border bg-popover p-4 text-popover-foreground shadow-lg',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-4 sm:data-[state=open]:slide-in-from-right-4',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-4 sm:data-[state=closed]:slide-out-to-right-4',
        'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:animate-in',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        ACCENT_BY_VARIANT[variant],
      )}
    >
      <Icon
        className={cn('mt-0.5 size-4 shrink-0', ICON_CLASS_BY_VARIANT[variant])}
        aria-hidden="true"
      />
      <div className="flex-1 space-y-1">
        <ToastPrimitives.Title className="text-sm font-medium">
          {title}
        </ToastPrimitives.Title>
        {description ? (
          <ToastPrimitives.Description className="text-sm text-muted-foreground">
            {description}
          </ToastPrimitives.Description>
        ) : null}
      </div>
      <ToastPrimitives.Close
        aria-label="Dismiss notification"
        className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <X className="size-4" />
      </ToastPrimitives.Close>
    </ToastPrimitives.Root>
  );
}

/**
 * Renders toasts from the shared toast store. Auto-dismiss is delegated to
 * Radix (via `duration`); close button and swipe both call `dismiss`.
 */
export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastPrimitives.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          id={toast.id}
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
          duration={toast.duration}
        />
      ))}
      <ToastPrimitives.Viewport className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 outline-none sm:max-w-[420px]" />
    </ToastPrimitives.Provider>
  );
}
