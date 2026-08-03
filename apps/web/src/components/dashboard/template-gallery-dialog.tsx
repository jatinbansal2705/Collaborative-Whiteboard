'use client';

import { LayoutTemplate, TriangleAlert, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/state/empty-state';
import { getErrorMessage } from '@/lib/api/errors';
import { toast } from '@/stores/toast-store';
import type { BoardSummary } from '@/types/board';

interface TemplateGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: BoardSummary[];
  templatesLoading: boolean;
  loadTemplates: () => Promise<void>;
  onUseTemplate: (template: BoardSummary) => Promise<void>;
}

export function TemplateGalleryDialog({
  open,
  onOpenChange,
  templates,
  templatesLoading,
  loadTemplates,
  onUseTemplate,
}: TemplateGalleryDialogProps) {
  useEffect(() => {
    if (open && templates.length === 0) {
      void loadTemplates();
    }
  }, [open, templates.length, loadTemplates]);

  async function handleUse(template: BoardSummary): Promise<void> {
    try {
      await onUseTemplate(template);
    } catch (error) {
      toast.error('Could not use template', getErrorMessage(error));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Browse templates</DialogTitle>
          <DialogDescription>
            Pick a starter board and we will create a copy for you.
          </DialogDescription>
        </DialogHeader>

        {templatesLoading && templates.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2 rounded-lg border p-3">
                <Skeleton className="aspect-video w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="No templates available"
            description="Templates will show up here as soon as your team publishes them."
            icon={LayoutTemplate}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-col gap-3 rounded-lg border p-3"
              >
                <div className="bg-muted/60 flex aspect-video w-full items-center justify-center">
                  {template.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={template.thumbnailUrl}
                      alt=""
                      className="aspect-video w-full rounded-md object-cover"
                    />
                  ) : (
                    <LayoutTemplate
                      className="size-8 text-muted-foreground/60"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">
                      {template.title}
                    </h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" aria-hidden="true" />
                      {template.memberCount} member
                      {template.memberCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => void handleUse(template)}>
                    Use
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {templatesLoading === false && templates.length > 0 ? (
          <div className="flex items-center justify-end gap-2 pt-1 text-sm text-muted-foreground">
            <TriangleAlert className="size-4" aria-hidden="true" />
            Using a template creates a new editable copy.
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
