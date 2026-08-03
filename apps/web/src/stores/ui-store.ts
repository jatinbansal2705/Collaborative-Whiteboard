import { create } from 'zustand';

interface UiState {
  /** Persistent navigation/sidebar rail. */
  sidebarOpen: boolean;
  /** Global command palette (open via Ctrl/Cmd+K). */
  commandPaletteOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
}

/** Transient UI flags (theme preference lives in next-themes + localStorage). */
export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  commandPaletteOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
}));

export const selectSidebarOpen = (state: UiState): boolean => state.sidebarOpen;
export const selectCommandPaletteOpen = (state: UiState): boolean =>
  state.commandPaletteOpen;
