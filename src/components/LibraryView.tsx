import { useMemo, useRef, useState } from 'react';
import { BookPlus } from 'lucide-react';
import type {
  ExportArtifact,
  GenerationRecord,
  ModuleId,
  Product,
  ProductCategory,
  ProductStatus,
  Series,
  StorageAsset,
  WorkspaceSettings,
} from '../types/workspace';
import { filterProducts } from '../lib/workspaceLogic';
import { ConfirmDialog } from './ConfirmDialog';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import {
  KpiSummary,
  ProductFilters,
  ProductTable,
  ProductInspector,
  NewProductModal,
  NewSeriesModal,
} from './library';
import type { BuilderStep } from '../types/workspace';

interface LibraryViewProps {
  products: Product[];
  series: Series[];
  assets: StorageAsset[];
  generations: GenerationRecord[];
  exportsList: ExportArtifact[];
  settings: WorkspaceSettings;
  googleConnected: boolean;
  onCreateProduct: (payload: {
    title: string;
    subtitle: string;
    category: ProductCategory;
    status: ProductStatus;
    trimSize: Product['trimSize'];
    pageCount: number;
    includeBleed: boolean;
    seriesId: string | null;
    isbn: string;
    manuscriptNotes: string;
    referencePhoto?: { name: string; mimeType: string; dataUrl: string };
  }) => Promise<Product>;
  onUploadReferencePhoto: (payload: {
    productId: string;
    name: string;
    mimeType: string;
    dataUrl: string;
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
  onOpenIllustrationForProduct: (productId: string) => void;
  onOpenBuilderForProduct: (productId: string, step?: BuilderStep) => void;
  showNewProductModal: boolean;
  onCloseNewProductModal: () => void;
  onOpenNewProductModal: () => void;
}

export function LibraryView({
  products,
  series,
  assets,
  generations,
  exportsList,
  settings,
  googleConnected,
  onCreateProduct,
  onUploadReferencePhoto,
  onUpdateProduct,
  onDeleteProduct,
  onCreateSeries,
  onSyncGoogleSheets,
  onBootstrapGoogleSheet,
  onOpenModuleForProduct,
  onOpenIllustrationForProduct,
  onOpenBuilderForProduct,
  showNewProductModal,
  onCloseNewProductModal,
  onOpenNewProductModal,
}: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | 'all'>('all');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(products[0]?.id ?? null);
  const [showSeriesModal, setShowSeriesModal] = useState(false);

  const [uploadingInspectorPhoto, setUploadingInspectorPhoto] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'primary' | 'danger';
    action: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const inspectorPhotoInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => filterProducts(products, query, categoryFilter, statusFilter),
    [products, query, categoryFilter, statusFilter]
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? filtered[0] ?? null;

  const handleInspectorPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return;
    setUploadingInspectorPhoto(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read file.'));
        reader.readAsDataURL(file);
      });
      await onUploadReferencePhoto({
        productId: selectedProduct.id,
        name: file.name,
        mimeType: file.type,
        dataUrl,
      });
      if (inspectorPhotoInputRef.current) inspectorPhotoInputRef.current.value = '';
    } finally {
      setUploadingInspectorPhoto(false);
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

  const handleDeleteProduct = (product: Product) => {
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
    });
  };

  return (
    <div className="space-y-6">
      <KpiSummary
        products={products}
        series={series}
        assets={assets}
        settings={settings}
        googleConnected={googleConnected}
      />

      <ProductFilters
        query={query}
        onQueryChange={setQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        googleConnected={googleConnected}
        settings={settings}
        onNewSeries={() => setShowSeriesModal(true)}
        onSyncSheets={requestSheetSync}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section aria-label="Product catalog" className="xl:col-span-8">
          <Card>
            <CardHeader
              action={
                <span className="text-xs text-text-muted">
                  {series.map((s) => s.name).slice(0, 2).join(' · ')}
                </span>
              }
            >
              <CardTitle>
                Products Catalog{' '}
                <span className="ml-1 font-mono text-xs font-normal text-text-muted tabular-nums">
                  ({filtered.length})
                </span>
              </CardTitle>
            </CardHeader>
            <ProductTable
              products={products}
              filtered={filtered}
              series={series}
              assets={assets}
              selectedProduct={selectedProduct}
              onSelect={setSelectedProductId}
              onOpenBuilder={(id, step) => onOpenBuilderForProduct(id, step)}
              onOpenIllustration={onOpenIllustrationForProduct}
              onDelete={handleDeleteProduct}
              onAddProduct={onOpenNewProductModal}
            />
          </Card>
        </section>

        <aside aria-label="Selected product details" className="xl:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedProduct ? (
                <ProductInspector
                  product={selectedProduct}
                  series={series}
                  assets={assets}
                  generations={generations}
                  exportsList={exportsList}
                  settings={settings}
                  uploadingPhoto={uploadingInspectorPhoto}
                  onUpdateStatus={(status) => onUpdateProduct(selectedProduct.id, { status })}
                  onOpenBuilder={(step) => onOpenBuilderForProduct(selectedProduct.id, step)}
                  onOpenIllustration={() => onOpenIllustrationForProduct(selectedProduct.id)}
                  onOpenFiles={() => onOpenModuleForProduct('storage', selectedProduct.id)}
                  onOpenExport={() => onOpenModuleForProduct('export', selectedProduct.id)}
                  onReplacePhoto={() => inspectorPhotoInputRef.current?.click()}
                />
              ) : (
                <EmptyState
                  title="No product selected"
                  description="Select a product from the catalog to inspect its print specifications and quick actions."
                  action={{
                    label: 'Add Product',
                    onClick: onOpenNewProductModal,
                    icon: <BookPlus className="h-4 w-4" />,
                  }}
                />
              )}
            </CardContent>
          </Card>
          <input
            ref={inspectorPhotoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleInspectorPhotoSelect}
            className="hidden"
            aria-label="Upload reference photo for selected product"
          />
        </aside>
      </div>

      <NewProductModal
        open={showNewProductModal}
        onClose={onCloseNewProductModal}
        series={series}
        onCreate={async (payload) => {
          const created = await onCreateProduct(payload);
          setSelectedProductId(created.id);
          onOpenBuilderForProduct(created.id, 2);
          return created;
        }}
      />

      <NewSeriesModal
        open={showSeriesModal}
        onClose={() => setShowSeriesModal(false)}
        onCreate={onCreateSeries}
      />

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
