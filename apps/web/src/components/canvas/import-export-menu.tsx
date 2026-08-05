'use client';

import { useRef } from 'react';
import {
  Download,
  FileJson,
  FileText,
  FileUp,
  FileImage,
  File,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  downloadExport,
  exportBoardDocument,
  importBoardFile,
} from '@/lib/exchange';
import { documentFromElements } from '@whiteboard/shared';
import { getErrorMessage } from '@/lib/api/errors';
import { useCanvasStore } from '@/stores/canvas-store';
import { toast } from '@/stores/toast-store';
import type { ExportFormat } from '@/lib/exchange/types';

interface ImportExportMenuProps {
  title: string;
  canEdit: boolean;
}

const EXPORT_ITEMS: {
  format: ExportFormat;
  label: string;
  icon: typeof File;
}[] = [
  { format: 'json', label: 'JSON (full board)', icon: FileJson },
  { format: 'svg', label: 'SVG (vector)', icon: FileText },
  { format: 'png', label: 'PNG (image)', icon: FileImage },
  { format: 'jpeg', label: 'JPEG (image)', icon: ImageIcon },
  { format: 'pdf', label: 'PDF', icon: File },
];

/** Import/export menu for the board header (PRD "Export / Import"). */
export function ImportExportMenu({ title, canEdit }: ImportExportMenuProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportingRef = useRef(false);

  const handleExport = async (format: ExportFormat): Promise<void> => {
    if (exportingRef.current) {
      return;
    }
    exportingRef.current = true;
    try {
      const document = documentFromElements(useCanvasStore.getState().elements);
      const result = await exportBoardDocument(document, format, title, {
        scale: 2,
        background: format === 'jpeg' ? '#ffffff' : null,
      });
      await downloadExport(result);
      toast.success('Exported', result.filename);
    } catch (error) {
      toast.error('Export failed', getErrorMessage(error));
    } finally {
      exportingRef.current = false;
    }
  };

  const handleImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file === undefined) {
      return;
    }
    try {
      const imported = await importBoardFile(file);
      if (imported.elements.length === 0) {
        toast.error('Nothing to import', 'No drawable content was found.');
        return;
      }
      useCanvasStore.getState().reset();
      useCanvasStore.getState().setElements(imported.elements);
      toast.success('Imported', `${imported.elements.length} elements added.`);
    } catch (error) {
      toast.error('Import failed', getErrorMessage(error));
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Import or export"
            title="Import / export"
            className="size-8"
          >
            {exportingRef.current ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Export</DropdownMenuLabel>
          {EXPORT_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.format}
                onClick={() => void handleExport(item.format)}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </DropdownMenuItem>
            );
          })}
          {canEdit ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Import</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <FileUp className="size-4" aria-hidden="true" />
                JSON, SVG or image
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".json,.svg,.png,.jpg,.jpeg,.webp,application/json,image/svg+xml,image/png,image/jpeg,image/webp"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => void handleImport(event)}
      />
    </>
  );
}
