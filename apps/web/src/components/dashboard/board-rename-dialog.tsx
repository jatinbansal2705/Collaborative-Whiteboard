'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/api/errors';
import {
  renameBoardSchema,
  type RenameBoardInput,
} from '@/lib/validators/board';
import { toast } from '@/stores/toast-store';
import type { BoardSummary } from '@/types/board';

interface RenameBoardDialogProps {
  target: BoardSummary | null;
  onClose: () => void;
  onRename: (id: string, input: RenameBoardInput) => Promise<void>;
}

export function RenameBoardDialog({
  target,
  onClose,
  onRename,
}: RenameBoardDialogProps) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RenameBoardInput>({
    resolver: zodResolver(renameBoardSchema),
    defaultValues: { title: '' },
  });

  useEffect(() => {
    if (target !== null) {
      form.reset({ title: target.title });
      setFormError(null);
    }
  }, [target, form]);

  async function handleSubmit(values: RenameBoardInput): Promise<void> {
    if (target === null) {
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await onRename(target.id, values);
      toast.success('Board renamed', `“${values.title}” was updated.`);
      onClose();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename board</DialogTitle>
          <DialogDescription>
            Choose a new title for “{target?.title ?? 'this board'}”.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
            noValidate
          >
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{formError}</span>
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                <Pencil className="size-4" aria-hidden="true" />
                {pending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
