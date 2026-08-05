'use client';

import { CloudOff, Loader2 } from 'lucide-react';
import {
  selectAutosaveError,
  selectAutosaveStatus,
  useAutosaveStore,
  type AutosaveStatus,
} from '@/stores/autosave-store';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<
  AutosaveStatus,
  { label: string; dotClass: string }
> = {
  idle: { label: 'Not saved', dotClass: 'bg-muted-foreground' },
  dirty: { label: 'Unsaved changes', dotClass: 'bg-amber-500' },
  saving: { label: 'Saving…', dotClass: 'bg-amber-500' },
  saved: { label: 'All changes saved', dotClass: 'bg-emerald-500' },
  offline: { label: 'Offline — changes queued', dotClass: 'bg-red-500' },
  error: { label: 'Save failed', dotClass: 'bg-red-500' },
};

/** Autosave status indicator shown in the board header (ADR-0005). */
export function SaveStatus() {
  const status = useAutosaveStore(selectAutosaveStatus);
  const error = useAutosaveStore(selectAutosaveError);
  const config = STATUS_CONFIG[status];

  return (
    <div
      className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"
      title={status === 'error' && error !== null ? error : config.label}
      aria-live="polite"
    >
      {status === 'saving' ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : status === 'offline' ? (
        <CloudOff className="size-3.5" aria-hidden="true" />
      ) : (
        <span
          className={cn('size-1.5 rounded-full', config.dotClass)}
          aria-hidden="true"
        />
      )}
      <span>{config.label}</span>
    </div>
  );
}
