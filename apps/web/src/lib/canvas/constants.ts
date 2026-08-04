import type {
  DashStyle,
  ElementShadow,
  WhiteboardElement,
} from '@whiteboard/shared';
import type { ElementStyle } from './types';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
/** Multiplicative zoom step for wheel/buttons. */
export const ZOOM_STEP = 1.1;
/** World-units padding added around content when fitting the view. */
export const FIT_PADDING = 64;
/** Grid size in world units. */
export const GRID_SIZE = 16;
/** Alignment-guide snap tolerance in world units. */
export const GUIDE_TOLERANCE = 6;
/** Session undo/redo history cap. */
export const HISTORY_LIMIT = 100;
export const MIN_ELEMENT_SIZE = 4;
/** Angle snap step (degrees) while rotating with Shift held. */
export const ROTATE_SNAP_STEP = 15;
/** Screen-pixel offset of the rotate handle above the selection box. */
export const ROTATE_HANDLE_OFFSET = 28;
/** Screen-pixel size of selection resize handles. */
export const RESIZE_HANDLE_SIZE = 9;
/** Extra hit-test padding in world units. */
export const HIT_PADDING = 6;
export const MAX_POINTS = 2048;
/** Minimum world distance between freehand samples. */
export const POINT_SAMPLE_DISTANCE = 2;
/** Double-click window used to finish the bezier tool. */
export const DOUBLE_CLICK_MS = 400;

export const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8, 12] as const;
export const DASH_STYLES: DashStyle[] = [
  'solid',
  'dashed',
  'dotted',
  'dash-dot',
];

export const PALETTE = [
  '#0f172a',
  '#64748b',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#78716c',
  '#f8fafc',
] as const;

export const SHADOW_DEFAULTS: ElementShadow = {
  color: 'rgba(0, 0, 0, 0.3)',
  blur: 12,
  offsetX: 4,
  offsetY: 4,
};

export const DEFAULT_STYLE: ElementStyle = {
  strokeColor: '#0f172a',
  fillColor: null,
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 1,
  shadow: null,
};

/** Theme-aware canvas chrome colors. */
export const CANVAS_COLORS = {
  background: { light: '#ffffff', dark: '#09090b' },
  grid: { light: '#e4e4e7', dark: '#27272a' },
  gridSnap: { light: '#d4d4d8', dark: '#3f3f46' },
} as const;

export const SELECTION_COLOR = '#3b82f6';
export const GUIDE_COLOR = '#ec4899';
export const HANDLE_COLOR = '#ffffff';
export const HANDLE_BORDER_COLOR = '#3b82f6';
export const MINIMAP_BACKGROUND = 'rgba(0, 0, 0, 0.05)';
export const MINIMAP_DARK_BACKGROUND = 'rgba(255, 255, 255, 0.08)';
/** CSS-pixel size of the minimap widget. */
export const MINIMAP_SIZE = { width: 180, height: 120 } as const;
/** CSS-pixel padding inside the minimap. */
export const MINIMAP_PADDING = 8;

export const FREEHAND_MIN_WIDTH = 1.5;
export const FREEHAND_MAX_WIDTH = 8;

/** Background palette for sticky notes. */
export const STICKY_COLORS = [
  '#fef08a',
  '#fde047',
  '#fdba74',
  '#fca5a5',
  '#f9a8d4',
  '#d8b4fe',
  '#a5b4fc',
  '#93c5fd',
  '#a7f3d0',
  '#f8fafc',
] as const;
export const STICKY_COLOR_DEFAULT = STICKY_COLORS[0];
export const STICKY_TEXT_COLOR = '#1f2937';
/** Default note size when created with the sticky tool. */
export const STICKY_SIZE = { width: 160, height: 160 } as const;
export const STICKY_PADDING = 14;
export const STICKY_MIN_WIDTH = 80;
export const STICKY_MIN_HEIGHT = 80;
export const STICKY_LINE_HEIGHT = 1.35;

/** Fonts offered by the text formatting bar (mirrors the shared contract). */
export const FONT_FAMILIES = [
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Courier New',
  'Comic Sans MS',
  'Verdana',
] as const;
export const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48] as const;
export const TEXT_DEFAULT_FONT_SIZE = 16;
export const TEXT_DEFAULT_COLOR = '#1f2937';
export const TEXT_LINE_HEIGHT = 1.2;
export const TEXT_MIN_WIDTH = 24;
export const TEXT_MIN_HEIGHT = 24;

/** Default size for a new text element before the user edits it. */
export const TEXT_SIZE = { width: 200, height: 40 } as const;
/** Default size for an inserted image before the user resizes it. */
export const IMAGE_SIZE = { width: 240, height: 180 } as const;
/** Icon/emoji default rendered size. */
export const ICON_DEFAULT_SIZE = 48;

/** Link colour used when rendering hyperlinks in Konva. */
export const LINK_COLOR = '#2563eb';

/** Connection routing: minimum ortho segment before the arrow tip. */
export const CONNECTOR_MIN_BEND = 16;

export const IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const IMAGE_ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** Renders an element name fallback for the layers panel. */
export function elementTypeLabel(type: WhiteboardElement['type']): string {
  return type.replace('-', ' ');
}
