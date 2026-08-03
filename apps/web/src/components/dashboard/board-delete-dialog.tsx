'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getErrorMessage } from '@/lib/api/errors';
import { toast } from '@/stores/toast-store';
import type { BoardSummary } from '@/types/board';

interface DeleteBoardDialogProps {
  target: BoardSummary | null;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
}

export function DeleteBoardDialog({
  target,
  onClose,
  onDelete,
}: DeleteBoardDialogProps) {
  const [pending, setPending] = useState(false);

  async function handleConfirm(): Promise<void> {
    if (target === null) {
      return;
    }
    setPending(true);
    try {
      await onDelete(target.id);
      toast.success('Board deleted', `“${target.title}” was removed.`);
      onClose();
    } catch (error) {
      toast.error('Could not delete board', getErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete “{target?.title ?? 'this board'}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the board and its contents. Members will
            lose access immediately. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void handleConfirm()}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {pending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
