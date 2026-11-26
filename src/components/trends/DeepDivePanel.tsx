import { ExternalLink, Microscope } from 'lucide-react';
import type { TrendDeepDive } from '../../types/workspace';
import { sanitizeSourceUrl } from '../../lib/workspaceLogic';

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

interface DeepDivePanelProps {
  deepDive: TrendDeepDive;
}

export function DeepDivePanel({ deepDive }: DeepDivePanelProps) {
  return (
    <div className="border-t border-border bg-surface-secondary px-6 py-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-text">
          <Microscope className="h-4 w-4 text-primary" aria-hidden="true" />
          Niche Competitive Deep-Dive
        </div>
        <span className="font-mono text-[11px] text-text-muted">
          {formatDateTime(deepDive.researched_at)} · {deepDive.model}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-text-secondary">{deepDive.summary}</p>

      {/* Price Ladder */}
      <div className="grid grid-cols-1 gap-3 border-y border-border py-3 text-xs sm:grid-cols-4">
        <div>
          <div className="text-text-muted">Entry Tier</div>
          <div className="mt-0.5 font-mono font-medium text-text">
            {deepDive.price_ladder.entry_tier}
          </div>
        </div>
        <div>
          <div className="text-text-muted">Mid Tier</div>
          <div className="mt-0.5 font-mono font-medium text-text">
            {deepDive.price_ladder.mid_tier}
          </div>
        </div>
        <div>
          <div className="text-text-muted">Premium Tier</div>
          <div className="mt-0.5 font-mono font-medium text-text">
            {deepDive.price_ladder.premium_tier}
          </div>
        </div>
        <div>
          <div className="text-primary font-medium">Recommended Price</div>
          <div className="mt-0.5 font-mono font-semibold text-primary-hover">
            {deepDive.price_ladder.recommended_price}
          </div>
        </div>
      </div>

      {/* Top Competing Listings */}
      {deepDive.top_competing_listings.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Observed Competing Listings
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-text-muted">
                  <th className="py-2 pr-4 font-medium">Listing</th>
                  <th className="py-2 pr-4 font-medium">Marketplace</th>
                  <th className="py-2 pr-4 font-medium">Observed Price</th>
                  <th className="py-2 font-medium">Observed Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deepDive.top_competing_listings.map((item, i) => {
                  const safeHref = sanitizeSourceUrl(item.url);
                  return (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium text-text">
                        {safeHref ? (
                          <a
                            href={safeHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <span>{item.title}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                          </a>
                        ) : (
                          item.title
                        )}
                      </td>
                      <td className="py-2 pr-4 text-text-secondary">{item.marketplace}</td>
                      <td className="py-2 pr-4 font-mono text-text tabular-nums">
                        {item.observed_price}
                      </td>
                      <td className="py-2 text-text-secondary">{item.observed_signal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-xs">
        <div>
          <div className="font-semibold uppercase tracking-wide text-text-muted">
            Recurring Review Complaints
          </div>
          <ul className="mt-1.5 space-y-1 text-text-secondary">
            {deepDive.recurring_buyer_complaints.map((c, i) => (
              <li key={i}>– {c}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div>
            <div className="font-semibold uppercase tracking-wide text-text-muted">
              High-Intent Search Keywords
            </div>
            <p className="mt-1 font-mono text-[11px] leading-relaxed text-text-secondary">
              {deepDive.high_intent_keywords.join(', ')}
            </p>
          </div>
          <div>
            <div className="font-semibold uppercase tracking-wide text-text-muted">
              Concrete Differentiation Plan
            </div>
            <p className="mt-1 leading-relaxed text-text">{deepDive.differentiation_angle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
