'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { commentService } from '@/lib/api/services/comment-service';
import type { CommentThread } from '@/types/comment';

interface CommentComposerProps {
  boardId: string;
  point: { x: number; y: number } | null;
  onClose: () => void;
  onCreated: (thread: CommentThread) => void;
}

/** Dialog that creates a new comment thread at a canvas position. */
export function CommentComposer({
  boardId,
  point,
  onClose,
  onCreated,
}: CommentComposerProps) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (point === null) {
    return null;
  }
  const target = point;

  async function submit(): Promise<void> {
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      setError('Write a comment first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const thread = await commentService.create(boardId, {
        x: target.x,
        y: target.y,
        body: trimmed,
      });
      setBody('');
      onCreated(thread);
    } catch {
      setError('Could not post the comment. Try again.');
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add comment</DialogTitle>
          <DialogDescription>
            Place a note on the canvas for the rest of the team.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="comment-body">Comment</Label>
          <Textarea
            id="comment-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Say something about this spot…"
            autoFocus
          />
          {error !== null ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || body.trim().length === 0}>
            {busy ? 'Posting…' : 'Post'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
