import { Pause, Play, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import type { JobItem, JobStatus, Product } from '../../types/workspace';
import type { JobAction } from '../../lib/workspaceLogic';

interface JobsTableProps {
  jobs: JobItem[];
  products: Product[];
  runningStep: boolean;
  onRunNextJob: (jobId?: string) => Promise<void>;
  onJobAction: (jobId: string, action: JobAction) => Promise<void>;
}

const STATUS_VARIANT: Record<JobStatus, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted'> = {
  queued: 'warning',
  running: 'primary',
  completed: 'success',
  failed: 'danger',
  paused: 'muted',
};

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  paused: 'Paused',
};

export function JobsTable({ jobs, products, runningStep, onRunNextJob, onJobAction }: JobsTableProps) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState
          title="No jobs match this filter"
          description="Queue a batch plan from the Planning module to populate jobs."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface-tertiary/70 text-xs font-medium text-text-muted">
              <th className="px-5 py-3">Job &amp; Output Summary</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Attempts</th>
              <th className="px-5 py-3 text-right">Controls</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {jobs.map((job) => {
              const product = products.find((p) => p.id === job.productId);
              return (
                <tr key={job.id} className="transition-colors hover:bg-surface-secondary/80">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-text">{job.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                      <span>{product?.title ?? 'Product'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{job.id}</span>
                    </div>
                    {job.resultSummary && <p className="mt-1 text-xs text-success">{job.resultSummary}</p>}
                    {job.errorMessage && <p className="mt-1 text-xs text-danger">{job.errorMessage}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-xs capitalize text-text-secondary">
                    {job.stepType}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <Badge variant={STATUS_VARIANT[job.status]} size="sm">
                      {STATUS_LABEL[job.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-text-secondary tabular-nums whitespace-nowrap">
                    {job.attempts} / {job.maxAttempts}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {job.status === 'queued' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            leadingIcon={<Play className="h-3 w-3" />}
                            disabled={runningStep}
                            onClick={() => onRunNextJob(job.id)}
                            aria-label={`Run job ${job.title}`}
                          >
                            Run
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onJobAction(job.id, 'pause')}
                            aria-label={`Pause job ${job.title}`}
                          >
                            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </>
                      )}
                      {job.status === 'paused' && (
                        <Button
                          variant="outline"
                          size="sm"
                          leadingIcon={<Play className="h-3 w-3" />}
                          onClick={() => onJobAction(job.id, 'resume')}
                          aria-label={`Resume job ${job.title}`}
                        >
                          Resume
                        </Button>
                      )}
                      {job.status === 'failed' && job.attempts < job.maxAttempts && (
                        <Button
                          variant="outline"
                          size="sm"
                          leadingIcon={<RotateCcw className="h-3 w-3" />}
                          onClick={() => onJobAction(job.id, 'retry')}
                          aria-label={`Retry job ${job.title}`}
                        >
                          Retry
                        </Button>
                      )}
                      {(job.status === 'queued' || job.status === 'paused') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onJobAction(job.id, 'cancel')}
                          aria-label={`Cancel job ${job.title}`}
                        >
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
