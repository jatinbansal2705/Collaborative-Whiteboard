import { create } from 'zustand';
import { DEFAULT_STYLE } from '@/lib/canvas/constants';
import type { ElementStyle, GuideLines, WorldRect } from '@/lib/canvas/types';
import type { WhiteboardElement } from '@whiteboard/shared';

/** In-progress pointer interaction rendered as a live preview. */
export interface DraftState {
  kind: 'draw' | 'select';
  /** Live preview of the element being drawn (not yet in the document). */
  element?: WhiteboardElement;
  /** Rubber-band selection rectangle in world coordinates. */
  rect?: WorldRect;
}

interface CanvasState {
  elements: WhiteboardElement[];
  selectedIds: string[];
  draft: DraftState | null;
  /** Smart-alignment guide lines to render while moving. */
  guides: GuideLines | null;
  gridVisible: boolean;
  snapEnabled: boolean;
  minimapVisible: boolean;
  style: ElementStyle;
  setElements: (elements: WhiteboardElement[]) => void;
  addElements: (elements: WhiteboardElement[]) => void;
  setDraft: (draft: DraftState | null) => void;
  setGuides: (guides: GuideLines | null) => void;
  setSelectedIds: (ids: string[]) => void;
  selectOnly: (id: string) => void;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  deleteSelected: () => void;
  toggleGrid: () => void;
  setSnapEnabled: (enabled: boolean) => void;
  toggleMinimap: () => void;
  setStyle: (patch: Partial<ElementStyle>) => void;
  applyStyleToSelection: (style: ElementStyle) => void;
  reset: () => void;
}

function bumpVersion(
  element: WhiteboardElement,
  ownerId: string | null,
): WhiteboardElement {
  return {
    ...element,
    version: element.version + 1,
    updatedAt: Date.now(),
    lastModifiedBy: ownerId,
  };
}

/** Local canvas document: elements, selection, draft + view/editing flags. */
export const useCanvasStore = create<CanvasState>()((set) => ({
  elements: [],
  selectedIds: [],
  draft: null,
  guides: null,
  gridVisible: true,
  snapEnabled: true,
  minimapVisible: true,
  style: DEFAULT_STYLE,
  setElements: (elements) => set({ elements }),
  addElements: (elements) =>
    set((state) => ({ elements: [...state.elements, ...elements] })),
  setDraft: (draft) => set({ draft }),
  setGuides: (guides) => set({ guides }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  selectOnly: (id) => set({ selectedIds: [id] }),
  toggleSelection: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((entry) => entry !== id)
        : [...state.selectedIds, id],
    })),
  selectAll: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),
  deleteSelected: () =>
    set((state) => {
      if (state.selectedIds.length === 0) {
        return state;
      }
      const removed = new Set(state.selectedIds);
      return {
        elements: state.elements.filter((element) => !removed.has(element.id)),
        selectedIds: [],
        draft: null,
      };
    }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
  setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
  toggleMinimap: () =>
    set((state) => ({ minimapVisible: !state.minimapVisible })),
  setStyle: (patch) =>
    set((state) => ({ style: { ...state.style, ...patch } })),
  applyStyleToSelection: (style) =>
    set((state) => {
      if (state.selectedIds.length === 0) {
        return { style };
      }
      const selected = new Set(state.selectedIds);
      const changed = state.elements.map((element) => {
        if (!selected.has(element.id)) {
          return element;
        }
        const fillable =
          element.type === 'rectangle' ||
          element.type === 'ellipse' ||
          element.type === 'triangle' ||
          element.type === 'diamond';
        const next = {
          ...element,
          ...style,
          ...(fillable ? {} : { fillColor: null }),
        };
        return bumpVersion(next, null);
      });
      return { elements: changed, style };
    }),
  reset: () =>
    set({
      elements: [],
      selectedIds: [],
      draft: null,
      guides: null,
      gridVisible: true,
      snapEnabled: true,
      minimapVisible: true,
      style: DEFAULT_STYLE,
    }),
}));

export const selectElements = (state: CanvasState): WhiteboardElement[] =>
  state.elements;
export const selectSelectedIds = (state: CanvasState): string[] =>
  state.selectedIds;
export const selectDraft = (state: CanvasState): DraftState | null =>
  state.draft;
export const selectGuides = (state: CanvasState): GuideLines | null =>
  state.guides;
export const selectGridVisible = (state: CanvasState): boolean =>
  state.gridVisible;
export const selectSnapEnabled = (state: CanvasState): boolean =>
  state.snapEnabled;
export const selectStyle = (state: CanvasState): ElementStyle => state.style;
