import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

export interface PlanStepDraft {
  title: string;
  stepType: 'manuscript' | 'illustration' | 'export';
  prompt: string;
}

interface PlanStepEditorProps {
  steps: PlanStepDraft[];
  onChange: (steps: PlanStepDraft[]) => void;
}

export function PlanStepEditor({ steps, onChange }: PlanStepEditorProps) {
  const addStep = () =>
    onChange([
      ...steps,
      {
        title: `Spread ${steps.length + 1} Illustration`,
        stepType: 'illustration',
        prompt: 'Storybook scene matching series palette and composition.',
      },
    ]);

  const updateStep = <K extends keyof PlanStepDraft>(index: number, key: K, value: PlanStepDraft[K]) => {
    onChange(steps.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary">
          Batch Steps ({steps.length})
        </span>
        <Button variant="ghost" size="sm" leadingIcon={<Plus className="h-3.5 w-3.5" />} onClick={addStep}>
          Add Step
        </Button>
      </div>
      {steps.map((step, idx) => (
        <div
          key={`${step.title}-${idx}`}
          className="rounded-md border border-border bg-surface-secondary p-3.5 transition-colors focus-within:border-primary-200"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-text-muted tabular-nums">0{idx + 1}</span>
            <Input
              type="text"
              aria-label={`Step ${idx + 1} title`}
              value={step.title}
              onChange={(e) => updateStep(idx, 'title', e.target.value)}
              className="min-w-0 flex-1 text-xs font-medium"
            />
            <Select
              aria-label={`Step ${idx + 1} type`}
              value={step.stepType}
              onChange={(e) =>
                updateStep(idx, 'stepType', e.target.value as PlanStepDraft['stepType'])
              }
              className="w-auto text-xs"
            >
              <option value="manuscript">Manuscript</option>
              <option value="illustration">Illustration</option>
              <option value="export">Export PDF</option>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove step ${idx + 1}`}
              onClick={() => removeStep(idx)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
          <Textarea
            rows={2}
            aria-label={`Step ${idx + 1} prompt`}
            value={step.prompt}
            onChange={(e) => updateStep(idx, 'prompt', e.target.value)}
            className="mt-2 text-xs"
          />
        </div>
      ))}
    </div>
  );
}
