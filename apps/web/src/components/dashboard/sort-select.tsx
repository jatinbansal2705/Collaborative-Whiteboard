'use client';

import {
  ArrowDownAZ,
  ArrowDownZA,
  ArrowUpDown,
  Clock3,
  Users,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BoardSortBy, BoardSortOrder } from '@/types/board';

export interface SortOption {
  key: string;
  label: string;
  sortBy: BoardSortBy;
  order: BoardSortOrder;
  icon: typeof Clock3;
}

/** Sort presets mapping a single dropdown choice to (sortBy, order). */
export const SORT_OPTIONS: SortOption[] = [
  {
    key: 'updated-desc',
    label: 'Last edited',
    sortBy: 'updatedAt',
    order: 'desc',
    icon: Clock3,
  },
  {
    key: 'created-desc',
    label: 'Recently created',
    sortBy: 'createdAt',
    order: 'desc',
    icon: ArrowUpDown,
  },
  {
    key: 'title-asc',
    label: 'Title A–Z',
    sortBy: 'title',
    order: 'asc',
    icon: ArrowDownAZ,
  },
  {
    key: 'title-desc',
    label: 'Title Z–A',
    sortBy: 'title',
    order: 'desc',
    icon: ArrowDownZA,
  },
  {
    key: 'members-desc',
    label: 'Most members',
    sortBy: 'memberCount',
    order: 'desc',
    icon: Users,
  },
];

export const DEFAULT_SORT_KEY = 'updated-desc';

function sortKeyFor(sortBy: BoardSortBy, order: BoardSortOrder): string {
  return (
    SORT_OPTIONS.find(
      (option) => option.sortBy === sortBy && option.order === order,
    )?.key ?? DEFAULT_SORT_KEY
  );
}

interface SortSelectProps {
  sortBy: BoardSortBy;
  order: BoardSortOrder;
  onChange: (sortBy: BoardSortBy, order: BoardSortOrder) => void;
}

export function SortSelect({ sortBy, order, onChange }: SortSelectProps) {
  const value = sortKeyFor(sortBy, order);

  function handleChange(nextKey: string): void {
    const option = SORT_OPTIONS.find((entry) => entry.key === nextKey);
    if (option !== undefined) {
      onChange(option.sortBy, option.order);
    }
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-auto" aria-label="Sort boards">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <SelectItem key={option.key} value={option.key}>
              <span className="flex items-center gap-2">
                <Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {option.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
