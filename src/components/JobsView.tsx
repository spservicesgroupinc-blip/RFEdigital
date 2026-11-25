import { useState } from 'react';
import {
  Code2,
  Copy,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  StepForward,
  XCircle,
} from 'lucide-react';
import type { JobItem, JobStatus, Product, WorkspaceSettings } from '../types/workspace';
import { generateAppsScriptBridge, type JobAction } from '../lib/workspaceLogic';

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

const STATUS_STYLE: Record<JobStatus, string> = {
  queued: 'text-amber-700',
  running: 'text-blue-700',
  completed: 'text-emerald-700',
  failed: 'text-red-700',
  paused: 'text-slate-500',
};

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  paused: 'Paused',
};

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
  const [copiedScript, setCopiedScript] = useState(false);

  const filtered = jobs.filter((j) => statusFilter === 'all' || j.status === statusFilter);
  const queuedCount = jobs.filter((j) => j.status === 'queued').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  const appsScriptCode = generateAppsScriptBridge(
    settings.connectedSpreadsheetId,
    typeof window !== 'undefined' ? window.location.origin : ''
  );

  const copyScript = () => {
    navigator.clipboard?.writeText(appsScriptCode).catch(() => {});
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Queue Metrics Strip */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Queued Steps</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-amber-700 tabular-nums">
            {queuedCount}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Ready for next worker tick</div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Completed</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {completedCount}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Saved to library & storage</div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Failed / Needs Retry</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-red-700 tabular-nums">
            {failedCount}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Up to 3 retries per job</div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Worker Polling</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {autoPoll ? 'Polling every 6s' : 'Manual single-step'}
          </div>
          <button
            type="button"
            onClick={onToggleAutoPoll}
            className="mt-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
          >
            {autoPoll ? 'Stop Auto-Runner' : 'Enable Auto-Runner'}
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap items-center gap-1 rounded-md bg-slate-100 p-1"
          role="group"
          aria-label="Filter jobs by status"
        >
          {(
            [
              ['all', `All (${jobs.length})`],
              ['queued', `Queued (${queuedCount})`],
              ['completed', `Completed (${completedCount})`],
              ['failed', `Failed (${failedCount})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === value
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowScriptPanel((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Code2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {showScriptPanel ? 'Hide Apps Script' : 'Apps Script Trigger'}
          </button>
          <button
            type="button"
            onClick={onRefreshJobs}
            aria-label="Poll job queue status"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            Poll Status
          </button>
          <button
            type="button"
            disabled={runningStep || queuedCount === 0}
            onClick={() => onRunNextJob()}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <StepForward className="h-3.5 w-3.5" aria-hidden="true" />
            {runningStep ? 'Processing Step…' : 'Process Next Step'}
          </button>
        </div>
      </div>

      {/* Collapsible Google Apps Script Trigger Code Panel */}
      {showScriptPanel && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Google Apps Script Time-Driven Trigger (Code.gs)
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Polls your Google Sheets <span className="font-mono">Jobs</span> tab and executes
                one queued generation or export step per trigger tick.
              </p>
            </div>
            <button
              type="button"
              onClick={copyScript}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copiedScript ? 'Copied Code.gs' : 'Copy Script'}
            </button>
          </div>
          <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
            <code>{appsScriptCode}</code>
          </pre>
        </section>
      )}

      {/* Jobs Table */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center text-xs text-slate-500">
            No jobs match this filter. Queue a batch plan from the Planning module to populate jobs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                  <th className="px-5 py-3">Job & Output Summary</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Attempts</th>
                  <th className="px-5 py-3 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtered.map((job) => {
                  const product = products.find((p) => p.id === job.productId);
                  return (
                    <tr key={job.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">{job.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>{product?.title ?? 'Product'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{job.id}</span>
                        </div>
                        {job.resultSummary && (
                          <p className="mt-1 text-xs text-emerald-700">{job.resultSummary}</p>
                        )}
                        {job.errorMessage && (
                          <p className="mt-1 text-xs text-red-700">{job.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs capitalize text-slate-700 whitespace-nowrap">
                        {job.stepType}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-xs font-semibold ${STATUS_STYLE[job.status]}`}>
                          {STATUS_LABEL[job.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {job.attempts} / {job.maxAttempts}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {job.status === 'queued' && (
                            <>
                              <button
                                type="button"
                                disabled={runningStep}
                                onClick={() => onRunNextJob(job.id)}
                                aria-label={`Run job ${job.title}`}
                                className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-45"
                              >
                                <Play className="h-3 w-3" aria-hidden="true" />
                                Run
                              </button>
                              <button
                                type="button"
                                onClick={() => onJobAction(job.id, 'pause')}
                                aria-label={`Pause job ${job.title}`}
                                className="rounded border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                              >
                                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </>
                          )}
                          {job.status === 'paused' && (
                            <button
                              type="button"
                              onClick={() => onJobAction(job.id, 'resume')}
                              aria-label={`Resume job ${job.title}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Play className="h-3 w-3" aria-hidden="true" />
                              Resume
                            </button>
                          )}
                          {job.status === 'failed' && job.attempts < job.maxAttempts && (
                            <button
                              type="button"
                              onClick={() => onJobAction(job.id, 'retry')}
                              aria-label={`Retry job ${job.title}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              <RotateCcw className="h-3 w-3" aria-hidden="true" />
                              Retry
                            </button>
                          )}
                          {(job.status === 'queued' || job.status === 'paused') && (
                            <button
                              type="button"
                              onClick={() => onJobAction(job.id, 'cancel')}
                              aria-label={`Cancel job ${job.title}`}
                              className="rounded border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                            >
                              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
