import { Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import type { TrendScanResult } from '../../types/workspace';

interface SavedScansListProps {
  scans: TrendScanResult[];
  activeScanId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function SavedScansList({
  scans,
  activeScanId,
  onSelect,
  onDelete,
}: SavedScansListProps) {
  if (scans.length === 0) return null;

  return (
    <Card variant="default" className="px-5 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Saved Research Scans ({scans.length})
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scans.map((scan) => {
            const isSelected = activeScanId === scan.id;
            const label = scan.query.customTopic
              ? `${scan.query.customTopic}`
              : scan.query.timeHorizon === 'upcoming_seasonal'
                ? 'Upcoming Seasonal'
                : 'Selling Now';
            return (
              <div
                key={scan.id}
                className={`inline-flex items-center rounded-md border text-xs ${
                  isSelected
                    ? 'border-primary bg-primary-subtle text-primary-900'
                    : 'border-border bg-surface text-text-secondary'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(scan.id)}
                  className="px-2.5 py-1.5 font-medium"
                >
                  {label} ·{' '}
                  <span className="font-mono tabular-nums">{scan.opportunities.length}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete scan ${label}`}
                  onClick={() => onDelete(scan.id)}
                  className="border-l border-border px-2 py-1.5 text-text-muted hover:text-danger"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
