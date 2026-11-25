import { useEffect, useState } from 'react';
import { ListPlus, Pencil, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { BatchPlan, KdpTrimSize, Product, ProductCategory } from '../types/workspace';
import {
  PLAN_TEMPLATES,
  buildPlanStepsFromPromptPack,
  buildPromptPackFromConcept,
} from '../lib/workspaceLogic';

interface PlanningViewProps {
  products: Product[];
  plans: BatchPlan[];
  activeProductId: string | null;
  onSelectProduct: (id: string) => void;
  onQuickCreateProduct: (payload: {
    title: string;
    category: ProductCategory;
    trimSize: KdpTrimSize;
    pageCount: number;
  }) => Promise<Product>;
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
  onUpdatePlan: (
    planId: string,
    payload: {
      name: string;
      steps: Array<{
        title: string;
        stepType: 'manuscript' | 'illustration' | 'export';
        prompt: string;
      }>;
    }
  ) => Promise<void>;
  onGenerateOutline: (payload: {
    productId?: string;
    productTitle?: string;
    category?: ProductCategory;
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
  onQuickCreateProduct,
  onCreatePlan,
  onUpdatePlan,
  onGenerateOutline,
  onQueuePlan,
  onDeletePlan,
}: PlanningViewProps) {
  const productId = activeProductId || products[0]?.id || '';
  const selectedProduct = products.find((p) => p.id === productId) ?? null;

  const [selectedTemplateId, setSelectedTemplateId] = useState(PLAN_TEMPLATES[0].id);
  const [creatingNewProduct, setCreatingNewProduct] = useState(false);
  const [newProductTitle, setNewProductTitle] = useState('');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planName, setPlanName] = useState('Picture Book Production Batch');
  const [outlineBrief, setOutlineBrief] = useState('');
  const [draftSteps, setDraftSteps] = useState(PLAN_TEMPLATES[0].starterSteps);
  const [busyAi, setBusyAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [queuingId, setQueuingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Auto-populate Batch Plan Builder with the selected product's editable prompts or latest plan
  useEffect(() => {
    if (!selectedProduct || creatingNewProduct) return;
    const existingPlan = plans.find((p) => p.productId === selectedProduct.id);
    if (existingPlan) {
      setEditingPlanId(existingPlan.id);
      setPlanName(existingPlan.name);
      setDraftSteps(
        existingPlan.steps.map((s) => ({
          title: s.title,
          stepType: s.stepType,
          prompt: s.prompt,
        }))
      );
      return;
    }
    setEditingPlanId(null);
    const effectivePack =
      selectedProduct.promptPack ??
      buildPromptPackFromConcept({
        title: selectedProduct.title,
        subtitle: selectedProduct.subtitle,
        category: selectedProduct.category,
        trimSize: selectedProduct.trimSize,
        pageCount: selectedProduct.pageCount,
        concept: selectedProduct.manuscriptNotes || selectedProduct.subtitle || selectedProduct.title,
      });
    setPlanName(`${selectedProduct.title.slice(0, 62)} — Production Batch`);
    setDraftSteps(buildPlanStepsFromPromptPack(selectedProduct, effectivePack));
  }, [selectedProduct?.id, creatingNewProduct]);

  const showNewProductInput = products.length === 0 || creatingNewProduct;
  const activeTemplate =
    PLAN_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? PLAN_TEMPLATES[0];

  const applyTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = PLAN_TEMPLATES.find((t) => t.id === tplId);
    if (tpl) {
      setPlanName(`${tpl.name.split('(')[0].trim()} Batch`);
      setDraftSteps(tpl.starterSteps.map((s) => ({ ...s })));
    }
  };

  const handleGenerateOutline = async () => {
    if (outlineBrief.trim().length < 5) {
      setError('Enter a short concept or theme in AI Series Outline Brief first (min 5 characters).');
      return;
    }
    setError('');
    setBusyAi(true);
    try {
      const steps = await onGenerateOutline({
        productId: showNewProductInput ? undefined : productId || undefined,
        productTitle: showNewProductInput
          ? newProductTitle.trim() || planName.trim() || 'New Digital Product'
          : undefined,
        category: activeTemplate.category,
        brief: outlineBrief.trim(),
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
    if (showNewProductInput && newProductTitle.trim().length < 2) {
      setError('Enter a product title (at least 2 characters) to create your product and save this plan.');
      return;
    }
    if (!showNewProductInput && !productId) {
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
      let targetProductId = productId;
      if (showNewProductInput) {
        const created = await onQuickCreateProduct({
          title: newProductTitle.trim(),
          category: activeTemplate.category,
          trimSize: activeTemplate.trimSize,
          pageCount: activeTemplate.defaultPages,
        });
        targetProductId = created.id;
        setCreatingNewProduct(false);
        setNewProductTitle('');
      }

      if (editingPlanId && !showNewProductInput) {
        await onUpdatePlan(editingPlanId, {
          name: planName.trim(),
          steps: draftSteps,
        });
      } else {
        await onCreatePlan({
          productId: targetProductId,
          name: planName.trim(),
          templateId: selectedTemplateId,
          steps: draftSteps,
        });
      }
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
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={showNewProductInput ? 'plan-new-product' : 'plan-product'}
                    className="block text-xs font-medium text-slate-700"
                  >
                    {showNewProductInput ? 'New Product Title' : 'Target Product'}
                  </label>
                  {products.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCreatingNewProduct((prev) => !prev)}
                      className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                    >
                      {creatingNewProduct ? 'Choose existing' : '+ New product'}
                    </button>
                  )}
                </div>

                {showNewProductInput ? (
                  <div className="mt-1">
                    <input
                      id="plan-new-product"
                      type="text"
                      value={newProductTitle}
                      onChange={(e) => setNewProductTitle(e.target.value)}
                      placeholder="e.g., Zebo The Dog"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Automatically creates this product in Library when you save the plan.
                    </p>
                  </div>
                ) : (
                  <select
                    id="plan-product"
                    value={productId}
                    onChange={(e) => onSelectProduct(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                )}
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
                  placeholder="Describe your book concept, audience, or theme to draft production steps…"
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={busyAi}
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

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <ListPlus className="h-4 w-4" aria-hidden="true" />
                {saving
                  ? 'Saving Plan…'
                  : editingPlanId && !showNewProductInput
                    ? 'Update Plan Prompts'
                    : 'Save Batch Plan'}
              </button>
              {editingPlanId && !showNewProductInput && (
                <button
                  type="button"
                  onClick={() => setEditingPlanId(null)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Save as new plan instead
                </button>
              )}
            </div>
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

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {unqueuedCount} step{unqueuedCount === 1 ? '' : 's'} ready to queue
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCreatingNewProduct(false);
                            onSelectProduct(plan.productId);
                            setEditingPlanId(plan.id);
                            setPlanName(plan.name);
                            setDraftSteps(
                              plan.steps.map((s) => ({
                                title: s.title,
                                stepType: s.stepType,
                                prompt: s.prompt,
                              }))
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                        >
                          <Pencil className="h-3 w-3" aria-hidden="true" />
                          Edit Prompts
                        </button>
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
