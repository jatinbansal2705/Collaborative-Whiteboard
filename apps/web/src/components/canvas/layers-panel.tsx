'use client';

import { useState } from 'react';
import { Box, Eye, EyeOff, Layers, Lock, LockOpen, Shapes } from 'lucide-react';
import type { WhiteboardElement } from '@whiteboard/shared';
import { topmostFirst } from '@/lib/canvas/layers';
import { elementTypeLabel } from '@/lib/canvas/constants';
import {
  renameLayerCommand,
  setLayerHiddenCommand,
  setLayerLockedCommand,
} from '@/lib/canvas/commands';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvas-store';

function elementName(element: WhiteboardElement): string {
  return element.name ?? elementTypeLabel(element.type);
}

function ElementIcon({ element }: { element: WhiteboardElement }) {
  if (element.type === 'connector') {
    return <Shapes className="size-3.5" aria-hidden="true" />;
  }
  if (element.groupId !== null) {
    return <Box className="size-3.5" aria-hidden="true" />;
  }
  return <Layers className="size-3.5" aria-hidden="true" />;
}

/** Right-hand layer stack; z-order top-first, live from the elements array. */
export function LayersPanel() {
  const elements = useCanvasStore((state) => state.elements);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const selectOnly = useCanvasStore((state) => state.selectOnly);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const rows = topmostFirst(elements);

  function commitRename(): void {
    if (renamingId !== null) {
      renameLayerCommand(renamingId, draftName.trim());
    }
    setRenamingId(null);
  }

  return (
    <aside
      className="flex w-60 shrink-0 flex-col rounded-md border bg-background/95 shadow-md backdrop-blur"
      aria-label="Layers"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-xs font-semibold text-foreground">Layers</h2>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {rows.length}
        </span>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-1.5">
        {rows.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Nothing on the board yet
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {rows.map((element) => {
              const selected = selectedIds.includes(element.id);
              const renaming = renamingId === element.id;
              return (
                <li key={element.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`${elementName(element)} layer`}
                    className={cn(
                      'group flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50',
                    )}
                    onClick={() => selectOnly(element.id)}
                    onDoubleClick={() => {
                      setRenamingId(element.id);
                      setDraftName(elementName(element));
                    }}
                  >
                    <button
                      type="button"
                      aria-label={
                        element.hidden ? 'Show element' : 'Hide element'
                      }
                      title={element.hidden ? 'Show' : 'Hide'}
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        setLayerHiddenCommand(element.id, !element.hidden);
                      }}
                    >
                      {element.hidden ? (
                        <EyeOff className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="size-3.5" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={
                        element.locked ? 'Unlock element' : 'Lock element'
                      }
                      title={element.locked ? 'Unlock' : 'Lock'}
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                        element.locked && 'text-foreground',
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        setLayerLockedCommand(element.id, !element.locked);
                      }}
                    >
                      {element.locked ? (
                        <Lock className="size-3.5" aria-hidden="true" />
                      ) : (
                        <LockOpen className="size-3.5" aria-hidden="true" />
                      )}
                    </button>
                    <span
                      className="min-w-0 flex-1 truncate text-xs"
                      title={elementName(element)}
                    >
                      {renaming ? (
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              commitRename();
                            } else if (event.key === 'Escape') {
                              setRenamingId(null);
                            }
                          }}
                          onClick={(event) => event.stopPropagation()}
                          className="w-full rounded-sm border bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label="Element name"
                        />
                      ) : (
                        <span className="flex items-center gap-1 truncate">
                          <ElementIcon element={element} />
                          <span className="truncate">
                            {elementName(element)}
                          </span>
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
