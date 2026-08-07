'use client';

import { memo, useRef, useState } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
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

const LAYER_ROW_HEIGHT = 36;

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

interface LayerRowData {
  rows: WhiteboardElement[];
  selectedIds: string[];
  renamingId: string | null;
  draftName: string;
  onSelect: (id: string) => void;
  onStartRename: (id: string, name: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDraftChange: (value: string) => void;
}

const LayerRow = memo(function LayerRow({
  index,
  style,
  data,
}: ListChildComponentProps<LayerRowData>) {
  const element = data.rows[index];
  const selected = data.selectedIds.includes(element.id);
  const renaming = data.renamingId === element.id;

  return (
    <div style={style} className="py-0.5">
      <div
        role="button"
        tabIndex={0}
        aria-label={`${elementName(element)} layer`}
        aria-pressed={selected}
        className={cn(
          'group flex h-8 cursor-pointer items-center gap-1 rounded px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
        )}
        onClick={() => data.onSelect(element.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            data.onSelect(element.id);
          }
        }}
        onDoubleClick={() =>
          data.onStartRename(element.id, elementName(element))
        }
      >
        <button
          type="button"
          aria-label={element.hidden ? 'Show element' : 'Hide element'}
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
          aria-label={element.locked ? 'Unlock element' : 'Lock element'}
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
              value={data.draftName}
              onChange={(event) => data.onDraftChange(event.target.value)}
              onBlur={data.onCommitRename}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  data.onCommitRename();
                } else if (event.key === 'Escape') {
                  data.onCancelRename();
                }
              }}
              onClick={(event) => event.stopPropagation()}
              className="w-full rounded-sm border bg-background px-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Element name"
            />
          ) : (
            <span className="flex items-center gap-1 truncate">
              <ElementIcon element={element} />
              <span className="truncate">{elementName(element)}</span>
            </span>
          )}
        </span>
      </div>
    </div>
  );
});

/** Right-hand layer stack; z-order top-first, virtualized for large boards. */
export function LayersPanel() {
  const elements = useCanvasStore((state) => state.elements);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const selectOnly = useCanvasStore((state) => state.selectOnly);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const skipCommitRef = useRef(false);

  const rows = topmostFirst(elements);

  function commitRename(): void {
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      setRenamingId(null);
      return;
    }
    if (renamingId !== null) {
      renameLayerCommand(renamingId, draftName.trim());
    }
    setRenamingId(null);
  }

  function cancelRename(): void {
    skipCommitRef.current = true;
    setRenamingId(null);
    setDraftName('');
  }

  return (
    <aside
      className="flex w-full flex-col rounded-md border bg-background/95 shadow-md backdrop-blur sm:w-60"
      aria-label="Layers"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-xs font-semibold text-foreground">Layers</h2>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {rows.length}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        {rows.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Nothing on the board yet
          </p>
        ) : (
          <FixedSizeList<LayerRowData>
            height="100%"
            width="100%"
            itemCount={rows.length}
            itemSize={LAYER_ROW_HEIGHT}
            overscanCount={8}
            itemData={{
              rows,
              selectedIds,
              renamingId,
              draftName,
              onSelect: selectOnly,
              onStartRename: (id, name) => {
                setRenamingId(id);
                setDraftName(name);
              },
              onCommitRename: commitRename,
              onCancelRename: cancelRename,
              onDraftChange: setDraftName,
            }}
          >
            {LayerRow}
          </FixedSizeList>
        )}
      </div>
    </aside>
  );
}
