import type { Product } from '../../types/workspace';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { ProductSelector } from './ProductSelector';
import { StepNavigator } from './StepNavigator';
import type { BuilderStep } from '../../types/workspace';

interface StudioHeaderProps {
  title: string;
  description: string;
  products: Product[];
  productId: string;
  creatingNew: boolean;
  step: BuilderStep;
  isStepComplete: (step: BuilderStep) => boolean;
  onProductChange: (value: string) => void;
  onStepChange: (step: BuilderStep) => void;
  onGoToTrends: () => void;
}

export function StudioHeader({
  title,
  description,
  products,
  productId,
  creatingNew,
  step,
  isStepComplete,
  onProductChange,
  onStepChange,
  onGoToTrends,
}: StudioHeaderProps) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-text sm:text-lg">{title}</h2>
            <p className="mt-0.5 text-xs text-text-muted">{description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ProductSelector
              products={products}
              productId={productId}
              creatingNew={creatingNew}
              onChange={onProductChange}
            />
            <Button variant="outline" size="md" onClick={onGoToTrends} className="whitespace-nowrap">
              Find Niche in Trends
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <StepNavigator
            step={step}
            creatingNew={creatingNew}
            isStepComplete={isStepComplete}
            onStepChange={onStepChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
