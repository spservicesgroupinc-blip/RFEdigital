import { useMemo, useState } from 'react';
import {
  BookPlus,
  ExternalLink,
  FolderOpen,
  Search,
  Sheet,
  Trash2,
  X,
} from 'lucide-react';
import type {
  KdpTrimSize,
  ModuleId,
  Product,
  ProductCategory,
  ProductStatus,
  Series,
  StorageAsset,
  WorkspaceSettings,
} from '../types/workspace';
import { filterProducts, validateProductInput } from '../lib/workspaceLogic';
import { AssetPreviewImage } from './AssetPreviewImage';
import { ConfirmDialog } from './ConfirmDialog';

interface LibraryViewProps {
  products: Product[];
  series: Series[];
  assets: StorageAsset[];
  settings: WorkspaceSettings;
  googleConnected: boolean;
  onCreateProduct: (payload: {
    title: string;
    subtitle: string;
    category: ProductCategory;
    status: ProductStatus;
    trimSize: KdpTrimSize;
    pageCount: number;
    includeBleed: boolean;
    seriesId: string | null;
    isbn: string;
    manuscriptNotes: string;
  }) => Promise<void>;
  onUpdateProduct: (id: string, payload: Partial<Product>) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onCreateSeries: (payload: {
    name: string;
    description: string;
    targetAge: string;
    marketplace: Series['marketplace'];
  }) => Promise<void>;
  onSyncGoogleSheets: () => Promise<void>;
  onBootstrapGoogleSheet: () => Promise<void>;
  onOpenModuleForProduct: (module: ModuleId, productId: string) => void;
  showNewProductModal: boolean;
  onCloseNewProductModal: () => void;
  onOpenNewProductModal: () => void;
}

const CATEGORY_LABELS: Record<ProductCategory, string> = {
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

const STATUS_TEXT_CLASS: Record<ProductStatus, string> = {
  draft: 'text-slate-600',
  'in-production': 'text-amber-700',
  'ready-for-kdp': 'text-blue-700',
  published: 'text-emerald-700',
};

export function LibraryView({
  products,
  series,
  assets,
  settings,
  googleConnected,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onCreateSeries,
  onSyncGoogleSheets,
  onBootstrapGoogleSheet,
  onOpenModuleForProduct,
  showNewProductModal,
  onCloseNewProductModal,
  onOpenNewProductModal,
}: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    products[0]?.id ?? null
  );
  const [showSeriesModal, setShowSeriesModal] = useState(false);

  // New Product Form State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<ProductCategory>('childrens-book');
  const [trimSize, setTrimSize] = useState<KdpTrimSize>('8.5x8.5');
  const [pageCount, setPageCount] = useState('24');
  const [includeBleed, setIncludeBleed] = useState(true);
  const [seriesId, setSeriesId] = useState('');
  const [isbn, setIsbn] = useState('');
  const [manuscriptNotes, setManuscriptNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // New Series Form State
  const [seriesName, setSeriesName] = useState('');
  const [seriesDesc, setSeriesDesc] = useState('');
  const [seriesAge, setSeriesAge] = useState('Ages 4–8');
  const [seriesMarketplace, setSeriesMarketplace] = useState<Series['marketplace']>('Amazon KDP');
  const [seriesError, setSeriesError] = useState('');

  // Confirmation modal state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'primary' | 'danger';
    action: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const filtered = useMemo(
    () => filterProducts(products, query, categoryFilter, statusFilter),
    [products, query, categoryFilter, statusFilter]
  );

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) ?? filtered[0] ?? null;

  const assetById = useMemo(() => {
    const map = new Map<string, StorageAsset>();
    for (const a of assets) map.set(a.id, a);
    return map;
  }, [assets]);

  const seriesById = useMemo(() => {
    const map = new Map<string, Series>();
    for (const s of series) map.set(s.id, s);
    return map;
  }, [series]);

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPages = Number(pageCount);
    const check = validateProductInput({
      title,
      pageCount: parsedPages,
      category,
      trimSize,
    });
    if (!check.valid) {
      setFormErrors(check.errors);
      return;
    }

    setSubmitting(true);
    setFormErrors({});
    try {
      await onCreateProduct({
        title: title.trim(),
        subtitle: subtitle.trim(),
        category,
        status: 'draft',
        trimSize,
        pageCount: parsedPages,
        includeBleed,
        seriesId: seriesId || null,
        isbn: isbn.trim(),
        manuscriptNotes: manuscriptNotes.trim(),
      });
      setTitle('');
      setSubtitle('');
      setPageCount('24');
      setIsbn('');
      setManuscriptNotes('');
      setSeriesId('');
      onCloseNewProductModal();
    } catch (err) {
      setFormErrors({
        form: err instanceof Error ? err.message : 'Unable to save product.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeriesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (seriesName.trim().length < 2) {
      setSeriesError('Series name must be at least 2 characters.');
      return;
    }
    setSubmitting(true);
    setSeriesError('');
    try {
      await onCreateSeries({
        name: seriesName.trim(),
        description: seriesDesc.trim(),
        targetAge: seriesAge.trim(),
        marketplace: seriesMarketplace,
      });
      setSeriesName('');
      setSeriesDesc('');
      setShowSeriesModal(false);
    } catch (err) {
      setSeriesError(err instanceof Error ? err.message : 'Unable to create series.');
    } finally {
      setSubmitting(false);
    }
  };

  const runConfirmed = async () => {
    if (!confirmState) return;
    setConfirmBusy(true);
    try {
      await confirmState.action();
      setConfirmState(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const requestSheetSync = () => {
    if (!settings.connectedSpreadsheetId) {
      setConfirmState({
        open: true,
        title: 'Create FolioPress Library Spreadsheet in Google Sheets?',
        description:
          'This will create a new Google Spreadsheet with Products, Series, and Jobs tabs in your Google Drive.',
        confirmLabel: 'Create Spreadsheet',
        tone: 'primary',
        action: async () => {
          await onBootstrapGoogleSheet();
          await onSyncGoogleSheets();
        },
      });
      return;
    }

    setConfirmState({
      open: true,
      title: `Sync ${products.length} products to Google Sheets?`,
      description:
        'This will update rows in the Products and Jobs tabs of your connected Google Spreadsheet.',
      confirmLabel: 'Sync to Sheets',
      tone: 'primary',
      action: onSyncGoogleSheets,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top KPI summary bar (flat architectural row, zero nested cards) */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 lg:grid-cols-4">
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Catalog Titles</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {products.length}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Across {series.length} active series
          </div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Ready for KDP / Live</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {products.filter((p) => p.status === 'ready-for-kdp' || p.status === 'published').length}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Print specifications validated</div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Stored Media Assets</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {assets.length}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">Covers, spreads & line plates</div>
        </div>
        <div className="bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Google Sheets Library</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {settings.connectedSpreadsheetId ? 'Spreadsheet linked' : 'Not linked yet'}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={requestSheetSync}
              disabled={!googleConnected}
              className="font-medium text-blue-700 hover:text-blue-800 disabled:text-slate-400 whitespace-nowrap shrink-0"
            >
              {googleConnected
                ? settings.connectedSpreadsheetId
                  ? 'Sync Rows Now'
                  : 'Create & Sync Sheet'
                : 'Sign in on Identity tab'}
            </button>
            {settings.connectedSpreadsheetUrl && (
              <a
                href={settings.connectedSpreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                Open
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="library-search" className="sr-only">
              Search products
            </label>
            <input
              id="library-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, subtitle, or ISBN…"
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          <div
            className="flex items-center gap-1 rounded-md bg-slate-100 p-1"
            role="group"
            aria-label="Filter by product category"
          >
            {(
              [
                ['all', 'All'],
                ['childrens-book', 'Books'],
                ['coloring-book', 'Coloring'],
                ['art-print', 'Art Prints'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategoryFilter(value)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === value
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProductStatus | 'all')}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="in-production">In Production</option>
              <option value="ready-for-kdp">Ready for KDP</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSeriesModal(true)}
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            New Series
          </button>
          <button
            type="button"
            onClick={requestSheetSync}
            disabled={!googleConnected}
            title={
              googleConnected
                ? 'Sync product rows to Google Sheets'
                : 'Sign in with Google on the Identity tab to enable Sheets sync'
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sheet className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            Sync Sheets
          </button>
        </div>
      </div>

      {/* Main Split: Catalog Table + Selected Product Inspector */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section
          aria-label="Product catalog"
          className="overflow-hidden rounded-lg border border-slate-200 bg-white xl:col-span-8"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-base font-semibold text-slate-900">
              Products Catalog{' '}
              <span className="ml-1 font-mono text-xs font-normal text-slate-500 tabular-nums">
                ({filtered.length})
              </span>
            </h2>
            <span className="text-xs text-slate-500">
              {series.map((s) => s.name).slice(0, 2).join(' · ')}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm font-medium text-slate-900">No matching products found</p>
              <p className="mt-1 text-xs text-slate-500">
                Adjust your search filter or add a new digital book or art bundle.
              </p>
              <button
                type="button"
                onClick={onOpenNewProductModal}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <BookPlus className="h-4 w-4" aria-hidden="true" />
                Add Product
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-4 py-3">Format & Trim</th>
                    <th className="px-4 py-3 text-right">Pages</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filtered.map((product) => {
                    const cover = product.coverAssetId
                      ? assetById.get(product.coverAssetId)
                      : assets.find((a) => a.productId === product.id);
                    const productSeries = product.seriesId
                      ? seriesById.get(product.seriesId)
                      : null;
                    const isSelected = selectedProduct?.id === product.id;

                    return (
                      <tr
                        key={product.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3.5">
                            <div className="h-14 w-11 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                              <AssetPreviewImage
                                src={cover?.url}
                                alt={`${product.title} cover preview`}
                                fallbackLabel={product.title}
                              />
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedProductId(product.id)}
                                className="block max-w-[260px] truncate text-left font-medium text-slate-900 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                              >
                                {product.title}
                              </button>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                <span>{productSeries ? productSeries.name : 'Standalone'}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">{product.isbn}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-700 whitespace-nowrap">
                          <div>{CATEGORY_LABELS[product.category]}</div>
                          <div className="mt-0.5 font-mono text-slate-500 tabular-nums">
                            {product.trimSize}" {product.includeBleed ? '· Bleed' : '· No Bleed'}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-800 tabular-nums">
                          {product.pageCount}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span
                            className={`text-xs font-medium ${STATUS_TEXT_CLASS[product.status]}`}
                          >
                            {STATUS_LABELS[product.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenModuleForProduct('storage', product.id)}
                              aria-label={`Open storage folder for ${product.title}`}
                              className="rounded border border-slate-200 p-1.5 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                            >
                              <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmState({
                                  open: true,
                                  title: `Delete "${product.title}"?`,
                                  description:
                                    'This removes the product record, its local folder, and linked plans from your workspace.',
                                  confirmLabel: 'Delete Product',
                                  tone: 'danger',
                                  action: async () => {
                                    await onDeleteProduct(product.id);
                                    if (selectedProductId === product.id) {
                                      setSelectedProductId(null);
                                    }
                                  },
                                })
                              }
                              aria-label={`Delete ${product.title}`}
                              className="rounded border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right Detail Inspector */}
        <aside
          aria-label="Selected product details"
          className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-4"
        >
          {selectedProduct ? (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="h-28 w-22 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                  <AssetPreviewImage
                    src={
                      (selectedProduct.coverAssetId
                        ? assetById.get(selectedProduct.coverAssetId)?.url
                        : assets.find((a) => a.productId === selectedProduct.id)?.url) ?? null
                    }
                    alt={`${selectedProduct.title} cover`}
                    fallbackLabel={selectedProduct.title}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold leading-snug text-slate-900">
                    {selectedProduct.title}
                  </h3>
                  {selectedProduct.subtitle && (
                    <p className="mt-1 text-xs text-slate-600">{selectedProduct.subtitle}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span>{CATEGORY_LABELS[selectedProduct.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{selectedProduct.trimSize}"</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{selectedProduct.pageCount} pp</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label
                  htmlFor="inspector-status"
                  className="block text-xs font-medium text-slate-700"
                >
                  Production Stage
                </label>
                <select
                  id="inspector-status"
                  value={selectedProduct.status}
                  onChange={(e) =>
                    onUpdateProduct(selectedProduct.id, {
                      status: e.target.value as ProductStatus,
                    })
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  <option value="draft">Draft</option>
                  <option value="in-production">In Production</option>
                  <option value="ready-for-kdp">Ready for KDP</option>
                  <option value="published">Published</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span>Manuscript & Editorial Notes</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {assets.filter((a) => a.productId === selectedProduct.id).length} assets
                  </span>
                </div>
                <p className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                  {selectedProduct.manuscriptNotes ||
                    'No manuscript text yet. Generate story copy or KDP blurbs in the Generation studio.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => onOpenModuleForProduct('generation', selectedProduct.id)}
                  className="rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
                >
                  Open in Studio
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModuleForProduct('export', selectedProduct.id)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Export KDP PDF
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModuleForProduct('storage', selectedProduct.id)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Manage Files
                </button>
                <button
                  type="button"
                  onClick={() => onOpenModuleForProduct('planning', selectedProduct.id)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Batch Plan
                </button>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-500">
              Select a product from the catalog to inspect its print specifications and quick actions.
            </div>
          )}
        </aside>
      </div>

      {/* New Product Modal */}
      {showNewProductModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-product-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 id="new-product-title" className="text-lg font-semibold text-slate-900">
                New Digital Product
              </h2>
              <button
                type="button"
                onClick={onCloseNewProductModal}
                aria-label="Close new product modal"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="mt-4 space-y-4" noValidate>
              {formErrors.form && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formErrors.form}
                </p>
              )}

              <div>
                <label htmlFor="prod-title" className="block text-xs font-medium text-slate-700">
                  Product Title *
                </label>
                <input
                  id="prod-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Moonlight Harbor"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
                {formErrors.title && (
                  <p role="alert" className="mt-1 text-xs text-red-700">
                    {formErrors.title}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="prod-subtitle" className="block text-xs font-medium text-slate-700">
                  Subtitle / Edition Note
                </label>
                <input
                  id="prod-subtitle"
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g., A Bedtime Picture Book for Ages 4–7"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prod-category" className="block text-xs font-medium text-slate-700">
                    Category
                  </label>
                  <select
                    id="prod-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  >
                    <option value="childrens-book">Children&apos;s Book</option>
                    <option value="coloring-book">Coloring Book</option>
                    <option value="art-print">Art Print</option>
                    <option value="journal">Journal</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="prod-series" className="block text-xs font-medium text-slate-700">
                    Series
                  </label>
                  <select
                    id="prod-series"
                    value={seriesId}
                    onChange={(e) => setSeriesId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  >
                    <option value="">Standalone title</option>
                    {series.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="prod-trim" className="block text-xs font-medium text-slate-700">
                    KDP Trim Size
                  </label>
                  <select
                    id="prod-trim"
                    value={trimSize}
                    onChange={(e) => setTrimSize(e.target.value as KdpTrimSize)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  >
                    <option value="8.5x8.5">8.5 × 8.5 in</option>
                    <option value="6x9">6 × 9 in</option>
                    <option value="8.5x11">8.5 × 11 in</option>
                    <option value="8x10">8 × 10 in</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="prod-pages" className="block text-xs font-medium text-slate-700">
                    Page Count
                  </label>
                  <input
                    id="prod-pages"
                    type="number"
                    min={1}
                    max={828}
                    value={pageCount}
                    onChange={(e) => setPageCount(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none"
                  />
                  {formErrors.pageCount && (
                    <p role="alert" className="mt-1 text-xs text-red-700">
                      {formErrors.pageCount}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="prod-isbn" className="block text-xs font-medium text-slate-700">
                    ISBN / SKU
                  </label>
                  <input
                    id="prod-isbn"
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="Auto if blank"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeBleed}
                  onChange={(e) => setIncludeBleed(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                />
                Include KDP full-bleed margins (+0.125&quot; width, +0.25&quot; height)
              </label>

              <div>
                <label htmlFor="prod-notes" className="block text-xs font-medium text-slate-700">
                  Initial Manuscript / Art Brief
                </label>
                <textarea
                  id="prod-notes"
                  rows={3}
                  value={manuscriptNotes}
                  onChange={(e) => setManuscriptNotes(e.target.value)}
                  placeholder="Optional story notes, visual motifs, or target KDP keywords…"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={onCloseNewProductModal}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {submitting ? 'Creating…' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Series Modal */}
      {showSeriesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-series-title"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 id="new-series-title" className="text-lg font-semibold text-slate-900">
                New Publishing Series
              </h2>
              <button
                type="button"
                onClick={() => setShowSeriesModal(false)}
                aria-label="Close new series modal"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSeriesSubmit} className="mt-4 space-y-4">
              {seriesError && (
                <p role="alert" className="text-xs text-red-700">
                  {seriesError}
                </p>
              )}
              <div>
                <label htmlFor="series-name" className="block text-xs font-medium text-slate-700">
                  Series Name *
                </label>
                <input
                  id="series-name"
                  type="text"
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  placeholder="e.g., Harbor Bay Tales"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="series-age" className="block text-xs font-medium text-slate-700">
                    Audience
                  </label>
                  <input
                    id="series-age"
                    type="text"
                    value={seriesAge}
                    onChange={(e) => setSeriesAge(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="series-market" className="block text-xs font-medium text-slate-700">
                    Marketplace
                  </label>
                  <select
                    id="series-market"
                    value={seriesMarketplace}
                    onChange={(e) =>
                      setSeriesMarketplace(e.target.value as Series['marketplace'])
                    }
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  >
                    <option value="Amazon KDP">Amazon KDP</option>
                    <option value="Etsy Digital">Etsy Digital</option>
                    <option value="IngramSpark">IngramSpark</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="series-desc" className="block text-xs font-medium text-slate-700">
                  Series Description
                </label>
                <textarea
                  id="series-desc"
                  rows={2}
                  value={seriesDesc}
                  onChange={(e) => setSeriesDesc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSeriesModal(false)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  Create Series
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmState?.open)}
        title={confirmState?.title ?? ''}
        description={confirmState?.description ?? ''}
        confirmLabel={confirmState?.confirmLabel ?? 'Confirm'}
        tone={confirmState?.tone ?? 'primary'}
        busy={confirmBusy}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
