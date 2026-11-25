import { useState } from 'react';
import { ListPlus, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { BatchPlan, Product } from '../types/workspace';
import { PLAN_TEMPLATES } from '../lib/workspaceLogic';

interface PlanningViewProps {
  products: Product[];
  plans: BatchPlan[];
  activeProductId: string | null;
  onSelectProduct: (id: string) => void;
  onCreatePlan: (payload: {
    productId: string;
    name: string;
    templateId: string;
    steps: Array<{
      title: string;
      stepType: 'manuscript' | 'illustration' | 'export';
      prompt: string;
    }>;
  }) => Promise<void>;
  onGenerateOutline: (payload: {
    productId: string;
    brief: string;
    stepCount: number;
  }) => Promise<
    Array<{ title: string; stepType: 'manuscript' | 'illustration' | 'export'; prompt: string }>
  >;
  onQueuePlan: (planId: string) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
}

export function PlanningView({
  products,
  plans,
  activeProductId,
  onSelectProduct,
  onCreatePlan,
  onGenerateOutline,
  onQueuePlan,
  onDeletePlan,
}: PlanningViewProps) {
  const productId = activeProductId || products[0]?.id || '';
  const [selectedTemplateId, setSelectedTemplateId] = useState(PLAN_TEMPLATES[0].id);
  const [planName, setPlanName] = useState('Picture Book Production Batch');
  const [outlineBrief, setOutlineBrief] = useState(
    'A gentle twilight adventure about a young lantern bear discovering a harbor of floating paper boats.'
  );
  const [draftSteps, setDraftSteps] = useState(PLAN_TEMPLATES[0].starterSteps);
  const [busyAi, setBusyAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queuingId, setQueuingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const applyTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = PLAN_TEMPLATES.find((t) => t.id === tplId);
    if (tpl) {
      setPlanName(`${tpl.name.split('(')[0].trim()} Batch`);
      setDraftSteps(tpl.starterSteps.map((s) => ({ ...s })));
    }
  };

  const handleGenerateOutline = async () => {
    if (!productId) return;
    setError('');
    setBusyAi(true);
    try {
      const steps = await onGenerateOutline({
        productId,
        brief: outlineBrief,
        stepCount: 5,
      });
      setDraftSteps(steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Outline generation failed.');
    } finally {
      setBusyAi(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('Select a product for this batch plan.');
      return;
    }
    if (planName.trim().length < 2) {
      setError('Enter a plan name.');
      return;
    }
    if (draftSteps.length === 0) {
      setError('Add at least one production step.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await onCreatePlan({
        productId,
        name: planName.trim(),
        templateId: selectedTemplateId,
        steps: draftSteps,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save batch plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleQueuePlan = async (planId: string) => {
    setQueuingId(planId);
    try {
      await onQueuePlan(planId);
    } finally {
      setQueuingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Templates Row */}
      <section aria-label="KDP production templates">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Production Templates</h2>
          <span className="text-xs text-slate-500">Choose a starter blueprint for batch runs</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLAN_TEMPLATES.map((tpl) => {
            const active = selectedTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  active
                    ? 'border-blue-700 bg-blue-50/35'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">{tpl.name}</div>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-slate-500 tabular-nums">
                  <span>{tpl.trimSize}&quot;</span>
                  <span aria-hidden="true">·</span>
                  <span>{tpl.defaultPages} pages</span>
                  <span aria-hidden="true">·</span>
                  <span>{tpl.starterSteps.length} steps</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{tpl.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Batch Plan Builder */}
        <section className="rounded-lg border border-slate-200 bg-white p-6 xl:col-span-7">
          <h2 className="text-base font-semibold text-slate-900">Batch Plan Builder</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Compose ordered manuscript, illustration, and export steps, then push them into the background job queue.
          </p>

          <form onSubmit={handleCreatePlan} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="plan-product" className="block text-xs font-medium text-slate-700">
                  Target Product
                </label>
                <select
                  id="plan-product"
                  value={productId}
                  onChange={(e) => onSelectProduct(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="plan-name" className="block text-xs font-medium text-slate-700">
                  Plan Name
                </label>
                <input
                  id="plan-name"
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
            </div>

            {/* AI Outline Generator Strip */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <label htmlFor="outline-brief" className="block text-xs font-medium text-slate-700">
                AI Series Outline Brief
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id="outline-brief"
                  type="text"
                  value={outlineBrief}
                  onChange={(e) => setOutlineBrief(e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={busyAi || !productId}
                  onClick={handleGenerateOutline}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                  {busyAi ? 'Drafting Outline…' : 'Draft Steps with AI'}
                </button>
              </div>
            </div>

            {/* Editable Steps List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  Batch Steps ({draftSteps.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setDraftSteps((prev) => [
                      ...prev,
                      {
                        title: `Spread ${prev.length + 1} Illustration`,
                        stepType: 'illustration',
                        prompt: 'Storybook scene matching series palette and composition.',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add Step
                </button>
              </div>

              {draftSteps.map((step, idx) => (
                <div
                  key={`${step.title}-${idx}`}
                  className="rounded-md border border-slate-200 p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-400 tabular-nums">
                      0{idx + 1}
                    </span>
                    <input
                      type="text"
                      aria-label={`Step ${idx + 1} title`}
                      value={step.title}
                      onChange={(e) =>
                        setDraftSteps((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, title: e.target.value } : item
                          )
                        )
                      }
                      className="min-w-0 flex-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-900"
                    />
                    <select
                      aria-label={`Step ${idx + 1} type`}
                      value={step.stepType}
                      onChange={(e) =>
                        setDraftSteps((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? {
                                  ...item,
                                  stepType: e.target.value as
                                    | 'manuscript'
                                    | 'illustration'
                                    | 'export',
                                }
                              : item
                          )
                        )
                      }
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      <option value="manuscript">Manuscript</option>
                      <option value="illustration">Illustration</option>
                      <option value="export">Export PDF</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`Remove step ${idx + 1}`}
                      onClick={() =>
                        setDraftSteps((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    aria-label={`Step ${idx + 1} prompt`}
                    value={step.prompt}
                    onChange={(e) =>
                      setDraftSteps((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, prompt: e.target.value } : item
                        )
                      )
                    }
                    className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-700 focus:bg-white focus:outline-none"
                  />
                </div>
              ))}
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <ListPlus className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Saving Plan…' : 'Save Batch Plan'}
            </button>
          </form>
        </section>

        {/* Right Saved Batch Plans */}
        <section className="rounded-lg border border-slate-200 bg-white xl:col-span-5">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Saved Batch Plans{' '}
              <span className="ml-1 font-mono text-xs font-normal text-slate-500 tabular-nums">
                ({plans.length})
              </span>
            </h2>
          </div>

          {plans.length === 0 ? (
            <div className="px-6 py-14 text-center text-xs text-slate-500">
              No saved batch plans yet. Save a plan on the left to queue its steps.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {plans.map((plan) => {
                const product = products.find((p) => p.id === plan.productId);
                const unqueuedCount = plan.steps.filter((s) => !s.queued).length;
                return (
                  <article key={plan.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{plan.name}</h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>{product?.title ?? 'Unknown product'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{plan.trimSize}&quot;</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {plan.steps.length} steps
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeletePlan(plan.id)}
                        aria-label={`Delete plan ${plan.name}`}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <ol className="mt-3 space-y-1.5 text-xs text-slate-600">
                      {plan.steps.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            <span className="mr-1.5 font-mono text-slate-400 tabular-nums">
                              {s.order}.
                            </span>
                            {s.title}
                          </span>
                          <span
                            className={`shrink-0 text-[11px] font-medium ${
                              s.queued ? 'text-emerald-700' : 'text-slate-500'
                            }`}
                          >
                            {s.queued ? 'Queued' : 'Pending'}
                          </span>
                        </li>
                      ))}
                    </ol>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {unqueuedCount} step{unqueuedCount === 1 ? '' : 's'} ready to queue
                      </span>
                      <button
                        type="button"
                        disabled={unqueuedCount === 0 || queuingId === plan.id}
                        onClick={() => handleQueuePlan(plan.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-45 whitespace-nowrap shrink-0"
                      >
                        <Play className="h-3 w-3" aria-hidden="true" />
                        {queuingId === plan.id ? 'Queuing…' : 'Queue Batch Jobs'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
