import { useEffect } from 'react';
import { runCommand } from '@/lib/canvas/commands';
import { isEditableTarget, matchShortcuts } from '@/lib/canvas/shortcuts';
import { useToolStore } from '@/stores/tool-store';

/**
 * Global keyboard shortcuts for the board editor. `runCommand` handles the
 * canvas commands; spacebar temporarily swaps to the hand tool for panning.
 */
export function useCanvasHotkeys(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (
        event.code === 'Space' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        useToolStore.getState().setTransientTool('hand');
        return;
      }
      const shortcut = matchShortcuts(event);
      if (shortcut === null) {
        return;
      }
      event.preventDefault();
      runCommand(shortcut.id);
    }

    function handleKeyUp(event: KeyboardEvent): void {
      if (event.code === 'Space') {
        useToolStore.getState().setTransientTool(null);
      }
    }

    function handleBlur(): void {
      useToolStore.getState().setTransientTool(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
}
