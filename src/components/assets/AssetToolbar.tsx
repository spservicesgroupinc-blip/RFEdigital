import { Search, Upload } from 'lucide-react';
import type { Product, StorageAsset } from '../../types/workspace';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Tabs } from '../ui/Tabs';

interface AssetToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  products: Product[];
  currentProductId: string | null;
  onSelectProduct: (id: string) => void;
  uploadScope: 'product' | 'global';
  onUploadScopeChange: (scope: 'product' | 'global') => void;
  uploadKind: StorageAsset['kind'];
  onUploadKindChange: (kind: StorageAsset['kind']) => void;
  uploadCaption: string;
  onUploadCaptionChange: (value: string) => void;
  uploading: boolean;
  uploadError: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SCOPE_TABS: Array<{ id: 'product' | 'global'; label: string }> = [
  { id: 'product', label: 'Product asset' },
  { id: 'global', label: 'Global reference' },
];

const KIND_OPTIONS: Array<{ value: StorageAsset['kind']; label: string }> = [
  { value: 'cover', label: 'Cover' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'reference', label: 'Reference Photo' },
  { value: 'manuscript', label: 'Manuscript' },
];

export function AssetToolbar({
  search,
  onSearchChange,
  products,
  currentProductId,
  onSelectProduct,
  uploadScope,
  onUploadScopeChange,
  uploadKind,
  onUploadKindChange,
  uploadCaption,
  onUploadCaptionChange,
  uploading,
  uploadError,
  fileInputRef,
  onUploadClick,
  onFileSelect,
}: AssetToolbarProps) {
  const uploadDisabled = uploading || (uploadScope === 'product' && !currentProductId);

  return (
    <Card>
      <CardHeader
        action={
          <Button
            variant="primary"
            size="md"
            leadingIcon={<Upload className="h-3.5 w-3.5" aria-hidden="true" />}
            isLoading={uploading}
            disabled={uploadDisabled}
            onClick={onUploadClick}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        }
      >
        <CardTitle>Assets</CardTitle>
        <CardDescription>Global gallery + product folders in one place</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-56">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <label htmlFor="asset-search" className="sr-only">
                Search assets
              </label>
              <Input
                id="asset-search"
                type="search"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search assets…"
                className="pl-9"
              />
            </div>

            <label htmlFor="asset-product-filter" className="sr-only">
              Filter by product
            </label>
            <Select
              id="asset-product-filter"
              value={currentProductId ?? 'all'}
              onChange={(e) => onSelectProduct(e.target.value)}
              className="w-full sm:w-56"
            >
              <option value="all">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>

            <Tabs
              items={SCOPE_TABS}
              activeId={uploadScope}
              onChange={(id) => onUploadScopeChange(id as 'product' | 'global')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {uploadScope === 'product' && (
              <>
                <label htmlFor="asset-kind" className="sr-only">
                  Asset kind
                </label>
                <Select
                  id="asset-kind"
                  value={uploadKind}
                  onChange={(e) => onUploadKindChange(e.target.value as StorageAsset['kind'])}
                  className="w-auto"
                >
                  {KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>

                <label htmlFor="asset-caption" className="sr-only">
                  Optional caption
                </label>
                <Input
                  id="asset-caption"
                  type="text"
                  value={uploadCaption}
                  onChange={(e) => onUploadCaptionChange(e.target.value)}
                  placeholder="Optional caption…"
                  className="w-full sm:w-48"
                />
              </>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          id="assets-file-upload"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={onFileSelect}
          className="hidden"
        />

        {uploadError && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {uploadError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
