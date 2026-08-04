import { describe, expect, it } from 'vitest';
import { FIT_PADDING } from '@/lib/canvas/constants';
import {
  fitToContent,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from '@/lib/canvas/coords';
import type { ViewportTransform } from '@/lib/canvas/types';

const baseTransform: ViewportTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  viewportWidth: 1000,
  viewportHeight: 800,
};

describe('coords', () => {
  it('round-trips screen and world points', () => {
    const world = screenToWorld(baseTransform, 500, 400);
    expect(world).toEqual({ x: 500, y: 400 });
    expect(worldToScreen(baseTransform, world.x, world.y)).toEqual({
      x: 500,
      y: 400,
    });
  });

  it('accounts for offset and zoom in both directions', () => {
    const transform: ViewportTransform = {
      ...baseTransform,
      zoom: 2,
      offsetX: 100,
      offsetY: -50,
    };
    const world = screenToWorld(transform, 300, 200);
    expect(world.x).toBeCloseTo(250);
    expect(world.y).toBeCloseTo(50);
    const screen = worldToScreen(transform, world.x, world.y);
    expect(screen.x).toBeCloseTo(300);
    expect(screen.y).toBeCloseTo(200);
  });

  it('clamps zoom and keeps the anchor point fixed when zooming', () => {
    const transform: ViewportTransform = {
      ...baseTransform,
      zoom: 1,
      offsetX: 10,
      offsetY: 20,
    };
    const result = zoomAt(transform, 400, 300, 2);
    expect(result.zoom).toBe(2);
    const anchorBefore = screenToWorld(transform, 400, 300);
    const anchorAfter = screenToWorld(result, 400, 300);
    expect(anchorAfter.x).toBeCloseTo(anchorBefore.x);
    expect(anchorAfter.y).toBeCloseTo(anchorBefore.y);
  });

  it('never exceeds zoom limits', () => {
    expect(zoomAt(baseTransform, 0, 0, 100).zoom).toBeLessThanOrEqual(4);
    expect(zoomAt(baseTransform, 0, 0, 0.001).zoom).toBeGreaterThanOrEqual(0.1);
  });

  it('pans by a screen-space delta', () => {
    const transform: ViewportTransform = { ...baseTransform, zoom: 2 };
    const result = panBy(transform, 40, 80);
    expect(result.offsetX).toBe(-20);
    expect(result.offsetY).toBe(-40);
  });

  it('fits content within the viewport with padding', () => {
    const result = fitToContent(
      baseTransform,
      { x: 0, y: 0, width: 500, height: 400 },
      FIT_PADDING,
    );
    const maxZoom = Math.min(
      (1000 - FIT_PADDING * 2) / 500,
      (800 - FIT_PADDING * 2) / 400,
    );
    expect(result.zoom).toBeCloseTo(maxZoom);
    const centerX = result.offsetX + 1000 / result.zoom / 2;
    expect(centerX).toBeCloseTo(250);
  });
});
