'use client';

import {
  Circle,
  Diamond,
  Eraser,
  Hand,
  Highlighter,
  Image,
  Minus,
  MousePointer2,
  Pen,
  Pencil,
  Shapes,
  Smile,
  Spline,
  Square,
  StickyNote,
  Triangle,
  Type,
  MoveUpRight,
  Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getShortcut } from '@/lib/canvas/shortcuts';
import type { ToolId } from '@/lib/canvas/types';
import { useToolStore } from '@/stores/tool-store';

interface ToolDefinition {
  id: ToolId;
  label: string;
  icon: LucideIcon;
}

const TOOL_GROUPS: readonly (readonly ToolDefinition[])[] = [
  [
    { id: 'select', label: 'Select', icon: MousePointer2 },
    { id: 'hand', label: 'Hand', icon: Hand },
    { id: 'eraser', label: 'Eraser', icon: Eraser },
  ],
  [
    { id: 'pen', label: 'Pen', icon: Pen },
    { id: 'pencil', label: 'Pencil', icon: Pencil },
    { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  ],
  [
    { id: 'rectangle', label: 'Rectangle', icon: Square },
    { id: 'ellipse', label: 'Ellipse', icon: Circle },
    { id: 'triangle', label: 'Triangle', icon: Triangle },
    { id: 'diamond', label: 'Diamond', icon: Diamond },
  ],
  [
    { id: 'arrow', label: 'Arrow', icon: MoveUpRight },
    { id: 'line', label: 'Line', icon: Minus },
    { id: 'bezier', label: 'Bezier', icon: Spline },
  ],
  [
    { id: 'text', label: 'Text', icon: Type },
    { id: 'sticky', label: 'Sticky note', icon: StickyNote },
    { id: 'connector', label: 'Connector', icon: Waypoints },
  ],
  [
    { id: 'image', label: 'Image', icon: Image },
    { id: 'icon', label: 'Icon', icon: Shapes },
    { id: 'emoji', label: 'Emoji', icon: Smile },
  ],
];

function toolShortcut(tool: ToolId): string | undefined {
  return getShortcut(`tool:${tool}`)?.display;
}

/** Vertical tool palette docked to the left of the canvas. */
export function CanvasToolbar() {
  const activeTool = useToolStore((state) => state.activeTool);
  const setTool = useToolStore((state) => state.setTool);

  return (
    <div
      className="flex flex-col items-center gap-1 rounded-md border bg-background/90 p-1 shadow-md backdrop-blur"
      role="toolbar"
      aria-label="Drawing tools"
    >
      {TOOL_GROUPS.map((group, groupIndex) => (
        <div key={groupIndex} className="flex flex-col items-center gap-1">
          {groupIndex > 0 ? (
            <div className="my-0.5 h-px w-6 bg-border" />
          ) : null}
          {group.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setTool(tool.id)}
                aria-pressed={active}
                aria-label={`${tool.label} tool`}
                title={`${tool.label}${toolShortcut(tool.id) ? ` (${toolShortcut(tool.id)})` : ''}`}
                className={cn(
                  'flex size-8 items-center justify-center rounded-md outline-none transition-colors',
                  'focus-visible:ring-ring focus-visible:ring-2',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
