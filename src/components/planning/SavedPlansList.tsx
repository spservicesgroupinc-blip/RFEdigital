import { Pencil, Play, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import type { BatchPlan, Product } from '../../types/workspace';

interface SavedPlansListProps {
  plans: BatchPlan[];
  products: Product[];
  queuingId: string | null;
  onEdit: (plan: BatchPlan) => void;
  onQueue: (planId: string) => void;
  onDelete: (planId: string) => void;
}

export function SavedPlansList({
  plans,
  products,
  queuingId,
  onEdit,
  onQueue,
  onDelete,
}: SavedPlansListProps) {
  return (
    <Card variant="default" className="h-fit">
      <CardHeader>
        <CardTitle>
          Saved Batch Plans{' '}
          <span className="ml-1 font-mono text-xs font-normal text-text-muted tabular-nums">
            ({plans.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {plans.length === 0 ? (
          <EmptyState
            title="No saved plans yet"
            description="Save a plan on the left to queue its steps."
          />
        ) : (
          <div className="divide-y divide-border">
            {plans.map((plan) => {
              const product = products.find((p) => p.id === plan.productId);
              const unqueuedCount = plan.steps.filter((s) => !s.queued).length;
              return (
                <article key={plan.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-text">{plan.name}</h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                        <span>{product?.title ?? 'Unknown product'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{plan.trimSize}&quot;</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{plan.steps.length} steps</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(plan.id)}
                      aria-label={`Delete plan ${plan.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>

                  <ol className="mt-3 space-y-1.5 text-xs text-text-secondary">
                    {plan.steps.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          <span className="mr-1.5 font-mono text-text-muted tabular-nums">
                            {s.order}.
                          </span>
                          {s.title}
                        </span>
                        <Badge variant={s.queued ? 'success' : 'muted'} size="sm">
                          {s.queued ? 'Queued' : 'Pending'}
                        </Badge>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                    <span className="text-xs text-text-muted tabular-nums">
                      {unqueuedCount} step{unqueuedCount === 1 ? '' : 's'} ready to queue
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        leadingIcon={<Pencil className="h-3 w-3" />}
                        onClick={() => onEdit(plan)}
                      >
                        Edit Prompts
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        leadingIcon={<Play className="h-3 w-3" />}
                        disabled={unqueuedCount === 0 || queuingId === plan.id}
                        onClick={() => onQueue(plan.id)}
                        isLoading={queuingId === plan.id}
                      >
                        Queue Batch Jobs
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
