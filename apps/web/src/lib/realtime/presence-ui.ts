/** Stable per-user colour palette for presence cursors and avatars. */
const PRESENCE_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#84cc16',
] as const;

/** Stable colour derived from a user id (used for cursors and highlights). */
export function userColor(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length] as string;
}

/** Up to two uppercase initials for avatar fallbacks. */
export function userInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0]?.charAt(0) ?? '';
  const last =
    parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}
