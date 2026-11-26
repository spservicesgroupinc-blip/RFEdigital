import { Card, CardContent } from '../ui/Card';
import type { PlanTemplate } from '../../types/workspace';

interface TemplateCardsProps {
  templates: PlanTemplate[];
  selectedTemplateId: string;
  onSelect: (id: string) => void;
}

export function TemplateCards({ templates, selectedTemplateId, onSelect }: TemplateCardsProps) {
  return (
    <section aria-label="KDP production templates">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-text">Production Templates</h2>
        <span className="text-xs text-text-muted">Choose a starter blueprint for batch runs</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {templates.map((tpl) => {
          const active = selectedTemplateId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onSelect(tpl.id)}
              aria-pressed={active}
              className={`rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
                active
                  ? 'border-primary bg-primary-subtle/40'
                  : 'border-border bg-surface hover:border-border-strong'
              }`}
            >
              <div className="text-sm font-semibold text-text">{tpl.name}</div>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-text-muted tabular-nums">
                <span>{tpl.trimSize}&quot;</span>
                <span aria-hidden="true">·</span>
                <span>{tpl.defaultPages} pages</span>
                <span aria-hidden="true">·</span>
                <span>{tpl.starterSteps.length} steps</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">{tpl.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
