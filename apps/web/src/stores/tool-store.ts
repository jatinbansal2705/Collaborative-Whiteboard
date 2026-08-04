import { create } from 'zustand';
import type { ToolId } from '@/lib/canvas/types';

interface ToolState {
  activeTool: ToolId;
  /**
   * Tool swapped in while a modifier is held (spacebar/middle-drag pan).
   * Resolved by `selectEffectiveTool`.
   */
  transientTool: ToolId | null;
  setTool: (tool: ToolId) => void;
  setTransientTool: (tool: ToolId | null) => void;
  reset: () => void;
}

/** Active canvas tool + transient modifier state. */
export const useToolStore = create<ToolState>()((set) => ({
  activeTool: 'select',
  transientTool: null,
  setTool: (tool) => set({ activeTool: tool, transientTool: null }),
  setTransientTool: (transientTool) => set({ transientTool }),
  reset: () => set({ activeTool: 'select', transientTool: null }),
}));

export const selectActiveTool = (state: ToolState): ToolId => state.activeTool;

/** Tool in effect, accounting for held modifier pan. */
export function selectEffectiveTool(state: ToolState): ToolId {
  return state.transientTool ?? state.activeTool;
}
