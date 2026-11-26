import { Check } from 'lucide-react';
import type { BuilderStep } from '../../types/workspace';

interface StepNavigatorProps {
  step: BuilderStep;
  creatingNew: boolean;
  isStepComplete: (step: BuilderStep) => boolean;
  onStepChange: (step: BuilderStep) => void;
}

const STEP_META: Array<{ step: BuilderStep; title: string; short: string }> = [
  { step: 1, title: '1. Concept', short: '1. Concept' },
  { step: 2, title: '2. Generate', short: '2. Generate' },
  { step: 3, title: '3. Download', short: '3. Download' },
];

export function StepNavigator({ step, creatingNew, isStepComplete, onStepChange }: StepNavigatorProps) {
  return (
    <nav
      aria-label="Studio tabs"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      role="tablist"
    >
      {STEP_META.map((item) => {
        const active = step === item.step;
        const done = isStepComplete(item.step);
        const disabled = creatingNew && item.step > 1;

        return (
          <button
            key={item.step}
            type="button"
            role="tab"
            disabled={disabled}
            aria-current={active ? 'step' : undefined}
            aria-selected={active}
            onClick={() => onStepChange(item.step)}
            className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              active
                ? 'border-primary bg-primary-subtle text-primary-900'
                : done
                  ? 'border-border bg-surface-secondary text-text hover:border-border-strong'
                  : 'border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-surface-secondary'
            }`}
          >
            <span className="truncate sm:hidden">{item.short}</span>
            <span className="hidden truncate sm:inline">{item.title}</span>
            {done && !active && (
              <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
