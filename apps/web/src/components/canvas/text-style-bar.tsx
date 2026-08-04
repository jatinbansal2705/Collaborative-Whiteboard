'use client';

import { useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from 'lucide-react';
import { FONT_FAMILIES, FONT_SIZES, PALETTE } from '@/lib/canvas/constants';
import { applyTextStyleCommand } from '@/lib/canvas/commands';
import { useCanvasStore } from '@/stores/canvas-store';
import { cn } from '@/lib/utils';

function ToggleButton({
  pressed,
  label,
  children,
  onToggle,
}: {
  pressed: boolean;
  label: string;
  children: React.ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={cn(
        'flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pressed
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/60',
      )}
    >
      {children}
    </button>
  );
}

/** Font controls for the single selected text/sticky element. */
export function TextStyleBar() {
  const elements = useCanvasStore((state) => state.elements);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const [colorOpen, setColorOpen] = useState(false);

  const target = elements.find((element) => element.id === selectedIds[0]);
  if (
    target === undefined ||
    (target.type !== 'text' && target.type !== 'sticky')
  ) {
    return null;
  }

  const id = target.id;
  const isText = target.type === 'text';
  const anyBold =
    isText &&
    target.paragraphs.some((p) => p.runs.some((r) => r.bold === true));
  const anyItalic =
    isText &&
    target.paragraphs.some((p) => p.runs.some((r) => r.italic === true));
  const anyUnderline =
    isText &&
    target.paragraphs.some((p) => p.runs.some((r) => r.underline === true));

  function toggleStyle(
    key: 'bold' | 'italic' | 'underline',
    current: boolean,
  ): void {
    applyTextStyleCommand(id, { [key]: !current });
  }

  return (
    <div
      className="flex items-center gap-1 rounded-md border bg-background/90 px-2 py-1.5 shadow-md backdrop-blur"
      role="toolbar"
      aria-label="Text styles"
    >
      {isText ? (
        <select
          value={target.fontFamily}
          onChange={(event) =>
            applyTextStyleCommand(id, { fontFamily: event.target.value })
          }
          className="h-8 max-w-28 rounded-md border bg-transparent px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Font family"
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      ) : null}

      <select
        value={target.fontSize}
        onChange={(event) =>
          applyTextStyleCommand(id, { fontSize: Number(event.target.value) })
        }
        className="h-8 rounded-md border bg-transparent px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Font size"
      >
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>

      {isText ? (
        <>
          <div className="relative">
            <button
              type="button"
              onClick={() => setColorOpen((open) => !open)}
              className="flex size-7 items-center justify-center rounded-md border bg-background outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Text color"
              aria-expanded={colorOpen}
            >
              <span
                className="size-4 rounded-full border border-black/10"
                style={{ background: target.color }}
              />
            </button>
            {colorOpen ? (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setColorOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute top-full left-0 z-50 mt-1 grid grid-cols-6 gap-1 rounded-md border bg-popover p-2 shadow-md">
                  {PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        applyTextStyleCommand(id, { color });
                        setColorOpen(false);
                      }}
                      aria-label={color}
                      title={color}
                      className={cn(
                        'size-6 rounded-full border border-black/10 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        target.color === color &&
                          'ring-2 ring-ring ring-offset-1',
                      )}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div
            className="flex items-center rounded-md border p-0.5"
            role="group"
            aria-label="Bold, italic, underline"
          >
            <ToggleButton
              pressed={anyBold}
              label="Bold"
              onToggle={() => toggleStyle('bold', anyBold)}
            >
              <Bold className="size-3.5" aria-hidden="true" />
            </ToggleButton>
            <ToggleButton
              pressed={anyItalic}
              label="Italic"
              onToggle={() => toggleStyle('italic', anyItalic)}
            >
              <Italic className="size-3.5" aria-hidden="true" />
            </ToggleButton>
            <ToggleButton
              pressed={anyUnderline}
              label="Underline"
              onToggle={() => toggleStyle('underline', anyUnderline)}
            >
              <Underline className="size-3.5" aria-hidden="true" />
            </ToggleButton>
          </div>

          <div
            className="flex items-center rounded-md border p-0.5"
            role="group"
            aria-label="Text alignment"
          >
            {(
              [
                ['left', AlignLeft],
                ['center', AlignCenter],
                ['right', AlignRight],
                ['justify', AlignJustify],
              ] as const
            ).map(([align, Icon]) => (
              <ToggleButton
                key={align}
                pressed={target.paragraphs.every((p) => p.align === align)}
                label={`Align ${align}`}
                onToggle={() => applyTextStyleCommand(id, { align })}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </ToggleButton>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
