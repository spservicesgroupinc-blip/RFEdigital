import { ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { AssetPreviewImage } from '../AssetPreviewImage';
import type { Product, ProductStatus, Series, StorageAsset } from '../../types/workspace';
import type { BuilderStep, ModuleId } from '../../types/workspace';

interface ProductTableProps {
  products: Product[];
  filtered: Product[];
  series: Series[];
  assets: StorageAsset[];
  selectedProduct: Product | null;
  onSelect: (id: string) => void;
  onOpenBuilder: (id: string, step?: BuilderStep) => void;
  onOpenIllustration: (id: string) => void;
  onDelete: (product: Product) => void;
  onAddProduct: () => void;
}

const CATEGORY_LABELS: Record<Product['category'], string> = {
  'childrens-book': "Children's Book",
  'coloring-book': 'Coloring Book',
  'art-print': 'Art Print',
  journal: 'Journal',
};

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Draft',
  'in-production': 'In Production',
  'ready-for-kdp': 'Ready for KDP',
  published: 'Published',
};

const STATUS_VARIANTS: Record<ProductStatus, 'default' | 'primary' | 'success' | 'warning'> = {
  draft: 'default',
  'in-production': 'warning',
  'ready-for-kdp': 'primary',
  published: 'success',
};

export function ProductTable({
  filtered,
  series,
  assets,
  selectedProduct,
  onSelect,
  onOpenBuilder,
  onOpenIllustration,
  onDelete,
  onAddProduct,
}: ProductTableProps) {
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const findCover = (product: Product) =>
    (product.coverAssetId ? assets.find((a) => a.id === product.coverAssetId) : undefined) ??
    assets.find((a) => a.productId === product.id);

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No matching products"
        description="Adjust your search filter or add a new digital book or art bundle."
        action={{ label: 'Add Product', onClick: onAddProduct }}
      />
    );
  }

  return (
    <>
      {/* Mobile card list */}
      <div className="divide-y divide-border md:hidden">
        {filtered.map((product) => {
          const cover = findCover(product);
          const productSeries = product.seriesId ? seriesById.get(product.seriesId) : null;
          const isSelected = selectedProduct?.id === product.id;
          return (
            <div
              key={product.id}
              className={`p-4 transition-colors ${isSelected ? 'bg-primary-subtle/40' : 'bg-surface'}`}
            >
              <div className="flex items-start gap-3">
                <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-tertiary">
                  <AssetPreviewImage src={cover?.url} alt={`${product.title} cover preview`} />
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSelect(product.id)}
                    className="block w-full truncate text-left text-sm font-semibold text-text hover:text-primary"
                  >
                    {product.title}
                  </button>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                    <span>{CATEGORY_LABELS[product.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{product.trimSize}&quot;</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{product.pageCount} pp</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <StatusBadge status={product.status} />
                    <span className="truncate text-text-muted">
                      {productSeries ? productSeries.name : 'Standalone'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2 border-t border-border-subtle pt-2.5">
                <Button
                  variant="primary"
                  size="sm"
                  trailingIcon={<ArrowRight className="h-3 w-3" />}
                  onClick={() => onOpenBuilder(product.id)}
                >
                  Continue
                </Button>
                <Button variant="outline" size="sm" onClick={() => onOpenIllustration(product.id)}>
                  Studio
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(product)}
                  aria-label={`Delete ${product.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface-tertiary/70 text-xs font-medium text-text-muted">
              <th className="px-4 py-3">Product</th>
              <th className="px-3 py-3">Format & Trim</th>
              <th className="px-3 py-3 text-right">Pages</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {filtered.map((product) => {
              const cover = findCover(product);
              const productSeries = product.seriesId ? seriesById.get(product.seriesId) : null;
              const isSelected = selectedProduct?.id === product.id;
              return (
                <tr
                  key={product.id}
                  className={`transition-colors ${
                    isSelected ? 'bg-primary-subtle/40' : 'hover:bg-surface-secondary/80'
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-surface-tertiary">
                        <AssetPreviewImage src={cover?.url} alt={`${product.title} cover preview`} />
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => onSelect(product.id)}
                          className="block max-w-[190px] truncate text-left font-medium text-text hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 2xl:max-w-[260px]"
                        >
                          {product.title}
                        </button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                          <span>{productSeries ? productSeries.name : 'Standalone'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{product.isbn}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-xs text-text-secondary">
                    <div>{CATEGORY_LABELS[product.category]}</div>
                    <div className="mt-0.5 font-mono text-text-muted tabular-nums">
                      {product.trimSize}" {product.includeBleed ? '· Bleed' : '· No Bleed'}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-right font-mono text-xs text-text tabular-nums">
                    {product.pageCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5">
                    <StatusBadge status={product.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        trailingIcon={<ArrowRight className="h-3 w-3" />}
                        onClick={() => onOpenBuilder(product.id)}
                      >
                        Build
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(product)}
                        aria-label={`Delete ${product.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: ProductStatus }) {
  const label = STATUS_LABELS[status];
  const variant = STATUS_VARIANTS[status];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
        variant === 'default'
          ? 'bg-surface-tertiary text-text-secondary'
          : variant === 'primary'
            ? 'bg-primary-subtle text-primary-800'
            : variant === 'success'
              ? 'bg-success-subtle text-success-700'
              : 'bg-warning-subtle text-warning-700'
      }`}
    >
      {label}
    </span>
  );
}
