'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  IMAGE_ALLOWED_TYPES,
  IMAGE_MAX_SIZE_BYTES,
} from '@/lib/canvas/constants';
import { insertImageCommand } from '@/lib/canvas/commands';
import { useCanvasStore } from '@/stores/canvas-store';

/** Inserts an image from a URL or a local file (read into a data URL). */
export function ImageInsertDialog() {
  const pending = useCanvasStore((state) => state.pendingInsertion);
  const setPendingInsertion = useCanvasStore(
    (state) => state.setPendingInsertion,
  );
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (pending === null || pending.kind !== 'image') {
    return null;
  }
  const insertion = pending;
  const open = true;

  function close(): void {
    setPendingInsertion(null);
    setUrl('');
    setError(null);
    setBusy(false);
  }

  function insert(src: string): void {
    insertImageCommand(insertion.x, insertion.y, src);
    close();
  }

  function handleUrl(): void {
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      setError('Paste an image URL first.');
      return;
    }
    setError(null);
    insert(trimmed);
  }

  async function handleFile(file: File): Promise<void> {
    if (
      !IMAGE_ALLOWED_TYPES.includes(
        file.type as (typeof IMAGE_ALLOWED_TYPES)[number],
      )
    ) {
      setError(`Unsupported type "${file.type}". Use PNG, JPEG or WebP.`);
      return;
    }
    if (file.size > IMAGE_MAX_SIZE_BYTES) {
      setError('Image is larger than 10 MB.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      insert(dataUrl);
    } catch {
      setError('Could not read the selected file.');
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
          <DialogDescription>
            Paste an image URL or upload a PNG, JPEG or WebP file (max 10 MB).
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…/image.png"
              aria-label="Image URL"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleUrl();
                }
              }}
            />
            <Button type="button" onClick={handleUrl}>
              Insert URL
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex-1">or upload a file</span>
            <input
              ref={fileRef}
              type="file"
              accept={IMAGE_ALLOWED_TYPES.join(',')}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file !== undefined) {
                  void handleFile(file);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {busy ? 'Reading…' : 'Choose file'}
            </Button>
          </div>
          {error !== null ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
