import { useRef, useState } from 'react';
import {
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  Folder,
  Images,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import type { GalleryImage, Product, StorageAsset } from '../types/workspace';
import { formatBytes } from '../lib/workspaceLogic';
import { AssetPreviewImage } from './AssetPreviewImage';
import { ConfirmDialog } from './ConfirmDialog';

interface AssetsViewProps {
  products: Product[];
  assets: StorageAsset[];
  galleryImages: GalleryImage[];
  activeProductId: string | null;
  googleConnected: boolean;
  onSelectProduct: (id: string) => void;
  onUploadAsset: (payload: {
    productId: string;
    name: string;
    mimeType: string;
    dataUrl: string;
    kind: StorageAsset['kind'];
    caption: string;
  }) => Promise<void>;
  onUploadGalleryImage: (payload: {
    name: string;
    label?: string;
    tags?: string[];
    mimeType: string;
    dataUrl: string;
  }) => Promise<GalleryImage>;
  onDeleteAsset: (id: string) => Promise<void>;
  onDeleteGalleryImage: (id: string) => Promise<void>;
  onUploadAssetToDrive: (assetId: string) => Promise<void>;
  onUseInBuilder: (image: GalleryImage) => void;
  onGeneratePagesFromPhoto: (image: GalleryImage) => void;
}

type AssetScope = 'all' | 'global' | string;

export function AssetsView({
  products,
  assets,
  galleryImages,
  activeProductId,
  googleConnected,
  onSelectProduct,
  onUploadAsset,
  onUploadGalleryImage,
  onDeleteAsset,
  onDeleteGalleryImage,
  onUploadAssetToDrive,
  onUseInBuilder,
  onGeneratePagesFromPhoto,
}: AssetsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadScope, setUploadScope] = useState<'product' | 'global'>('product');
  const [uploadKind, setUploadKind] = useState<StorageAsset['kind']>('illustration');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'primary' | 'danger';
    action: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const currentProductId = activeProductId || products[0]?.id || null;
  const currentProduct = products.find((p) => p.id === currentProductId) ?? null;

  const q = search.trim().toLowerCase();

  const filteredStorageAssets = assets.filter((asset) => {
    if (q && !asset.name.toLowerCase().includes(q) && !(asset.caption ?? '').toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  const filteredGalleryImages = galleryImages.filter((img) => {
    if (q && !img.name.toLowerCase().includes(q) && !img.label.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  const visibleAssets: Array<
    | ({ type: 'storage' } & StorageAsset)
    | ({ type: 'gallery' } & GalleryImage)
  > = [
    ...filteredStorageAssets.map((a) => ({ type: 'storage' as const, ...a })),
    ...filteredGalleryImages.map((g) => ({ type: 'gallery' as const, ...g })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setUploadError('Only PNG, JPEG, WebP, or SVG files are supported.');
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read selected file.'));
        reader.readAsDataURL(file);
      });

      if (uploadScope === 'global') {
        const cleanLabel = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        await onUploadGalleryImage({
          name: file.name,
          label: cleanLabel || file.name,
          tags: currentProduct ? [currentProduct.title.slice(0, 28)] : [],
          mimeType: file.type,
          dataUrl,
        });
      } else {
        if (!currentProductId) {
          setUploadError('Select a product first.');
          return;
        }
        await onUploadAsset({
          productId: currentProductId,
          name: file.name,
          mimeType: file.type,
          dataUrl,
          kind: uploadKind,
          caption: uploadCaption.trim(),
        });
      }
      setUploadCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleCopyLink = (item: StorageAsset | GalleryImage) => {
    const fullUrl = 'driveWebLink' in item && item.driveWebLink
      ? item.driveWebLink
      : `${window.location.origin}${item.url}`;
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
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

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Assets</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Global gallery + product folders in one place
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="asset-search" className="sr-only">Search assets</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="asset-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets…"
                className="h-9 w-40 rounded-md border border-slate-300 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none sm:w-56"
              />
            </div>

            <select
              id="asset-product-filter"
              value={currentProductId ?? 'all'}
              onChange={(e) => onSelectProduct(e.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
            >
              <option value="all">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 p-0.5">
              <button
                type="button"
                onClick={() => setUploadScope('product')}
                className={`rounded px-2.5 py-1.5 text-xs font-medium ${
                  uploadScope === 'product'
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Product asset
              </button>
              <button
                type="button"
                onClick={() => setUploadScope('global')}
                className={`rounded px-2.5 py-1.5 text-xs font-medium ${
                  uploadScope === 'global'
                    ? 'bg-blue-100 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Global reference
              </button>
            </div>

            {uploadScope === 'product' && (
              <select
                id="asset-kind"
                value={uploadKind}
                onChange={(e) => setUploadKind(e.target.value as StorageAsset['kind'])}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700"
              >
                <option value="cover">Cover</option>
                <option value="illustration">Illustration</option>
                <option value="reference">Reference Photo</option>
                <option value="manuscript">Manuscript</option>
              </select>
            )}

            {uploadScope === 'product' && (
              <input
                id="asset-caption"
                type="text"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Optional caption…"
                className="h-9 w-32 rounded-md border border-slate-300 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none sm:w-48"
              />
            )}

            <input
              ref={fileInputRef}
              id="assets-file-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading || (uploadScope === 'product' && !currentProductId)}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-700 px-4 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>

        {uploadError && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {uploadError}
          </p>
        )}
      </div>

      {/* Asset Grid */}
      {visibleAssets.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-sm font-medium text-slate-900">No assets yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Upload product files or global reference photos to see them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleAssets.map((item) => {
            const isGallery = item.type === 'gallery';
            const title = isGallery ? item.label : item.name;
            const subtitle = isGallery ? 'Global reference' : `${item.kind} · ${item.pageOrder}`;
            const url = item.url;
            const driveWebLink = 'driveWebLink' in item ? item.driveWebLink : null;

            return (
              <article
                key={`${item.type}-${item.id}`}
                className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-200 bg-slate-50">
                  <AssetPreviewImage
                    src={url}
                    alt={title}
                    fallbackLabel={title}
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="truncate text-sm font-semibold text-slate-900" title={title}>
                      {title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="capitalize">{subtitle}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(item.sizeBytes)}</span>
                    </div>
                    {!isGallery && item.caption && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {item.caption}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={url}
                        download={item.name}
                        aria-label={`Download ${item.name}`}
                        className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
                      >
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        {copiedId === item.id ? 'Copied' : 'Link'}
                      </button>
                      {driveWebLink ? (
                        <a
                          href={driveWebLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50/50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 whitespace-nowrap shrink-0"
                        >
                          Drive
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        !isGallery && (
                          <button
                            type="button"
                            disabled={!googleConnected}
                            title={
                              googleConnected
                                ? 'Upload this asset to Google Drive'
                                : 'Sign in with Google in Settings to upload to Drive'
                            }
                            onClick={() =>
                              setConfirmState({
                                open: true,
                                title: `Upload "${item.name}" to Google Drive?`,
                                description:
                                  'FolioPress will upload this file into a dedicated product folder in your Google Drive.',
                                confirmLabel: 'Upload to Drive',
                                tone: 'primary',
                                action: () => onUploadAssetToDrive(item.id),
                              })
                            }
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
                          >
                            <CloudUpload className="h-3 w-3" aria-hidden="true" />
                            Drive
                          </button>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmState({
                          open: true,
                          title: `Delete "${item.name}"?`,
                          description: 'This removes the asset from your workspace.',
                          confirmLabel: 'Delete File',
                          tone: 'danger',
                          action: () =>
                            isGallery ? onDeleteGalleryImage(item.id) : onDeleteAsset(item.id),
                        })
                      }
                      aria-label={`Delete ${item.name}`}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
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
