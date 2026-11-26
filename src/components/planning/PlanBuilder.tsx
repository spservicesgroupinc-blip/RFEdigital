import { ListPlus, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { PlanStepEditor, type PlanStepDraft } from './PlanStepEditor';
import type { KdpTrimSize, Product, ProductCategory } from '../../types/workspace';

interface PlanBuilderProps {
  products: Product[];
  productId: string;
  selectedProduct: Product | null;
  showNewProductInput: boolean;
  creatingNewProduct: boolean;
  newProductTitle: string;
  editingPlanId: string | null;
  planName: string;
  outlineBrief: string;
  draftSteps: PlanStepDraft[];
  busyAi: boolean;
  saving: boolean;
  error: string;
  activeTemplate: {
    category: ProductCategory;
    trimSize: KdpTrimSize;
    defaultPages: number;
  };
  onSelectProduct: (id: string) => void;
  onToggleNewProduct: () => void;
  onNewProductTitleChange: (value: string) => void;
  onPlanNameChange: (value: string) => void;
  onOutlineBriefChange: (value: string) => void;
  onDraftStepsChange: (steps: PlanStepDraft[]) => void;
  onGenerateOutline: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onSaveAsNew: () => void;
}

export function PlanBuilder({
  products,
  productId,
  selectedProduct,
  showNewProductInput,
  creatingNewProduct,
  newProductTitle,
  editingPlanId,
  planName,
  outlineBrief,
  draftSteps,
  busyAi,
  saving,
  error,
  activeTemplate,
  onSelectProduct,
  onToggleNewProduct,
  onNewProductTitleChange,
  onPlanNameChange,
  onOutlineBriefChange,
  onDraftStepsChange,
  onGenerateOutline,
  onSubmit,
  onSaveAsNew,
}: PlanBuilderProps) {
  return (
    <Card variant="default" className="h-fit">
      <CardContent>
        <h2 className="font-display text-base font-semibold text-text">Batch Plan Builder</h2>
        <p className="mt-0.5 text-xs text-text-muted">
          Compose ordered manuscript, illustration, and export steps, then push them into the background job
          queue.
        </p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor={showNewProductInput ? 'plan-new-product' : 'plan-product'}
                  className="block text-xs font-medium text-text-secondary"
                >
                  {showNewProductInput ? 'New Product Title' : 'Target Product'}
                </label>
                {products.length > 0 && (
                  <button
                    type="button"
                    onClick={onToggleNewProduct}
                    className="text-xs font-medium text-primary hover:text-primary-hover whitespace-nowrap"
                  >
                    {creatingNewProduct ? 'Choose existing' : '+ New product'}
                  </button>
                )}
              </div>

              {showNewProductInput ? (
                <div className="mt-1">
                  <Input
                    id="plan-new-product"
                    type="text"
                    value={newProductTitle}
                    onChange={(e) => onNewProductTitleChange(e.target.value)}
                    placeholder="e.g., Zebo The Dog"
                  />
                  <p className="mt-1 text-[11px] text-text-muted">
                    Automatically creates this product in Library when you save the plan.
                  </p>
                </div>
              ) : (
                <Select
                  id="plan-product"
                  value={productId}
                  onChange={(e) => onSelectProduct(e.target.value)}
                  className="mt-1"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div>
              <label htmlFor="plan-name" className="block text-xs font-medium text-text-secondary">
                Plan Name
              </label>
              <Input
                id="plan-name"
                type="text"
                value={planName}
                onChange={(e) => onPlanNameChange(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* AI Outline Generator Strip */}
          <div className="rounded-md border border-border bg-surface-secondary p-4">
            <label htmlFor="outline-brief" className="block text-xs font-medium text-text-secondary">
              AI Series Outline Brief
            </label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <Input
                id="outline-brief"
                type="text"
                value={outlineBrief}
                onChange={(e) => onOutlineBriefChange(e.target.value)}
                placeholder="Describe your book concept, audience, or theme to draft production steps…"
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={busyAi}
                onClick={onGenerateOutline}
                leadingIcon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
              >
                {busyAi ? 'Drafting Outline…' : 'Draft Steps with AI'}
              </Button>
            </div>
          </div>

          <PlanStepEditor steps={draftSteps} onChange={onDraftStepsChange} />

          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saving}
              isLoading={saving}
              leadingIcon={<ListPlus className="h-4 w-4" />}
            >
              {editingPlanId && !showNewProductInput ? 'Update Plan Prompts' : 'Save Batch Plan'}
            </Button>
            {editingPlanId && !showNewProductInput && (
              <button
                type="button"
                onClick={onSaveAsNew}
                className="text-xs font-medium text-text-secondary hover:text-text"
              >
                Save as new plan instead
              </button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
