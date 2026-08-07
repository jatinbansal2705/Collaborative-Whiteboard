'use client';

import { useState } from 'react';
import { BoardGrid } from '@/components/dashboard/board-grid';
import { CreateBoardDialog } from '@/components/dashboard/board-create-dialog';
import { DeleteBoardDialog } from '@/components/dashboard/board-delete-dialog';
import { RenameBoardDialog } from '@/components/dashboard/board-rename-dialog';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardToolbar } from '@/components/dashboard/dashboard-toolbar';
import { TemplateGalleryDialog } from '@/components/dashboard/template-gallery-dialog';
import { useDashboard } from '@/hooks/use-dashboard';
import { toast } from '@/stores/toast-store';
import type { BoardSummary } from '@/types/board';

export default function DashboardPage() {
  const dashboard = useDashboard();
  const [createOpen, setCreateOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<BoardSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BoardSummary | null>(null);

  async function handleUseTemplate(template: BoardSummary): Promise<void> {
    const board = await dashboard.createBoard({ templateId: template.id });
    toast.success('Board created from template', `“${board.title}” is ready.`);
    setGalleryOpen(false);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <DashboardHeader />

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-6 py-8"
      >
        <div className="mb-8">
          <DashboardToolbar
            dashboard={dashboard}
            onCreateBoard={() => setCreateOpen(true)}
          />
        </div>

        <BoardGrid
          dashboard={dashboard}
          onCreateBoard={() => setCreateOpen(true)}
          onOpenTemplates={() => setGalleryOpen(true)}
          onRename={setRenameTarget}
          onDelete={setDeleteTarget}
        />
      </main>

      <CreateBoardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={dashboard.createBoard}
        onBrowseTemplates={() => setGalleryOpen(true)}
      />

      <TemplateGalleryDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        templates={dashboard.templates}
        templatesLoading={dashboard.templatesLoading}
        loadTemplates={dashboard.loadTemplates}
        onUseTemplate={handleUseTemplate}
      />

      <RenameBoardDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={dashboard.renameBoard}
      />

      <DeleteBoardDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={dashboard.deleteBoard}
      />
    </div>
  );
}
