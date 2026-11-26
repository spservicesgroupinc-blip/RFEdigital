import { Search, Sheet } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';
import type { ProductCategory, ProductStatus, WorkspaceSettings } from '../../types/workspace';

interface ProductFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  categoryFilter: ProductCategory | 'all';
  onCategoryChange: (value: ProductCategory | 'all') => void;
  statusFilter: ProductStatus | 'all';
  onStatusChange: (value: ProductStatus | 'all') => void;
  googleConnected: boolean;
  settings: WorkspaceSettings;
  onNewSeries: () => void;
  onSyncSheets: () => void;
}

const CATEGORY_TABS: Array<{ id: ProductCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'childrens-book', label: 'Books' },
  { id: 'coloring-book', label: 'Coloring' },
  { id: 'art-print', label: 'Art Prints' },
];

export function ProductFilters({
  query,
  onQueryChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  googleConnected,
  settings,
  onNewSeries,
  onSyncSheets,
}: ProductFiltersProps) {
  const syncDisabled = !googleConnected;
  const syncTitle = syncDisabled
    ? 'Sign in with Google on Settings & Sync to enable Sheets sync'
    : settings.connectedSpreadsheetId
      ? 'Sync product rows to Google Sheets'
      : 'Create and sync a new Google Sheet';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <label htmlFor="library-search" className="sr-only">
            Search products
          </label>
          <Input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search title, subtitle, or ISBN…"
            className="pl-9"
          />
        </div>

        <Tabs
          items={CATEGORY_TABS}
          activeId={categoryFilter}
          onChange={(id) => onCategoryChange(id as ProductCategory | 'all')}
        />

        <label htmlFor="status-filter" className="sr-only">
          Filter by status
        </label>
        <Select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as ProductStatus | 'all')}
          className="w-auto"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="in-production">In Production</option>
          <option value="ready-for-kdp">Ready for KDP</option>
          <option value="published">Published</option>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="md" onClick={onNewSeries}>
          New Series
        </Button>
        <Button
          variant="outline"
          size="md"
          leadingIcon={<Sheet className="h-3.5 w-3.5" />}
          onClick={onSyncSheets}
          disabled={syncDisabled}
          title={syncTitle}
        >
          Sync Sheets
        </Button>
      </div>
    </div>
  );
}
