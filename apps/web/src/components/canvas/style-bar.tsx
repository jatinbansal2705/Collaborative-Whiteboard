'use client';

import { useState } from 'react';
import { Paintbrush, X } from 'lucide-react';
import {
  DASH_STYLES,
  PALETTE,
  SHADOW_DEFAULTS,
  STROKE_WIDTHS,
} from '@/lib/canvas/constants';
import type { DashStyle, ElementStyle } from '@/lib/canvas/types';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/canvas-store';

function isFillable(type: string): boolean {
  return (
    type === 'rectangle' ||
    type === 'ellipse' ||
    type === 'triangle' ||
    type === 'diamond'
  );
}

function DashPreview({ dash }: { dash: DashStyle }) {
  const dasharray: Record<DashStyle, string> = {
    solid: '',
    dashed: '6 4',
    dotted: '0.5 4',
    'dash-dot': '6 4 0.5 4',
  };
  return (
    <svg viewBox="0 0 24 10" className="h-2.5 w-6" aria-hidden="true">
      <line
        x1="1"
        y1="5"
        x2="23"
        y2="5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={dasharray[dash]}
      />
    </svg>
  );
}

/** Stroke/fill style controls; edits the selection when present, else the style. */
export function StyleBar() {
  const style = useCanvasStore((state) => state.style);
  const elements = useCanvasStore((state) => state.elements);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const applyStyleToSelection = useCanvasStore(
    (state) => state.applyStyleToSelection,
  );
  const setStyle = useCanvasStore((state) => state.setStyle);
  const [strokeOpen, setStrokeOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);

  const selected = elements.find((element) => element.id === selectedIds[0]);
  const display: ElementStyle =
    selected !== undefined
      ? {
          strokeColor: selected.strokeColor,
          fillColor: selected.fillColor,
          strokeWidth: selected.strokeWidth,
          strokeStyle: selected.strokeStyle,
          opacity: selected.opacity,
          shadow: selected.shadow,
        }
      : style;

  const canFill = selected === undefined || isFillable(selected.type);
  const hasSelection = selectedIds.length > 0;

  function update(patch: Partial<ElementStyle>): void {
    const next = { ...display, ...patch };
    if (hasSelection) {
      applyStyleToSelection(next);
    } else {
      setStyle(patch);
    }
  }

  return (
    <div
      className="flex items-center gap-2 rounded-md border bg-background/90 px-2 py-1.5 shadow-md backdrop-blur"
      role="toolbar"
      aria-label="Element styles"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setStrokeOpen((open) => !open);
            setFillOpen(false);
          }}
          className="flex size-8 items-center justify-center rounded-md border bg-background outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Stroke color"
          aria-expanded={strokeOpen}
        >
          <span
            className="size-5 rounded-full border border-black/10"
            style={{ background: display.strokeColor }}
          />
        </button>
        {strokeOpen ? (
          <SwatchPalette
            colors={PALETTE}
            value={display.strokeColor}
            onPick={(color) => {
              update({ strokeColor: color ?? display.strokeColor });
              setStrokeOpen(false);
            }}
            onClose={() => setStrokeOpen(false)}
          />
        ) : null}
      </div>

      <label className="sr-only" htmlFor="stroke-width">
        Stroke width
      </label>
      <select
        id="stroke-width"
        value={display.strokeWidth}
        onChange={(event) =>
          update({ strokeWidth: Number(event.target.value) })
        }
        className="h-8 rounded-md border bg-transparent px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Stroke width"
      >
        {STROKE_WIDTHS.map((width) => (
          <option key={width} value={width}>
            {width}px
          </option>
        ))}
      </select>

      <div
        className="flex items-center rounded-md border p-0.5"
        role="group"
        aria-label="Stroke style"
      >
        {DASH_STYLES.map((dash) => (
          <button
            key={dash}
            type="button"
            onClick={() => update({ strokeStyle: dash })}
            aria-pressed={display.strokeStyle === dash}
            aria-label={dash}
            title={dash}
            className={cn(
              'flex size-7 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
              display.strokeStyle === dash
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/60',
            )}
          >
            <DashPreview dash={dash} />
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={display.opacity}
          onChange={(event) => update({ opacity: Number(event.target.value) })}
          aria-label="Opacity"
          className="h-4 w-16 accent-[#3b82f6]"
        />
        <span className="text-[10px] leading-none text-muted-foreground tabular-nums">
          {Math.round(display.opacity * 100)}%
        </span>
      </div>

      <button
        type="button"
        onClick={() =>
          update({ shadow: display.shadow === null ? SHADOW_DEFAULTS : null })
        }
        aria-pressed={display.shadow !== null}
        aria-label="Toggle shadow"
        title="Shadow"
        className={cn(
          'flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
          display.shadow !== null
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/60',
        )}
      >
        <Paintbrush className="size-4" aria-hidden="true" />
      </button>

      <div className="relative">
        <button
          type="button"
          disabled={!canFill}
          onClick={() => {
            setFillOpen((open) => !open);
            setStrokeOpen(false);
          }}
          className="flex size-7 items-center justify-center rounded-md border outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Fill color"
          aria-expanded={fillOpen}
        >
          {display.fillColor === null ? (
            <X className="size-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <span
              className="size-4 rounded-full border border-black/10"
              style={{ background: display.fillColor }}
            />
          )}
        </button>
        {fillOpen ? (
          <SwatchPalette
            colors={PALETTE}
            value={display.fillColor ?? ''}
            allowNone
            onPick={(color) => {
              update({ fillColor: color });
              setFillOpen(false);
            }}
            onClose={() => setFillOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

interface SwatchPaletteProps {
  colors: readonly string[];
  value: string;
  allowNone?: boolean;
  onPick: (color: string | null) => void;
  onClose: () => void;
}

function SwatchPalette({
  colors,
  value,
  allowNone = false,
  onPick,
  onClose,
}: SwatchPaletteProps) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute top-full left-0 z-50 mt-1 grid grid-cols-6 gap-1 rounded-md border bg-popover p-2 shadow-md">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onPick(color)}
            aria-label={color}
            title={color}
            className={cn(
              'size-6 rounded-full border border-black/10 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === color && 'ring-2 ring-ring ring-offset-1',
            )}
            style={{ background: color }}
          />
        ))}
        {allowNone ? (
          <button
            type="button"
            onClick={() => onPick(null)}
            aria-label="No fill"
            title="No fill"
            className={cn(
              'flex size-6 items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === '' && 'ring-2 ring-ring ring-offset-1',
            )}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </>
  );
}
