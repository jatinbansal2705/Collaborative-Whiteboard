import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({
  label = 'Loading…',
  className,
}: LoadingStateProps) {
  return (
    <div
      data-slot="loading-state"
      role="status"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border p-10 text-center',
        className,
      )}
    >
      <Loader2
        className="size-6 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
