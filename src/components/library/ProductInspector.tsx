import { ArrowRight, ImagePlus, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { AssetPreviewImage } from '../AssetPreviewImage';
import type {
  BuilderStep,
  ExportArtifact,
  GenerationRecord,
  Product,
  ProductStatus,
  Series,
  StorageAsset,
  WorkspaceSettings,
} from '../../types/workspace';
import { computeProductReadiness } from '../../lib/workspaceLogic';

interface ProductInspectorProps {
  product: Product;
  series: Series[];
  assets: StorageAsset[];
  generations: GenerationRecord[];
  exportsList: ExportArtifact[];
  settings: WorkspaceSettings;
  uploadingPhoto: boolean;
  onUpdateStatus: (status: ProductStatus) => void;
  onOpenBuilder: (step?: BuilderStep) => void;
  onOpenIllustration: () => void;
  onOpenFiles: () => void;
  onOpenExport: () => void;
  onReplacePhoto: () => void;
}

const CATEGORY_LABELS: Record<Product['category'], string> = {
  'childrens-book': "Children's Book",
  'coloring-book': 'Coloring Book',
  'art-print': 'Art Print',
  journal: 'Journal',
};

function toStudioStep(step: 1 | 2 | 3 | 4): BuilderStep {
  if (step === 4) return 3;
  if (step === 3) return 2;
  return step;
}

export function ProductInspector({
  product,
  series,
  assets,
  generations,
  exportsList,
  uploadingPhoto,
  onUpdateStatus,
  onOpenBuilder,
  onOpenIllustration,
  onOpenFiles,
  onOpenExport,
  onReplacePhoto,
}: ProductInspectorProps) {
  const seriesName = series.find((s) => s.id === product.seriesId)?.name ?? 'Standalone';
  const referenceAsset = product.referenceAssetId
    ? assets.find((a) => a.id === product.referenceAssetId)
    : null;
  const productAssets = assets.filter((a) => a.productId === product.id);

  const readiness = computeProductReadiness(product, assets, generations, exportsList);

  const coverUrl = product.coverAssetId
    ? assets.find((a) => a.id === product.coverAssetId)?.url
    : productAssets[0]?.url;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <div className="h-28 w-22 shrink-0 overflow-hidden rounded-md border border-border bg-surface-tertiary">
          <AssetPreviewImage src={coverUrl ?? null} alt={`${product.title} cover`} fallbackLabel={product.title} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-text">{product.title}</h3>
          {product.subtitle && <p className="mt-1 text-xs text-text-secondary">{product.subtitle}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            <span>{CATEGORY_LABELS[product.category]}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{product.trimSize}"</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{product.pageCount} pp</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border-subtle pt-4">
        <label htmlFor="inspector-status" className="block text-xs font-medium text-text-secondary">
          Production Stage
        </label>
        <Select
          id="inspector-status"
          value={product.status}
          onChange={(e) => onUpdateStatus(e.target.value as ProductStatus)}
          className="mt-1.5"
        >
          <option value="draft">Draft</option>
          <option value="in-production">In Production</option>
          <option value="ready-for-kdp">Ready for KDP</option>
          <option value="published">Published</option>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs font-medium text-text-secondary">
          <span>Manuscript & Editorial Notes</span>
          <span className="font-mono text-text-muted tabular-nums">{productAssets.length} assets</span>
        </div>
        <p className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface-secondary p-3 text-xs leading-relaxed text-text-secondary">
          {product.manuscriptNotes || 'No manuscript text yet. Generate story copy or KDP blurbs in the Generation studio.'}
        </p>
      </div>

      {referenceAsset ? (
        <div className="rounded-md border border-border bg-surface-secondary p-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
              <AssetPreviewImage src={referenceAsset.url} alt={`${product.title} reference photo`} fallbackLabel="Photo" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-text">Reference Photo Attached</div>
              <p className="mt-0.5 text-[11px] text-text-muted">
                Ready for OpenRouter photo-to-cartoon &amp; storybook illustration.
              </p>
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={onReplacePhoto}
                className="mt-1 text-[11px] font-medium text-primary hover:text-primary-hover disabled:opacity-50"
              >
                {uploadingPhoto ? 'Uploading…' : 'Replace photo'}
              </button>
            </div>
          </div>
          <Button
            variant="primary"
            size="md"
            leadingIcon={<Sparkles className="h-3.5 w-3.5" />}
            onClick={onOpenIllustration}
            className="mt-2.5 w-full"
          >
            Generate Cartoon / Illustration from Photo
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border-strong bg-surface-secondary/70 p-3">
          <div className="text-xs font-medium text-text">Add a Reference Photo (Optional)</div>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Upload a photo of a pet or character to generate cartoon illustrations via OpenRouter.
          </p>
          <Button
            variant="outline"
            size="md"
            leadingIcon={<ImagePlus className="h-3.5 w-3.5" />}
            onClick={onReplacePhoto}
            disabled={uploadingPhoto}
            className="mt-2 w-full"
          >
            {uploadingPhoto ? 'Uploading photo…' : 'Upload Reference Photo'}
          </Button>
        </div>
      )}

      <div className="space-y-3 border-t border-border-subtle pt-4">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Workflow Progress</span>
          <span className="font-mono font-medium text-text tabular-nums">
            {readiness.completedMilestones} / {readiness.totalMilestones} steps
          </span>
        </div>
        <Button
          variant="primary"
          size="md"
          trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          onClick={() => onOpenBuilder(toStudioStep(readiness.recommendedStep))}
          className="w-full"
        >
          Continue Building — {readiness.nextActionLabel}
        </Button>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={onOpenIllustration}>
            Studio
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenFiles}>
            Files
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenExport}>
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
