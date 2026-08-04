'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  EMOJI_GLYPHS,
  ICON_GLYPHS,
  iconDataUrl,
} from '@/lib/canvas/icon-assets';
import { insertIconCommand } from '@/lib/canvas/commands';
import { useCanvasStore } from '@/stores/canvas-store';
import { cn } from '@/lib/utils';

const ICON_NAMES = Object.keys(ICON_GLYPHS);

/** Insert picker for emoji and curated icons (Phase 11). */
export function IconPicker() {
  const pending = useCanvasStore((state) => state.pendingInsertion);
  const setPendingInsertion = useCanvasStore(
    (state) => state.setPendingInsertion,
  );

  if (pending === null || pending.kind === 'image') {
    return null;
  }
  const insertion = pending;
  const open = true;
  const defaultTab = insertion.kind === 'emoji' ? 'emoji' : 'icons';

  function close(): void {
    setPendingInsertion(null);
  }

  function pick(kind: 'emoji' | 'icon', value: string): void {
    insertIconCommand(insertion.x, insertion.y, kind, value);
    close();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Insert {insertion.kind === 'emoji' ? 'emoji' : 'icon'}
          </DialogTitle>
          <DialogDescription>
            Pick a {insertion.kind === 'emoji' ? 'emoji' : 'symbol'} to place on
            the board at the clicked point.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="emoji">Emoji</TabsTrigger>
            <TabsTrigger value="icons">Icons</TabsTrigger>
          </TabsList>
          <TabsContent value="emoji" className="max-h-72 overflow-y-auto">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_GLYPHS.map((glyph) => (
                <button
                  key={glyph}
                  type="button"
                  onClick={() => pick('emoji', glyph)}
                  aria-label={`Insert ${glyph}`}
                  className="flex aspect-square items-center justify-center rounded-md text-xl outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {glyph}
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="icons" className="max-h-72 overflow-y-auto">
            <div className="grid grid-cols-6 gap-1">
              {ICON_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => pick('icon', name)}
                  aria-label={`Insert ${name} icon`}
                  title={name}
                  className="flex aspect-square items-center justify-center rounded-md text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <img // eslint-disable-line @next/next/no-img-element
                    src={iconDataUrl(name)}
                    alt=""
                    className={cn('size-6')}
                  />
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
