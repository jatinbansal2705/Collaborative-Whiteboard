/**
 * Curated icon + emoji sets for the icon/emoji insertion tools (Phase 11).
 * Icons are raw 24x24 stroke SVG markup rendered as data URLs; emojis render
 * directly as Konva text glyphs.
 */

export const EMOJI_GLYPHS: readonly string[] = [
  '😀',
  '😄',
  '😊',
  '🙂',
  '🤔',
  '😎',
  '😍',
  '🥳',
  '😴',
  '👍',
  '👎',
  '👏',
  '🙌',
  '👀',
  '💡',
  '❤️',
  '⭐',
  '🔥',
  '⚡',
  '✅',
  '❌',
  '⚠️',
  '❓',
  '❗',
  '🚀',
  '📌',
  '📝',
  '📅',
  '⏰',
  '🔗',
  '🔒',
  '🔓',
  '🎯',
  '🎨',
  '🧩',
  '💰',
  '🏆',
  '🌱',
  '🌍',
  '🌈',
  '☀️',
  '🌧️',
  '⛅',
  '🍕',
  '☕',
  '🎉',
  '🎁',
  '📦',
  '🗑️',
  '🔧',
];

/** Inner SVG markup per icon (24x24 viewBox, currentColor stroke). */
export const ICON_GLYPHS: Record<string, string> = {
  star: '<path d="M11.53 2.29a.5.5 0 0 1 .94 0l2.3 4.68a.5.5 0 0 0 .38.27l5.14.75a.5.5 0 0 1 .28.85l-3.72 3.63a.5.5 0 0 0-.14.44l.88 5.13a.5.5 0 0 1-.72.53l-4.6-2.42a.5.5 0 0 0-.46 0l-4.6 2.42a.5.5 0 0 1-.72-.53l.88-5.13a.5.5 0 0 0-.14-.44L2.85 8.84a.5.5 0 0 1 .28-.85l5.14-.75a.5.5 0 0 0 .38-.27z"/>',
  heart:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.41l8.7 8.7a2.42 2.42 0 0 0 3.42 0l6.58-6.58a2.42 2.42 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="0.5" fill="currentColor"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
  circle: '<circle cx="12" cy="12" r="10"/>',
  square: '<rect x="3" y="3" width="18" height="18" rx="2"/>',
  triangle:
    '<path d="M13.73 4a2 2 0 0 0-3.46 0L3 17.73A2 2 0 0 0 4.73 20h14.54A2 2 0 0 0 20.73 17.73z"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-left': '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  calendar:
    '<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>',
  clock:
    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  smile:
    '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  home: '<path d="m3 10.5 9-7.5 9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  pin: '<line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-2.2a5 5 0 0 0-3-4.6V5a2 2 0 0 0-4 0v5.2a5 5 0 0 0-3 4.6Z"/>',
  'thumbs-up':
    '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  'message-circle': '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
};

/** ViewBox is fixed to 24x24; builds an SVG data URL for a named icon. */
export function iconDataUrl(name: string): string {
  const inner = ICON_GLYPHS[name] ?? ICON_GLYPHS.star;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function isKnownIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICON_GLYPHS, name);
}

export function isKnownEmoji(glyph: string): boolean {
  return EMOJI_GLYPHS.includes(glyph);
}
