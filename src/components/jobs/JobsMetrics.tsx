import { Card } from '../ui/Card';
import { KpiCard } from '../ui/KpiCard';

interface JobsMetricsProps {
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  autoPoll: boolean;
  onToggleAutoPoll: () => void;
}

export function JobsMetrics({
  queuedCount,
  completedCount,
  failedCount,
  autoPoll,
  onToggleAutoPoll,
}: JobsMetricsProps) {
  return (
    <Card variant="default" className="overflow-hidden">
      <div className="grid grid-cols-2 divide-y divide-border bg-surface sm:grid-cols-4 lg:divide-x lg:divide-y-0">
        <KpiCard label="Queued Steps" value={queuedCount} hint="Ready for next worker tick" />
        <KpiCard label="Completed" value={completedCount} hint="Saved to library & storage" />
        <KpiCard label="Failed / Needs Retry" value={failedCount} hint="Up to 3 retries per job" />
        <div className="bg-surface px-5 py-4">
          <div className="text-xs font-medium text-text-muted">Worker Polling</div>
          <div className="mt-1 text-sm font-semibold text-text">
            {autoPoll ? 'Polling every 6s' : 'Manual single-step'}
          </div>
          <button
            type="button"
            onClick={onToggleAutoPoll}
            className="mt-1 text-xs font-medium text-primary hover:text-primary-hover whitespace-nowrap"
          >
            {autoPoll ? 'Stop Auto-Runner' : 'Enable Auto-Runner'}
          </button>
        </div>
      </div>
    </Card>
  );
}
