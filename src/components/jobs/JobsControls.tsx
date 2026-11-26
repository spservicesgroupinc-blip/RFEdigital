import { Code2, RefreshCw, StepForward } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import type { JobStatus } from '../../types/workspace';

interface JobsControlsProps {
  jobsCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  statusFilter: JobStatus | 'all';
  onStatusFilterChange: (value: JobStatus | 'all') => void;
  runningStep: boolean;
  onToggleScriptPanel: () => void;
  onRefreshJobs: () => Promise<void>;
  onRunNextJob: () => Promise<void>;
}

export function JobsControls({
  jobsCount,
  queuedCount,
  completedCount,
  failedCount,
  statusFilter,
  onStatusFilterChange,
  runningStep,
  onToggleScriptPanel,
  onRefreshJobs,
  onRunNextJob,
}: JobsControlsProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <Tabs<JobStatus | 'all'>
        items={[
          { id: 'all', label: `All (${jobsCount})` },
          { id: 'queued', label: `Queued (${queuedCount})` },
          { id: 'running', label: 'Running' },
          { id: 'completed', label: `Completed (${completedCount})` },
          { id: 'failed', label: `Failed (${failedCount})` },
          { id: 'paused', label: 'Paused' },
        ]}
        activeId={statusFilter}
        onChange={onStatusFilterChange}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          leadingIcon={<Code2 className="h-3.5 w-3.5" />}
          onClick={onToggleScriptPanel}
        >
          Apps Script Trigger
        </Button>
        <Button
          variant="outline"
          size="sm"
          leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={onRefreshJobs}
          aria-label="Poll job queue status"
        >
          Poll Status
        </Button>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<StepForward className="h-3.5 w-3.5" />}
          disabled={runningStep || queuedCount === 0}
          onClick={onRunNextJob}
          isLoading={runningStep}
        >
          Process Next Step
        </Button>
      </div>
    </div>
  );
}
