import type { DashStyle, ElementShadow } from '@whiteboard/shared';
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
