'use client';

import {
  Archive,
  ArchiveRestore,
  Copy,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UseDashboardResult } from '@/hooks/use-dashboard';
import {
  canArchive,
  canDelete,
  canDuplicate,
  canRename,
  canToggleFavourite,
} from '@/lib/board-permissions';
import { formatRelativeTime } from '@/lib/date';
import { cn } from '@/lib/utils';
import { toast } from '@/stores/toast-store';
import type { BoardSummary } from '@/types/board';

interface BoardCardProps {
  board: BoardSummary;
  dashboard: UseDashboardResult;
  onRename: (board: BoardSummary) => void;
  onDelete: (board: BoardSummary) => void;
}

export function BoardCard({
  board,
  dashboard,
  onRename,
  onDelete,
}: BoardCardProps) {
  async function handleToggleFavourite(): Promise<void> {
    try {
      await dashboard.toggleFavourite(board);
    } catch {
      // The hook already surfaced an error toast.
    }
  }

  async function handleArchive(): Promise<void> {
    try {
      await dashboard.archiveBoard(board.id);
      toast.success(
        'Board archived',
        `“${board.title}” was moved to the archive.`,
      );
    } catch {
      // The hook already surfaced an error toast.
    }
  }

  async function handleRestore(): Promise<void> {
    try {
      await dashboard.restoreBoard(board.id);
      toast.success('Board restored', `“${board.title}” is active again.`);
    } catch {
      // The hook already surfaced an error toast.
    }
  }

  async function handleDuplicate(): Promise<void> {
    try {
      await dashboard.duplicateBoard(board.id);
    } catch {
      // The hook already surfaced an error toast.
    }
  }

  return (
    <div className="group rounded-lg border bg-card transition-colors hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring/50">
      <Link
        href={`/board/${board.id}`}
        className="block"
        aria-label={`Open “${board.title}”`}
      >
        <div className="relative overflow-hidden rounded-t-lg">
          {board.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={board.thumbnailUrl}
              alt=""
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="bg-muted/60 flex aspect-video w-full items-center justify-center">
              <LayoutTemplate
                className="size-8 text-muted-foreground/60"
                aria-hidden="true"
              />
            </div>
          )}
        </div>
      </Link>

      <div className="absolute top-2 right-2 flex items-center gap-1">
        {canToggleFavourite(board.myRole) ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => void handleToggleFavourite()}
            className="size-7 shadow-sm"
            aria-label={
              board.isFavourite
                ? `Remove “${board.title}” from favorites`
                : `Add “${board.title}” to favorites`
            }
          >
            <Star
              className={cn(
                'size-4',
                board.isFavourite &&
                  'fill-yellow-400 text-yellow-400 dark:fill-yellow-400 dark:text-yellow-400',
              )}
              aria-hidden="true"
            />
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-7 shadow-sm"
              aria-label={`Actions for “${board.title}”`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {canRename(board.myRole) ? (
              <DropdownMenuItem onSelect={() => onRename(board)}>
                <Pencil aria-hidden="true" />
                Rename
              </DropdownMenuItem>
            ) : null}
            {canDuplicate(board.myRole) ? (
              <DropdownMenuItem onSelect={() => void handleDuplicate()}>
                <Copy aria-hidden="true" />
                Duplicate
              </DropdownMenuItem>
            ) : null}
            {canArchive(board.myRole) ? (
              board.isArchived ? (
                <DropdownMenuItem onSelect={() => void handleRestore()}>
                  <ArchiveRestore aria-hidden="true" />
                  Restore
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void handleArchive()}>
                  <Archive aria-hidden="true" />
                  Archive
                </DropdownMenuItem>
              )
            ) : null}
            {canDelete(board.myRole) ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onDelete(board)}
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-3">
        <Link
          href={`/board/${board.id}`}
          className="block min-w-0"
          aria-label={`Open “${board.title}”`}
        >
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 truncate font-medium hover:underline">
              {board.title}
            </h3>
            {board.isTemplate ? (
              <Badge variant="secondary" className="shrink-0">
                Template
              </Badge>
            ) : null}
          </div>
        </Link>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden="true" />
            {board.memberCount}
          </span>
          <span aria-hidden="true">·</span>
          {board.isArchived ? (
            <Badge variant="outline" className="shrink-0">
              Archived
            </Badge>
          ) : (
            <span>Edited {formatRelativeTime(board.updatedAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
