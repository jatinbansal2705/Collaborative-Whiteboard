'use client';

import { ErrorState } from '@/components/state/error-state';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <ErrorState
        title="Something went wrong"
        description={error.message || 'An unexpected error occurred.'}
        onRetry={reset}
        className="w-full max-w-md"
      />
    </div>
  );
}
