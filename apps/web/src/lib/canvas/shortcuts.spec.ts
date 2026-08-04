import { describe, expect, it } from 'vitest';
import {
  getShortcut,
  isEditableTarget,
  matchShortcut,
  matchShortcuts,
  SHORTCUTS,
} from '@/lib/canvas/shortcuts';

function keyEvent(
  code: string,
  options: Partial<KeyboardEvent> = {},
): KeyboardEvent {
  return {
    code,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...options,
  } as unknown as KeyboardEvent;
}

describe('shortcuts', () => {
  it('exposes a lookup by id', () => {
    expect(getShortcut('edit:undo')).toBeDefined();
    expect(getShortcut('missing:thing')).toBeUndefined();
  });

  it('defines at least one tool per canvas tool id', () => {
    for (const shortcut of SHORTCUTS) {
      expect(shortcut.id).toBeTruthy();
      expect(shortcut.label).toBeTruthy();
      expect(shortcut.display).toBeTruthy();
    }
  });

  it('matches plain tool shortcuts without modifiers', () => {
    const select = getShortcut('tool:select');
    expect(select).toBeDefined();
    expect(matchShortcut(keyEvent('KeyV'), select!)).toBe(true);
    expect(matchShortcut(keyEvent('KeyV', { ctrlKey: true }), select!)).toBe(
      false,
    );
  });

  it('requires the modifier for edit shortcuts', () => {
    const undo = getShortcut('edit:undo');
    expect(undo).toBeDefined();
    expect(matchShortcut(keyEvent('KeyZ', { ctrlKey: true }), undo!)).toBe(
      true,
    );
    expect(matchShortcut(keyEvent('KeyZ', { metaKey: true }), undo!)).toBe(
      true,
    );
    expect(matchShortcut(keyEvent('KeyZ'), undo!)).toBe(false);
    expect(
      matchShortcut(keyEvent('KeyZ', { ctrlKey: true, shiftKey: true }), undo!),
    ).toBe(false);
  });

  it('distinguishes undo from redo via shift', () => {
    const redo = getShortcut('edit:redo');
    expect(redo).toBeDefined();
    expect(
      matchShortcut(keyEvent('KeyZ', { ctrlKey: true, shiftKey: true }), redo!),
    ).toBe(true);
  });

  it('resolves the first matching shortcut for an event', () => {
    const matched = matchShortcuts(keyEvent('KeyP'));
    expect(matched?.id).toBe('tool:pen');
    expect(matchShortcuts(keyEvent('KeyZ'))).toBeNull();
  });

  it('detects editable targets for input suppression', () => {
    const input = document.createElement('input');
    expect(isEditableTarget(input)).toBe(true);
    const button = document.createElement('button');
    expect(isEditableTarget(button)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
