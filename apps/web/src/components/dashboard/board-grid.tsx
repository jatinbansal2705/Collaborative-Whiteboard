'use client';

import { LayoutTemplate, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BoardCard } from '@/components/dashboard/board-card';
import { EmptyState } from '@/components/state/empty-state';
import { ErrorState } from '@/components/state/error-state';
import type { UseDashboardResult } from '@/hooks/use-dashboard';
import type { BoardSummary, BoardTab } from '@/types/board';

const TAB_EMPTY_STATE: Record<
  BoardTab,
  { title: string; description: string; icon: typeof LayoutTemplate }
> = {
  recent: {
    title: 'No boards yet',
    description: 'Create your first board to get started.',
    icon: LayoutTemplate,
  },
  shared: {
    title: 'Nothing shared with you yet',
    description: 'Boards teammates share with you will appear here.',
    icon: Users,
  },
  favourited: {
    title: 'No favorite boards yet',
    description: 'Star any board to pin it to this tab.',
    icon: Star,
  },
};

export function BoardCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card">
      <Skeleton className="aspect-video w-full rounded-t-lg" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

interface BoardGridProps {
  dashboard: UseDashboardResult;
  onCreateBoard: () => void;
  onOpenTemplates: () => void;
  onRename: (board: BoardSummary) => void;
  onDelete: (board: BoardSummary) => void;
}

export function BoardGrid({
  dashboard,
  onCreateBoard,
  onOpenTemplates,
  onRename,
  onDelete,
}: BoardGridProps) {
  const { boards, isLoading, error, hasNextPage, loadMore } = dashboard;
  const showSkeletons = isLoading && boards.length === 0;

  if (error !== null && boards.length === 0) {
    return (
      <ErrorState
        title="Could not load your boards"
        description={error}
        onRetry={dashboard.reload}
      />
    );
  }

  if (showSkeletons) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <BoardCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (boards.length === 0) {
    const searching =
      dashboard.search.trim().length > 0 || dashboard.hasActiveFilters;

    if (searching) {
      return (
        <EmptyState
          title="No matching boards"
          description="Try a different search or clear your filters to see more boards."
          icon={LayoutTemplate}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                dashboard.setSearch('');
                dashboard.clearFilters();
              }}
            >
              Clear search &amp; filters
            </Button>
          }
        />
      );
    }

    const config = TAB_EMPTY_STATE[dashboard.activeTab];
    return (
      <EmptyState
        title={config.title}
        description={config.description}
        icon={config.icon}
        action={
          <Button size="sm" onClick={onCreateBoard}>
            New board
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <BoardCard
            key={board.id}
            board={board}
            dashboard={dashboard}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>

      {hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => void loadMore()}
            disabled={isLoading}
          >
            {isLoading ? 'Loading more…' : 'Load more'}
          </Button>
        </div>
      ) : null}

      {boards.every((board) => !board.isTemplate) ? (
        <button
          type="button"
          onClick={onOpenTemplates}
          className="self-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Browse templates
        </button>
      ) : null}
    </div>
  );
}
