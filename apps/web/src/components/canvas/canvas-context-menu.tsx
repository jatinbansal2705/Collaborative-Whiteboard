'use client';

import { useEffect, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Boxes,
  BringToFront,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Lock,
  MoveHorizontal,
  MoveVertical,
  SendToBack,
  Trash2,
  Ungroup,
} from 'lucide-react';
import {
  alignSelectionCommand,
  bringForwardCommand,
  bringToFrontCommand,
  copyCommand,
  deleteCommand,
  distributeSelectionCommand,
  duplicateCommand,
  groupSelectionCommand,
  pasteCommand,
  sendBackwardCommand,
  sendToBackCommand,
  toggleLockCommand,
  ungroupSelectionCommand,
} from '@/lib/canvas/commands';
import { cn } from '@/lib/utils';

interface CanvasContextMenuProps {
  position: { x: number; y: number } | null;
  onClose: () => void;
}

interface MenuItemDef {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
}

/** Right-click menu for selection-level operations. */
export function CanvasContextMenu({
  position,
  onClose,
}: CanvasContextMenuProps) {
  const [submenu, setSubmenu] = useState<'align' | 'distribute' | null>(null);

  useEffect(() => {
    setSubmenu(null);
  }, [position]);

  useEffect(() => {
    if (position === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [position, onClose]);

  if (position === null) {
    return null;
  }

  function run(action: () => void): void {
    action();
    onClose();
  }

  const alignItems: MenuItemDef[] = [
    {
      label: 'Align left',
      icon: <AlignStartVertical className="size-3.5" aria-hidden="true" />,
      action: () => run(() => alignSelectionCommand('left')),
    },
    {
      label: 'Align center horizontally',
      icon: <AlignCenterVertical className="size-3.5" aria-hidden="true" />,
      action: () => run(() => alignSelectionCommand('center')),
    },
    {
      label: 'Align right',
      icon: <AlignEndVertical className="size-3.5" aria-hidden="true" />,
      action: () => run(() => alignSelectionCommand('right')),
    },
    {
      label: 'Align top',
      icon: <AlignStartHorizontal className="size-3.5" aria-hidden="true" />,
      action: () => run(() => alignSelectionCommand('top')),
    },
    {
      label: 'Align middle',
      icon: <AlignCenterHorizontal className="size-3.5" aria-hidden="true" />,
      action: () => run(() => alignSelectionCommand('middle')),
    },
    {
      label: 'Align bottom',
      icon: <AlignEndHorizontal className="size-3.5" aria-hidden="true" />,
      action: () => run(() => alignSelectionCommand('bottom')),
    },
  ];

  const distributeItems: MenuItemDef[] = [
    {
      label: 'Distribute horizontally',
      icon: <MoveHorizontal className="size-3.5" aria-hidden="true" />,
      action: () => run(() => distributeSelectionCommand('horizontal')),
    },
    {
      label: 'Distribute vertically',
      icon: <MoveVertical className="size-3.5" aria-hidden="true" />,
      action: () => run(() => distributeSelectionCommand('vertical')),
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onPointerDown={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed z-50 w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        style={{ left: position.x, top: position.y }}
        role="menu"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <MenuItem
          label="Copy"
          icon={<Copy className="size-3.5" aria-hidden="true" />}
          action={() => void run(() => void copyCommand())}
        />
        <MenuItem
          label="Paste"
          icon={<ClipboardPaste className="size-3.5" aria-hidden="true" />}
          action={() => void run(() => void pasteCommand())}
        />
        <MenuItem
          label="Duplicate"
          icon={<CopyPlus className="size-3.5" aria-hidden="true" />}
          action={() => run(duplicateCommand)}
        />
        <MenuItem
          label="Delete"
          icon={<Trash2 className="size-3.5" aria-hidden="true" />}
          action={() => run(deleteCommand)}
        />
        <div className="my-1 h-px bg-border" />
        <MenuItem
          label="Group"
          icon={<Boxes className="size-3.5" aria-hidden="true" />}
          action={() => run(groupSelectionCommand)}
        />
        <MenuItem
          label="Ungroup"
          icon={<Ungroup className="size-3.5" aria-hidden="true" />}
          action={() => run(ungroupSelectionCommand)}
        />
        <div className="my-1 h-px bg-border" />
        <MenuItem
          label="Bring to front"
          icon={<BringToFront className="size-3.5" aria-hidden="true" />}
          action={() => run(bringToFrontCommand)}
        />
        <MenuItem
          label="Bring forward"
          icon={<ArrowUpToLine className="size-3.5" aria-hidden="true" />}
          action={() => run(bringForwardCommand)}
        />
        <MenuItem
          label="Send backward"
          icon={<ArrowDownToLine className="size-3.5" aria-hidden="true" />}
          action={() => run(sendBackwardCommand)}
        />
        <MenuItem
          label="Send to back"
          icon={<SendToBack className="size-3.5" aria-hidden="true" />}
          action={() => run(sendToBackCommand)}
        />
        <div className="my-1 h-px bg-border" />
        <MenuItem
          label={submenu === 'align' ? 'Align…' : 'Align'}
          action={() => setSubmenu(submenu === 'align' ? null : 'align')}
          submenu
        />
        {submenu === 'align' ? <SubmenuList items={alignItems} /> : null}
        <MenuItem
          label={submenu === 'distribute' ? 'Distribute…' : 'Distribute'}
          action={() =>
            setSubmenu(submenu === 'distribute' ? null : 'distribute')
          }
          submenu
        />
        {submenu === 'distribute' ? (
          <SubmenuList items={distributeItems} />
        ) : null}
        <div className="my-1 h-px bg-border" />
        <MenuItem
          label="Lock / Unlock"
          icon={<Lock className="size-3.5" aria-hidden="true" />}
          action={() => run(toggleLockCommand)}
        />
      </div>
    </>
  );
}

function SubmenuList({ items }: { items: readonly MenuItemDef[] }) {
  return (
    <div className="ml-4 flex flex-col border-l border-border pl-1">
      {items.map((item) => (
        <MenuItem key={item.label} {...item} />
      ))}
    </div>
  );
}

function MenuItem({
  label,
  icon,
  action,
  submenu = false,
}: MenuItemDef & { submenu?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => {
        event.stopPropagation();
        action();
      }}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs outline-none transition-colors',
        'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
        submenu && 'justify-between',
      )}
    >
      {icon ?? <span className="size-3.5" aria-hidden="true" />}
      <span className="flex-1 truncate">{label}</span>
    </button>
  );
}
