export type ShortcutCategory = 'tools' | 'edit' | 'view';

export interface ShortcutDef {
  /** Stable command id dispatched by the hotkey handler. */
  id: string;
  label: string;
  category: ShortcutCategory;
  /** Display string for the help modal (e.g. "Ctrl/Cmd+Z"). */
  display: string;
  /** Requires Ctrl or Cmd (or both). */
  mod?: boolean;
  /** When set, the Shift key must (or must not) be held. */
  shift?: boolean;
  /** `event.code` the shortcut reacts to. */
  code: string;
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  {
    id: 'edit:redo',
    label: 'Redo',
    category: 'edit',
    mod: true,
    shift: true,
    code: 'KeyZ',
    display: 'Ctrl/Cmd+Shift+Z',
  },
  {
    id: 'edit:redo-alt',
    label: 'Redo (alternate)',
    category: 'edit',
    mod: true,
    code: 'KeyY',
    display: 'Ctrl/Cmd+Y',
  },
  {
    id: 'edit:undo',
    label: 'Undo',
    category: 'edit',
    mod: true,
    shift: false,
    code: 'KeyZ',
    display: 'Ctrl/Cmd+Z',
  },
  {
    id: 'edit:copy',
    label: 'Copy',
    category: 'edit',
    mod: true,
    code: 'KeyC',
    display: 'Ctrl/Cmd+C',
  },
  {
    id: 'edit:paste',
    label: 'Paste',
    category: 'edit',
    mod: true,
    code: 'KeyV',
    display: 'Ctrl/Cmd+V',
  },
  {
    id: 'edit:duplicate',
    label: 'Duplicate',
    category: 'edit',
    mod: true,
    code: 'KeyD',
    display: 'Ctrl/Cmd+D',
  },
  {
    id: 'edit:delete',
    label: 'Delete',
    category: 'edit',
    code: 'Delete',
    display: 'Del',
  },
  {
    id: 'edit:delete-backspace',
    label: 'Delete (backspace)',
    category: 'edit',
    code: 'Backspace',
    display: 'Backspace',
  },
  {
    id: 'edit:select-all',
    label: 'Select all',
    category: 'edit',
    mod: true,
    code: 'KeyA',
    display: 'Ctrl/Cmd+A',
  },
  {
    id: 'view:zoom-in',
    label: 'Zoom in',
    category: 'view',
    mod: true,
    code: 'Equal',
    display: 'Ctrl/Cmd+=',
  },
  {
    id: 'view:zoom-out',
    label: 'Zoom out',
    category: 'view',
    mod: true,
    code: 'Minus',
    display: 'Ctrl/Cmd+-',
  },
  {
    id: 'view:zoom-reset',
    label: 'Reset zoom',
    category: 'view',
    mod: true,
    code: 'Digit0',
    display: 'Ctrl/Cmd+0',
  },
  {
    id: 'view:fit',
    label: 'Fit to content',
    category: 'view',
    shift: true,
    code: 'Digit1',
    display: 'Shift+1',
  },
  {
    id: 'view:toggle-grid',
    label: 'Toggle grid',
    category: 'view',
    mod: true,
    shift: false,
    code: 'KeyG',
    display: 'Ctrl/Cmd+G',
  },
  {
    id: 'view:toggle-snap',
    label: 'Toggle snap',
    category: 'view',
    mod: true,
    shift: true,
    code: 'KeyG',
    display: 'Ctrl/Cmd+Shift+G',
  },
  {
    id: 'view:toggle-minimap',
    label: 'Toggle minimap',
    category: 'view',
    mod: true,
    code: 'KeyM',
    display: 'Ctrl/Cmd+M',
  },
  {
    id: 'help',
    label: 'Keyboard shortcuts',
    category: 'view',
    shift: true,
    code: 'Slash',
    display: 'Shift+/',
  },
  {
    id: 'tool:select',
    label: 'Select',
    category: 'tools',
    code: 'KeyV',
    display: 'V',
  },
  {
    id: 'tool:hand',
    label: 'Hand',
    category: 'tools',
    code: 'KeyH',
    display: 'H',
  },
  {
    id: 'tool:pen',
    label: 'Pen',
    category: 'tools',
    code: 'KeyP',
    display: 'P',
  },
  {
    id: 'tool:pencil',
    label: 'Pencil',
    category: 'tools',
    code: 'KeyN',
    display: 'N',
  },
  {
    id: 'tool:highlighter',
    label: 'Highlighter',
    category: 'tools',
    code: 'KeyI',
    display: 'I',
  },
  {
    id: 'tool:rectangle',
    label: 'Rectangle',
    category: 'tools',
    code: 'KeyR',
    display: 'R',
  },
  {
    id: 'tool:ellipse',
    label: 'Ellipse',
    category: 'tools',
    code: 'KeyO',
    display: 'O',
  },
  {
    id: 'tool:triangle',
    label: 'Triangle',
    category: 'tools',
    code: 'KeyT',
    display: 'T',
  },
  {
    id: 'tool:diamond',
    label: 'Diamond',
    category: 'tools',
    code: 'KeyD',
    display: 'D',
  },
  {
    id: 'tool:arrow',
    label: 'Arrow',
    category: 'tools',
    code: 'KeyA',
    display: 'A',
  },
  {
    id: 'tool:line',
    label: 'Line',
    category: 'tools',
    code: 'KeyL',
    display: 'L',
  },
  {
    id: 'tool:bezier',
    label: 'Bezier',
    category: 'tools',
    code: 'KeyB',
    display: 'B',
  },
  {
    id: 'tool:eraser',
    label: 'Eraser',
    category: 'tools',
    code: 'KeyE',
    display: 'E',
  },
];

const SHORTCUT_BY_ID = new Map<string, ShortcutDef>(
  SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]),
);

export function getShortcut(id: string): ShortcutDef | undefined {
  return SHORTCUT_BY_ID.get(id);
}

/** Matches a keyboard event against a shortcut definition. */
export function matchShortcut(
  event: KeyboardEvent,
  shortcut: ShortcutDef,
): boolean {
  const mod = event.ctrlKey || event.metaKey;
  if (shortcut.mod === true && !mod) {
    return false;
  }
  if (shortcut.mod !== true && mod) {
    return false;
  }
  if (shortcut.shift === true && !event.shiftKey) {
    return false;
  }
  if (shortcut.shift === false && event.shiftKey) {
    return false;
  }
  return event.code === shortcut.code;
}

/** Returns the first shortcut whose definition matches the event, if any. */
export function matchShortcuts(event: KeyboardEvent): ShortcutDef | null {
  for (const shortcut of SHORTCUTS) {
    if (matchShortcut(event, shortcut)) {
      return shortcut;
    }
  }
  return null;
}

/** True when the event targets a text input (shortcuts should not fire). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable === true
  );
}
