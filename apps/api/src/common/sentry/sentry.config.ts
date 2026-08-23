import * as Sentry from '@sentry/node';

export interface SentryInitOptions {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

const DEFAULT_TRACES_SAMPLE_RATE = 0.2;

/**
 * Initialises Sentry for the API. No-ops (and reports `false`) when no DSN is
 * configured so local development and CI run without Sentry.
 */
export function initSentry(options: SentryInitOptions): boolean {
  const dsn = options.dsn?.trim();
  if (dsn === undefined || dsn.length === 0) {
    return false;
  }

  Sentry.init({
    dsn,
    environment: options.environment ?? 'development',
    release: options.release,
    tracesSampleRate: options.tracesSampleRate ?? DEFAULT_TRACES_SAMPLE_RATE,
  });

  return true;
}

/** True once `Sentry.init` has run with a DSN. */
export function isSentryEnabled(): boolean {
  return Sentry.getClient() !== undefined;
}
