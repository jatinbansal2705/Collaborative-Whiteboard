import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM } from '@/lib/canvas/constants';
import { useCameraStore } from '@/stores/camera-store';
import type { WorldRect } from '@/lib/canvas/types';

function resetCamera(): void {
  useCameraStore.setState({
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    viewportWidth: 1000,
    viewportHeight: 800,
  });
}

beforeEach(() => {
  resetCamera();
});

describe('camera store', () => {
  it('tracks the viewport size once', () => {
    useCameraStore.getState().setViewportSize(1200, 900);
    const state = useCameraStore.getState();
    expect(state.viewportWidth).toBe(1200);
    expect(state.viewportHeight).toBe(900);
  });

  it('zooms towards a screen point without moving it', () => {
    useCameraStore.getState().zoomTowards(500, 400, 2);
    const camera = useCameraStore.getState();
    const worldX = camera.offsetX + 500 / camera.zoom;
    const worldY = camera.offsetY + 400 / camera.zoom;
    expect(worldX).toBeCloseTo(500);
    expect(worldY).toBeCloseTo(400);
    expect(camera.zoom).toBeCloseTo(2);
  });

  it('clamps zoom between min and max', () => {
    useCameraStore.getState().zoomTowards(0, 0, 0.001);
    expect(useCameraStore.getState().zoom).toBe(MIN_ZOOM);
    useCameraStore.getState().zoomTowards(0, 0, 10000);
    expect(useCameraStore.getState().zoom).toBe(MAX_ZOOM);
  });

  it('pans by a screen-space delta', () => {
    useCameraStore.getState().panByScreen(50, 25);
    const camera = useCameraStore.getState();
    expect(camera.offsetX).toBe(-50);
    expect(camera.offsetY).toBe(-25);
  });

  it('resets to 100% zoom at the origin', () => {
    useCameraStore
      .getState()
      .setTransform({ zoom: 2, offsetX: 100, offsetY: 100 });
    useCameraStore.getState().resetView();
    const camera = useCameraStore.getState();
    expect(camera.zoom).toBe(1);
    expect(camera.offsetX).toBe(0);
    expect(camera.offsetY).toBe(0);
  });

  it('fits to bounds keeping them inside the viewport', () => {
    const bounds: WorldRect = { x: 0, y: 0, width: 500, height: 400 };
    useCameraStore.getState().fitToBounds(bounds);
    const camera = useCameraStore.getState();
    const zoom = camera.zoom;
    const rightEdge = camera.offsetX + 500;
    const bottomEdge = camera.offsetY + 400;
    expect(rightEdge * zoom).toBeLessThanOrEqual(camera.viewportWidth - 8);
    expect(bottomEdge * zoom).toBeLessThanOrEqual(camera.viewportHeight - 8);
  });
});
