'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  FileDown,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { boardService } from '@/lib/api/services/board-service';
import { formatRelativeTime } from '@/lib/date';
import { toast } from '@/stores/toast-store';
import type {
  BoardActivity,
  BoardActivityType,
  BoardVersion,
} from '@/types/board';

const ACTIVITY_LABELS: Record<BoardActivityType, string> = {
  CREATE: 'created the board',
  EDIT: 'edited the board',
  VERSION_RESTORE: 'restored a version',
  MANUAL_VERSION: 'saved a version',
  ARCHIVE: 'archived the board',
  DELETE: 'deleted the board',
  RESTORE: 'restored the board',
};

const ACTIVITY_ICONS: Record<BoardActivityType, typeof Archive> = {
  CREATE: Plus,
  EDIT: Pencil,
  VERSION_RESTORE: RotateCcw,
  MANUAL_VERSION: FileDown,
  ARCHIVE: Archive,
  DELETE: Trash2,
  RESTORE: UserRound,
};

interface VersionHistoryDialogProps {
  boardId: string;
  open: boolean;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Version history + activity timeline for a board (PRD "Version History"). */
export function VersionHistoryDialog({
  boardId,
  open,
  canEdit,
  onOpenChange,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [activity, setActivity] = useState<BoardActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [confirmVersionNo, setConfirmVersionNo] = useState<number | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [versionResult, activityResult] = await Promise.all([
        boardService.listVersions(boardId, { limit: 100 }),
        boardService.listActivity(boardId, { limit: 100 }),
      ]);
      setVersions(versionResult.data);
      setActivity(activityResult.data);
    } catch {
      toast.error('Could not load version history');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLoading(true);
    void load();
  }, [open, load]);

  const handleSaveVersion = useCallback(async (): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await boardService.createVersion(boardId, {
        note: note.trim() === '' ? undefined : note.trim(),
      });
      setNote('');
      await load();
      toast.success('Version saved');
    } catch {
      toast.error('Could not save a version');
    } finally {
      setBusy(false);
    }
  }, [boardId, busy, note, load]);

  const handleRestore = useCallback(
    async (versionNo: number): Promise<void> => {
      if (confirmVersionNo !== versionNo) {
        setConfirmVersionNo(versionNo);
        return;
      }
      setConfirmVersionNo(null);
      setBusy(true);
      try {
        await boardService.restoreVersion(boardId, versionNo);
        toast.success(
          `Version ${versionNo} restored`,
          'The board will update across all viewers.',
        );
        onOpenChange(false);
      } catch {
        toast.error('Could not restore this version');
      } finally {
        setBusy(false);
      }
    },
    [boardId, confirmVersionNo, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Snapshots of this board plus a timeline of what changed.
          </DialogDescription>
        </DialogHeader>

        {canEdit ? (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label
                htmlFor="version-note"
                className="text-xs font-medium text-muted-foreground"
              >
                Note (optional)
              </label>
              <input
                id="version-note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Before client presentation"
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              />
            </div>
            <Button
              size="icon"
              className="h-9"
              onClick={() => void handleSaveVersion()}
              disabled={busy}
              aria-label="Save version now"
              title="Save version now"
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        <Tabs defaultValue="versions">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="versions" className="max-h-72 overflow-y-auto">
            {loading ? (
              <p className="p-3 text-sm text-muted-foreground">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No versions yet. Save one to keep a checkpoint.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {versions.map((version) => (
                  <li
                    key={version.id}
                    className="flex items-center gap-3 p-2.5"
                  >
                    <History
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {version.note ?? `Version ${version.versionNo}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {version.kind === 'MANUAL' ? 'Manual' : 'Automatic'} ·{' '}
                        {version.elementCount} elements ·{' '}
                        {formatRelativeTime(version.createdAt)}
                      </p>
                    </div>
                    {canEdit ? (
                      <Button
                        variant={
                          confirmVersionNo === version.versionNo
                            ? 'destructive'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => void handleRestore(version.versionNo)}
                        disabled={busy}
                        title="Restore this version (non-destructive)"
                      >
                        <RotateCcw aria-hidden="true" />
                        {confirmVersionNo === version.versionNo
                          ? 'Confirm'
                          : 'Restore'}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="activity" className="max-h-72 overflow-y-auto">
            {loading ? (
              <p className="p-3 text-sm text-muted-foreground">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No activity recorded yet.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {activity.map((entry) => {
                  const Icon = ACTIVITY_ICONS[entry.type];
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 p-2.5"
                    >
                      <Icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <span className="font-medium">
                            {entry.actor.name ?? 'Someone'}
                          </span>{' '}
                          {ACTIVITY_LABELS[entry.type]}
                          {entry.versionNo !== null
                            ? ` (version ${entry.versionNo})`
                            : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(entry.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
