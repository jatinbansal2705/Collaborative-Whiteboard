const RELATIVE_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
});

const ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/** `Mar 3` / `Mar 3, 2025` (no year when it matches the current one). */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const formatter =
    date.getFullYear() === new Date().getFullYear()
      ? RELATIVE_DATE_FORMATTER
      : ABSOLUTE_DATE_FORMATTER;
  return formatter.format(date);
}

/** Humanized "time since" label for board cards; `nowMs` is injectable for tests. */
export function formatRelativeTime(iso: string, nowMs = Date.now()): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) {
    return '';
  }
  const elapsedMs = nowMs - time;
  if (elapsedMs < 0) {
    return formatShortDate(iso);
  }
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 60) {
    return 'just now';
  }
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}m ago`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}h ago`;
  }
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `${elapsedDays}d ago`;
  }
  return formatShortDate(iso);
}
