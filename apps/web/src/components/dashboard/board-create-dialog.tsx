'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LayoutTemplate, Plus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
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
  blankBoardSchema,
  type BlankBoardInput,
  type CreateBoardInput,
} from '@/lib/validators/board';
import { toast } from '@/stores/toast-store';
import type { BoardSummary } from '@/types/board';

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateBoardInput) => Promise<BoardSummary>;
  onBrowseTemplates: () => void;
}

export function CreateBoardDialog({
  open,
  onOpenChange,
  onCreate,
  onBrowseTemplates,
}: CreateBoardDialogProps) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<BlankBoardInput>({
    resolver: zodResolver(blankBoardSchema),
    defaultValues: { title: '' },
  });

  async function handleSubmit(values: BlankBoardInput): Promise<void> {
    setPending(true);
    setFormError(null);
    try {
      const board = await onCreate({ title: values.title });
      toast.success(
        'Board created',
        `“${board?.title ?? values.title}” is ready.`,
      );
      form.reset({ title: '' });
      onOpenChange(false);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a board</DialogTitle>
          <DialogDescription>
            Start from a blank canvas, or browse templates for a head start.
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
                    <Input placeholder="e.g. Q3 roadmap" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onBrowseTemplates();
                }}
              >
                <LayoutTemplate className="size-4" aria-hidden="true" />
                Browse templates
              </Button>
              <Button type="submit" disabled={pending}>
                <Plus className="size-4" aria-hidden="true" />
                {pending ? 'Creating…' : 'Create blank board'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
