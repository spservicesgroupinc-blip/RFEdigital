import { useState } from 'react';
import type { JobItem, JobStatus, Product, WorkspaceSettings } from '../types/workspace';
import type { JobAction } from '../lib/workspaceLogic';
import { JobsMetrics, JobsControls, JobsTable, ScriptPanel } from './jobs';

interface JobsViewProps {
  jobs: JobItem[];
  products: Product[];
  settings: WorkspaceSettings;
  autoPoll: boolean;
  runningStep: boolean;
  onToggleAutoPoll: () => void;
  onRunNextJob: (jobId?: string) => Promise<void>;
  onJobAction: (jobId: string, action: JobAction) => Promise<void>;
  onRefreshJobs: () => Promise<void>;
}

export function JobsView({
  jobs,
  products,
  settings,
  autoPoll,
  runningStep,
  onToggleAutoPoll,
  onRunNextJob,
  onJobAction,
  onRefreshJobs,
}: JobsViewProps) {
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [showScriptPanel, setShowScriptPanel] = useState(false);

  const filtered = jobs.filter((j) => statusFilter === 'all' || j.status === statusFilter);
  const queuedCount = jobs.filter((j) => j.status === 'queued').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  return (
    <div className="space-y-6">
      <JobsMetrics
        queuedCount={queuedCount}
        completedCount={completedCount}
        failedCount={failedCount}
        autoPoll={autoPoll}
        onToggleAutoPoll={onToggleAutoPoll}
      />

      <JobsControls
        jobsCount={jobs.length}
        queuedCount={queuedCount}
        completedCount={completedCount}
        failedCount={failedCount}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        runningStep={runningStep}
        onToggleScriptPanel={() => setShowScriptPanel((prev) => !prev)}
        onRefreshJobs={onRefreshJobs}
        onRunNextJob={() => onRunNextJob()}
      />

      {showScriptPanel && <ScriptPanel settings={settings} />}

      <JobsTable
        jobs={filtered}
        products={products}
        runningStep={runningStep}
        onRunNextJob={onRunNextJob}
        onJobAction={onJobAction}
      />
    </div>
  );
}
