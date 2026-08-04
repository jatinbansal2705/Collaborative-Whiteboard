'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SHORTCUTS, type ShortcutCategory } from '@/lib/canvas/shortcuts';

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  tools: 'Tools',
  edit: 'Editing',
  view: 'View',
};

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Reference for the available keyboard shortcuts, grouped by category. */
export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const categories: ShortcutCategory[] = ['tools', 'edit', 'view'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Work faster while drawing. Press Shift+/ anytime to reopen this
            list.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {categories.map((category) => (
            <section key={category} className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {CATEGORY_LABELS[category]}
              </h3>
              <ul className="space-y-1.5">
                {SHORTCUTS.filter(
                  (shortcut) => shortcut.category === category,
                ).map((shortcut) => (
                  <li
                    key={shortcut.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">
                      {shortcut.label}
                    </span>
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {shortcut.display}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
