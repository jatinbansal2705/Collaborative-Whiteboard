import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn !== undefined && dsn.trim().length > 0) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    ),
  });
}

function parseSampleRate(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return 0.2;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0.2 : parsed;
}
