'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilterSelect } from '@/components/dashboard/filter-select';
import { SearchBox } from '@/components/dashboard/search-box';
import { SortSelect } from '@/components/dashboard/sort-select';
import type { UseDashboardResult } from '@/hooks/use-dashboard';
import type { BoardTab } from '@/types/board';

const TABS: { value: BoardTab; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'shared', label: 'Shared with me' },
  { value: 'favourited', label: 'Favorites' },
];

interface DashboardToolbarProps {
  dashboard: UseDashboardResult;
  onCreateBoard: () => void;
}

export function DashboardToolbar({
  dashboard,
  onCreateBoard,
}: DashboardToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={dashboard.activeTab}
          onValueChange={(value) => dashboard.setActiveTab(value as BoardTab)}
        >
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Button onClick={onCreateBoard}>
          <Plus aria-hidden="true" />
          New board
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBox value={dashboard.search} onChange={dashboard.setSearch} />
        <div className="flex flex-wrap items-center gap-3">
          <SortSelect
            sortBy={dashboard.sortBy}
            order={dashboard.order}
            onChange={(sortBy, order) => {
              dashboard.setSortBy(sortBy);
              dashboard.setOrder(order);
            }}
          />
          <FilterSelect
            filters={dashboard.filters}
            onChange={dashboard.setFilters}
          />
        </div>
      </div>
    </div>
  );
}
