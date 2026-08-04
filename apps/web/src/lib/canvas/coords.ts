import { MAX_ZOOM, MIN_ZOOM } from './constants';
import type { ViewportTransform, WorldRect } from './types';

export interface ScreenPoint {
  x: number;
  y: number;
}

/** World-space point at a given screen position. */
export function screenToWorld(
  transform: ViewportTransform,
  sx: number,
  sy: number,
): ScreenPoint {
  return {
    x: transform.offsetX + sx / transform.zoom,
    y: transform.offsetY + sy / transform.zoom,
  };
}

/** Screen-space position of a world point. */
export function worldToScreen(
  transform: ViewportTransform,
  wx: number,
  wy: number,
): ScreenPoint {
  return {
    x: (wx - transform.offsetX) * transform.zoom,
    y: (wy - transform.offsetY) * transform.zoom,
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Returns a transform where the world point under `(sx, sy)` stays fixed while
 * zoom changes to `nextZoom`.
 */
export function zoomAt(
  transform: ViewportTransform,
  sx: number,
  sy: number,
  nextZoom: number,
): ViewportTransform {
  const zoom = clampZoom(nextZoom);
  const worldX = transform.offsetX + sx / transform.zoom;
  const worldY = transform.offsetY + sy / transform.zoom;
  return {
    ...transform,
    zoom,
    offsetX: worldX - sx / zoom,
    offsetY: worldY - sy / zoom,
  };
}

/** Pans by a screen-space delta (positive = content moves right/down). */
export function panBy(
  transform: ViewportTransform,
  dx: number,
  dy: number,
): ViewportTransform {
  return {
    ...transform,
    offsetX: transform.offsetX - dx / transform.zoom,
    offsetY: transform.offsetY - dy / transform.zoom,
  };
}

/** The world-space rectangle currently visible in the viewport. */
export function getViewportWorldRect(transform: ViewportTransform): WorldRect {
  return {
    x: transform.offsetX,
    y: transform.offsetY,
    width: transform.viewportWidth / transform.zoom,
    height: transform.viewportHeight / transform.zoom,
  };
}

/**
 * Fits a world rectangle into the viewport with a screen-space padding,
 * preserving aspect and respecting zoom limits.
 */
export function fitToContent(
  transform: ViewportTransform,
  bounds: WorldRect,
  padding = 0,
): ViewportTransform {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return transform;
  }
  const availableWidth = Math.max(1, transform.viewportWidth - padding * 2);
  const availableHeight = Math.max(1, transform.viewportHeight - padding * 2);
  const zoom = clampZoom(
    Math.min(availableWidth / bounds.width, availableHeight / bounds.height),
  );
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return {
    ...transform,
    zoom,
    offsetX: centerX - transform.viewportWidth / 2 / zoom,
    offsetY: centerY - transform.viewportHeight / 2 / zoom,
  };
}
