'use client';

import { FolderArchive, Layers3, UserRound, View } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DashboardFilters } from '@/hooks/use-dashboard';

export type FilterKey = 'all' | 'archived' | 'template' | 'owned-by-me';

export const FILTER_OPTIONS: {
  key: FilterKey;
  label: string;
  icon: typeof View;
  toFilters: () => DashboardFilters;
}[] = [
  {
    key: 'all',
    label: 'All boards',
    icon: View,
    toFilters: () => ({}),
  },
  {
    key: 'archived',
    label: 'Archived',
    icon: FolderArchive,
    toFilters: () => ({ archived: true }),
  },
  {
    key: 'template',
    label: 'Templates',
    icon: Layers3,
    toFilters: () => ({ template: true }),
  },
  {
    key: 'owned-by-me',
    label: 'Owned by me',
    icon: UserRound,
    toFilters: () => ({ ownedByMe: true }),
  },
];

export function filterKeyFor(filters: DashboardFilters): FilterKey {
  if (filters.archived === true) {
    return 'archived';
  }
  if (filters.template === true) {
    return 'template';
  }
  if (filters.ownedByMe === true) {
    return 'owned-by-me';
  }
  return 'all';
}

interface FilterSelectProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}

export function FilterSelect({ filters, onChange }: FilterSelectProps) {
  const value = filterKeyFor(filters);

  function handleChange(nextKey: string): void {
    const option = FILTER_OPTIONS.find((entry) => entry.key === nextKey);
    if (option !== undefined) {
      onChange(option.toFilters());
    }
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-auto" aria-label="Filter boards">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FILTER_OPTIONS.map((option) => {
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
