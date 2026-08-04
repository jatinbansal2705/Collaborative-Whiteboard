import { create } from 'zustand';
import { clampZoom, fitToContent, panBy, zoomAt } from '@/lib/canvas/coords';
import type { WorldRect } from '@/lib/canvas/types';

interface CameraState {
  /** Zoom multiplier where 1 = 100%. */
  zoom: number;
  /** World coordinate at the viewport top-left corner. */
  offsetX: number;
  offsetY: number;
  viewportWidth: number;
  viewportHeight: number;
  setViewportSize: (width: number, height: number) => void;
  /** Zooms towards a screen point `(sx, sy)` in CSS pixels. */
  zoomTowards: (sx: number, sy: number, zoomFactor: number) => void;
  /** Sets an absolute zoom keeping the viewport centre fixed. */
  setZoomCentered: (zoom: number) => void;
  /** Pans by a screen-space delta in CSS pixels. */
  panByScreen: (dx: number, dy: number) => void;
  /** Directly sets the transform (used by fit/reset). */
  setTransform: (
    transform: Pick<CameraState, 'zoom' | 'offsetX' | 'offsetY'>,
  ) => void;
  resetView: () => void;
  fitToBounds: (bounds: WorldRect) => void;
}

const CENTER_ANCHOR = 0.5;

/** Camera/viewport transform store for the infinite canvas. */
export const useCameraStore = create<CameraState>()((set) => ({
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  setViewportSize: (viewportWidth, viewportHeight) =>
    set((state) =>
      state.viewportWidth === viewportWidth &&
      state.viewportHeight === viewportHeight
        ? state
        : { viewportWidth, viewportHeight },
    ),
  zoomTowards: (sx, sy, zoomFactor) =>
    set((state) => {
      const next = zoomAt(state, sx, sy, state.zoom * zoomFactor);
      return {
        zoom: next.zoom,
        offsetX: next.offsetX,
        offsetY: next.offsetY,
      };
    }),
  setZoomCentered: (zoom) =>
    set((state) => {
      const centerX =
        state.offsetX + (state.viewportWidth * CENTER_ANCHOR) / state.zoom;
      const centerY =
        state.offsetY + (state.viewportHeight * CENTER_ANCHOR) / state.zoom;
      const clamped = clampZoom(zoom);
      return {
        zoom: clamped,
        offsetX: centerX - (state.viewportWidth * CENTER_ANCHOR) / clamped,
        offsetY: centerY - (state.viewportHeight * CENTER_ANCHOR) / clamped,
      };
    }),
  panByScreen: (dx, dy) =>
    set((state) => {
      const next = panBy(state, dx, dy);
      return { offsetX: next.offsetX, offsetY: next.offsetY };
    }),
  setTransform: (transform) =>
    set({
      zoom: clampZoom(transform.zoom),
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
    }),
  resetView: () => set({ zoom: 1, offsetX: 0, offsetY: 0 }),
  fitToBounds: (bounds) =>
    set((state) => {
      const transform = fitToContent(state, bounds, 64);
      return {
        zoom: transform.zoom,
        offsetX: transform.offsetX,
        offsetY: transform.offsetY,
      };
    }),
}));

export const selectCamera = (state: CameraState): CameraState => state;
export const selectZoom = (state: CameraState): number => state.zoom;
