import type { ReactNode } from 'react';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
}

export function KpiCard({ label, value, hint, trend }: KpiCardProps) {
  return (
    <div className="bg-surface px-5 py-4">
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="font-mono text-2xl font-semibold text-text tabular-nums">{value}</div>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.positive ? 'text-success' : 'text-text-muted'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {hint && <div className="mt-0.5 text-xs text-text-muted">{hint}</div>}
    </div>
  );
}
