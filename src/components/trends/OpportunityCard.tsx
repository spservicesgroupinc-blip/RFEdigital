import { ArrowRight, ChevronDown, ChevronUp, ExternalLink, FolderPlus, Loader2, Microscope } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { TrendOpportunity, TrendProductType } from '../../types/workspace';
import { sanitizeSourceUrl } from '../../lib/workspaceLogic';
import { DeepDivePanel } from './DeepDivePanel';

const PRODUCT_TYPE_LABELS: Record<TrendProductType, string> = {
  'childrens-book': "Children's Picture Book",
  'coloring-book': 'Coloring & Activity Book',
  'wall-art': 'Printable Wall Art / Stickers',
  flashcards: 'Flashcards / Worksheets',
  'ebook-planner': 'Planner / Niche Ebook',
};

function getDemandColor(level: TrendOpportunity['demand_level']): string {
  if (level === 'High') return 'text-success';
  if (level === 'Emerging') return 'text-primary';
  return 'text-text';
}

function getCompetitionColor(level: TrendOpportunity['competition_level']): string {
  if (level === 'Low') return 'text-success';
  if (level === 'High') return 'text-warning';
  return 'text-text';
}

interface OpportunityCardProps {
  opp: TrendOpportunity;
  index: number;
  isDeepDiving: boolean;
  isCreating: boolean;
  expanded: boolean;
  error?: string;
  onRunDeepDive: (opp: TrendOpportunity) => void;
  onToggleDeepDive: (oppId: string) => void;
  onCreateProject: (opp: TrendOpportunity) => void;
  onOpenExistingProject: (productId: string) => void;
}

export function OpportunityCard({
  opp,
  index,
  isDeepDiving,
  isCreating,
  expanded,
  error,
  onRunDeepDive,
  onToggleDeepDive,
  onCreateProject,
  onOpenExistingProject,
}: OpportunityCardProps) {
  const deepDive = opp.deep_dive;

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface">
      {/* Card Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-xs font-semibold text-text-muted tabular-nums">
              #{index + 1}
            </span>
            <h3 className="font-display text-base font-semibold text-text">{opp.title}</h3>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
            <span className="font-medium text-text-secondary">
              {PRODUCT_TYPE_LABELS[opp.product_type]}
            </span>
            <span aria-hidden="true">·</span>
            <span>{opp.marketplaces.join(', ')}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-text-secondary tabular-nums">{opp.price_range_usd}</span>
            <span aria-hidden="true">·</span>
            <span>{opp.seasonality}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs sm:gap-5">
          <div>
            <div className="text-[11px] text-text-muted">Demand</div>
            <div className={`font-semibold ${getDemandColor(opp.demand_level)}`}>
              {opp.demand_level}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-text-muted">Competition</div>
            <div className={`font-semibold ${getCompetitionColor(opp.competition_level)}`}>
              {opp.competition_level}
            </div>
          </div>
          <div className="border-l border-border pl-4 text-right">
            <div className="text-[11px] text-text-muted">Opportunity</div>
            <div className="font-mono text-lg font-bold text-text tabular-nums">
              {opp.opportunity_score}
              <span className="text-xs font-normal text-text-muted">/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Body: Sales Evidence vs. Angle & Starter Blueprint */}
      <div className="grid grid-cols-1 divide-y divide-border lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        {/* Column 1: Observed Signals vs. Estimated Velocity */}
        <div className="min-w-0 space-y-4 p-5 sm:p-6 lg:col-span-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Observed Live Signals
            </div>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-text-secondary">
              {opp.sales_evidence.observed_signals.map((sig, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 text-primary" aria-hidden="true">
                    •
                  </span>
                  <span>{sig}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border-subtle pt-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-text-muted">
                Estimated Velocity (Estimate)
              </span>
              <span className="font-mono text-[11px] text-text-muted">
                Confidence: {opp.sales_evidence.confidence}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {opp.sales_evidence.estimated_velocity}
            </p>
          </div>

          {opp.buyer_pain_points.length > 0 && (
            <div className="border-t border-border-subtle pt-3.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Buyer Pain Points
              </div>
              <ul className="mt-1.5 space-y-1 text-xs text-text-secondary">
                {opp.buyer_pain_points.map((pain, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-warning" aria-hidden="true">
                      –
                    </span>
                    <span>{pain}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Column 2: Winning Angle & Starter Blueprint */}
        <div className="min-w-0 space-y-4 p-5 sm:p-6 lg:col-span-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Winning Studio Angle
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-text">{opp.winning_angle}</p>
          </div>

          <div className="border-t border-border-subtle pt-3.5">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Starter Blueprint
            </div>
            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-text-muted">Audience</dt>
                <dd className="mt-0.5 font-medium text-text">
                  {opp.starter_blueprint.target_age_or_audience}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Trim Size</dt>
                <dd className="mt-0.5 font-mono font-medium text-text">
                  {opp.starter_blueprint.suggested_trim_size}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Pages</dt>
                <dd className="mt-0.5 font-mono font-medium text-text tabular-nums">
                  {opp.starter_blueprint.suggested_page_count} pp
                </dd>
              </div>
            </dl>
            <div className="mt-3 space-y-1.5 text-xs text-text-secondary">
              <div>
                <span className="font-medium text-text">Hook: </span>
                {opp.starter_blueprint.hook_concept}
              </div>
              <div>
                <span className="font-medium text-text">Art Direction: </span>
                {opp.starter_blueprint.art_style_direction}
              </div>
              {opp.starter_blueprint.seed_keywords.length > 0 && (
                <div className="text-text-secondary">
                  <span className="font-medium text-text">Keywords: </span>
                  <span className="font-mono text-[11px]">
                    {opp.starter_blueprint.seed_keywords.join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Verified Source Links */}
          {opp.sources.length > 0 && (
            <div className="border-t border-border-subtle pt-3.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Live Search Sources
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {opp.sources.map((src, i) => {
                  const safeHref = sanitizeSourceUrl(src.url);
                  if (!safeHref) return null;
                  return (
                    <a
                      key={i}
                      href={safeHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover hover:underline"
                    >
                      <span className="max-w-[200px] truncate sm:max-w-[240px]">{src.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="border-t border-danger-100 bg-danger-subtle px-6 py-2.5 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Inline Competitive Deep-Dive Report */}
      {deepDive && expanded && <DeepDivePanel deepDive={deepDive} />}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {deepDive ? (
            <>
              <Button
                variant="outline"
                size="sm"
                leadingIcon={
                  expanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )
                }
                onClick={() => onToggleDeepDive(opp.id)}
              >
                {expanded ? 'Hide Deep-Dive' : 'Show Deep-Dive Report'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeepDiving}
                onClick={() => onRunDeepDive(opp)}
              >
                {isDeepDiving ? 'Refreshing…' : 'Refresh Deep-Dive'}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={isDeepDiving}
              onClick={() => onRunDeepDive(opp)}
              leadingIcon={<Microscope className="h-3.5 w-3.5 text-text-muted" />}
              isLoading={isDeepDiving}
            >
              Deep-Dive Niche
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {opp.created_project_id ? (
            <Button
              variant="outline"
              size="sm"
              trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
              onClick={() => onOpenExistingProject(opp.created_project_id!)}
            >
              Edit Prompts &amp; Build
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={isCreating}
              onClick={() => onCreateProject(opp)}
              isLoading={isCreating}
              leadingIcon={<FolderPlus className="h-3.5 w-3.5" />}
            >
              Use Trend &amp; Generate Prompts
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
