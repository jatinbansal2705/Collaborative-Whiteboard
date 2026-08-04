import type { DashStyle, ElementShadow } from '@whiteboard/shared';

export type { DashStyle, ElementShadow };

/** Element-creating tools that store freehand point streams. */
export type FreehandToolId = 'pen' | 'pencil' | 'highlighter';

/** Element-creating tools (excludes selection, navigation and eraser). */
export type DrawToolId = Exclude<ToolId, 'select' | 'hand' | 'eraser'>;

/** Box-style tools (shapes + linear elements). */
export type ShapeToolId = Exclude<DrawToolId, FreehandToolId | 'bezier'>;

/** Tool rail identifiers (element-creating tools map 1:1 to element types). */
export type ToolId =
  | 'select'
  | 'hand'
  | 'pen'
  | 'pencil'
  | 'highlighter'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'arrow'
  | 'line'
  | 'bezier'
  | 'eraser';

export const DRAWING_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  'pen',
  'pencil',
  'highlighter',
  'rectangle',
  'ellipse',
  'triangle',
  'diamond',
  'arrow',
  'line',
  'bezier',
]);

/** Per-tool styling used when creating new elements and applying to selection. */
export interface ElementStyle {
  strokeColor: string;
  fillColor: string | null;
  strokeWidth: number;
  strokeStyle: DashStyle;
  opacity: number;
  shadow: ElementShadow | null;
}

/** Camera transform: `offsetX/offsetY` is the world point at the screen origin. */
export interface ViewportTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
  viewportWidth: number;
  viewportHeight: number;
}

/** Axis-aligned world rectangle. */
export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/** Smart-alignment guide result for a drag. */
export interface GuideLines {
  dx: number;
  dy: number;
  /** World-space x positions of vertical guides. */
  linesX: number[];
  /** World-space y positions of horizontal guides. */
  linesY: number[];
}

export const NO_GUIDES: GuideLines = { dx: 0, dy: 0, linesX: [], linesY: [] };
