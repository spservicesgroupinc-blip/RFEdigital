import { TrendingUp } from 'lucide-react';
import { Select } from '../ui/Select';
import { EmptyState } from '../ui/EmptyState';
import { Card, CardContent } from '../ui/Card';
import { OpportunityCard } from './OpportunityCard';
import type {
  TrendMarketplace,
  TrendOpportunity,
  TrendProductType,
  TrendScanResult,
} from '../../types/workspace';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface OpportunityListProps {
  activeScan: TrendScanResult | null;
  opportunities: TrendOpportunity[];
  productTypeOptions: Array<{ id: TrendProductType; label: string }>;
  allMarketplaces: TrendMarketplace[];
  filterType: TrendProductType | 'all';
  filterMarketplace: string | 'all';
  sortBy: 'score' | 'competition';
  deepDivingId: string | null;
  creatingProjectId: string | null;
  expandedDeepDives: Record<string, boolean>;
  deepDiveErrors: Record<string, string>;
  onFilterTypeChange: (value: TrendProductType | 'all') => void;
  onFilterMarketplaceChange: (value: string | 'all') => void;
  onSortByChange: (value: 'score' | 'competition') => void;
  onRunDeepDive: (opp: TrendOpportunity) => void;
  onToggleDeepDive: (oppId: string) => void;
  onCreateProject: (opp: TrendOpportunity) => void;
  onOpenExistingProject: (productId: string) => void;
}

export function OpportunityList({
  activeScan,
  opportunities,
  productTypeOptions,
  allMarketplaces,
  filterType,
  filterMarketplace,
  sortBy,
  deepDivingId,
  creatingProjectId,
  expandedDeepDives,
  deepDiveErrors,
  onFilterTypeChange,
  onFilterMarketplaceChange,
  onSortByChange,
  onRunDeepDive,
  onToggleDeepDive,
  onCreateProject,
  onOpenExistingProject,
}: OpportunityListProps) {
  if (!activeScan) {
    return (
      <Card variant="default">
        <EmptyState
          icon={<TrendingUp className="h-7 w-7 text-primary" />}
          title="Ready to scan live digital product trends"
          description="Choose your target marketplaces and product formats above, then run a live web market scan. You’ll receive 6–8 ranked micro-niches backed by real search citations, separated observed proof vs. velocity estimates, and one-click Studio project creation."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Market Summary & Filter Bar */}
      <Card variant="default">
        <CardContent>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="break-words text-xs font-medium text-text-muted">
                Market Summary · {formatDateTime(activeScan.researched_at)} ·{' '}
                <span className="font-mono">{activeScan.model}</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-text">
                {activeScan.market_summary}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select
                aria-label="Filter by product type"
                value={filterType}
                onChange={(e) => onFilterTypeChange(e.target.value as TrendProductType | 'all')}
                className="max-w-full"
              >
                <option value="all">All Types</option>
                {productTypeOptions.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.label}
                  </option>
                ))}
              </Select>

              <Select
                aria-label="Filter by marketplace"
                value={filterMarketplace}
                onChange={(e) => onFilterMarketplaceChange(e.target.value)}
                className="max-w-full"
              >
                <option value="all">All Marketplaces</option>
                {allMarketplaces.map((mp) => (
                  <option key={mp} value={mp}>
                    {mp}
                  </option>
                ))}
              </Select>

              <Select
                aria-label="Sort opportunities"
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value as 'score' | 'competition')}
                className="max-w-full"
              >
                <option value="score">Sort: Highest Opportunity Score</option>
                <option value="competition">Sort: Lowest Competition First</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {opportunities.length === 0 ? (
        <Card variant="default">
          <div className="px-6 py-8 text-center text-xs text-text-muted">
            No trend opportunities match the active filter combination.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp, idx) => (
            <OpportunityCard
              key={opp.id}
              opp={opp}
              index={idx}
              isDeepDiving={deepDivingId === opp.id}
              isCreating={creatingProjectId === opp.id}
              expanded={Boolean(expandedDeepDives[opp.id])}
              error={deepDiveErrors[opp.id]}
              onRunDeepDive={onRunDeepDive}
              onToggleDeepDive={onToggleDeepDive}
              onCreateProject={onCreateProject}
              onOpenExistingProject={onOpenExistingProject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
