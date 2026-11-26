import { useEffect, useState } from 'react';
import type { BatchPlan, KdpTrimSize, Product, ProductCategory } from '../types/workspace';
import {
  PLAN_TEMPLATES,
  buildPlanStepsFromPromptPack,
  buildPromptPackFromConcept,
} from '../lib/workspaceLogic';
import { TemplateCards, PlanBuilder, SavedPlansList } from './planning';
import type { PlanStepDraft } from './planning';

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
  const [draftSteps, setDraftSteps] = useState<PlanStepDraft[]>(PLAN_TEMPLATES[0].starterSteps);
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

  const handleEditPlan = (plan: BatchPlan) => {
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
  };

  return (
    <div className="space-y-6">
      <TemplateCards
        templates={PLAN_TEMPLATES}
        selectedTemplateId={selectedTemplateId}
        onSelect={applyTemplate}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="xl:col-span-7">
          <PlanBuilder
            products={products}
            productId={productId}
            selectedProduct={selectedProduct}
            showNewProductInput={showNewProductInput}
            creatingNewProduct={creatingNewProduct}
            newProductTitle={newProductTitle}
            editingPlanId={editingPlanId}
            planName={planName}
            outlineBrief={outlineBrief}
            draftSteps={draftSteps}
            busyAi={busyAi}
            saving={saving}
            error={error}
            activeTemplate={activeTemplate}
            onSelectProduct={onSelectProduct}
            onToggleNewProduct={() => setCreatingNewProduct((prev) => !prev)}
            onNewProductTitleChange={setNewProductTitle}
            onPlanNameChange={setPlanName}
            onOutlineBriefChange={setOutlineBrief}
            onDraftStepsChange={setDraftSteps}
            onGenerateOutline={handleGenerateOutline}
            onSubmit={handleCreatePlan}
            onSaveAsNew={() => setEditingPlanId(null)}
          />
        </section>

        <section className="xl:col-span-5">
          <SavedPlansList
            plans={plans}
            products={products}
            queuingId={queuingId}
            onEdit={handleEditPlan}
            onQueue={handleQueuePlan}
            onDelete={onDeletePlan}
          />
        </section>
      </div>
    </div>
  );
}
