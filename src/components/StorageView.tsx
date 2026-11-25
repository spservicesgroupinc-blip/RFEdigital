import { useRef, useState } from 'react';
import {
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  Folder,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Product, StorageAsset, StorageFolder } from '../types/workspace';
import { formatBytes } from '../lib/workspaceLogic';
import { AssetPreviewImage } from './AssetPreviewImage';
import { ConfirmDialog } from './ConfirmDialog';

interface StorageViewProps {
  products: Product[];
  folders: StorageFolder[];
  assets: StorageAsset[];
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
  onDeleteAsset: (id: string) => Promise<void>;
  onUploadAssetToDrive: (assetId: string) => Promise<void>;
}

export function StorageView({
  products,
  folders,
  assets,
  activeProductId,
  googleConnected,
  onSelectProduct,
  onUploadAsset,
  onDeleteAsset,
  onUploadAssetToDrive,
}: StorageViewProps) {
  const currentProductId = activeProductId || products[0]?.id || null;
  const currentProduct = products.find((p) => p.id === currentProductId) ?? null;
  const currentFolder = folders.find((f) => f.productId === currentProductId) ?? null;
  const folderAssets = assets
    .filter((a) => a.productId === currentProductId)
    .sort((a, b) => a.pageOrder - b.pageOrder);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState<StorageAsset['kind']>('illustration');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    tone: 'primary' | 'danger';
    action: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProductId) return;
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

      await onUploadAsset({
        productId: currentProductId,
        name: file.name,
        mimeType: file.type,
        dataUrl,
        kind: uploadKind,
        caption: uploadCaption.trim(),
      });
      setUploadCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleCopyLink = (asset: StorageAsset) => {
    const fullUrl = asset.driveWebLink || `${window.location.origin}${asset.url}`;
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopiedId(asset.id);
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Scoped Product Folder Tree */}
      <aside
        aria-label="Product storage folders"
        className="rounded-lg border border-slate-200 bg-white lg:col-span-4 xl:col-span-3"
      >
        <div className="border-b border-slate-200 px-4 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Product Folders</h2>
          <p className="mt-0.5 text-xs text-slate-500">Scoped per digital product</p>
        </div>

        <nav className="divide-y divide-slate-100 p-2" aria-label="Folder directory">
          {products.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-500">
              No product folders yet. Create your first product in Library or Trends.
            </div>
          ) : (
            products.map((product) => {
              const folder = folders.find((f) => f.productId === product.id);
              const count = assets.filter((a) => a.productId === product.id).length;
              const active = product.id === currentProductId;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelectProduct(product.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Folder
                      className={`h-4 w-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-400'}`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{product.title}</div>
                      <div className="truncate font-mono text-[11px] text-slate-400">
                        {folder?.path ?? '/FolioPress/product'}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </nav>
      </aside>

      {/* Right Asset Workspace */}
      <section className="space-y-5 lg:col-span-8 xl:col-span-9">
        {/* Upload & Folder Path Header */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {currentProduct?.title ?? 'Select a product folder'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
                <span>{currentFolder?.path ?? '/FolioPress'}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{folderAssets.length} files</span>
                {currentFolder?.driveFolderId && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-700">Google Drive folder linked</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="asset-kind" className="sr-only">
                Asset role
              </label>
              <select
                id="asset-kind"
                value={uploadKind}
                onChange={(e) => setUploadKind(e.target.value as StorageAsset['kind'])}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="cover">Cover</option>
                <option value="illustration">Illustration</option>
                <option value="reference">Reference Photo</option>
                <option value="manuscript">Manuscript</option>
              </select>

              <label htmlFor="asset-caption" className="sr-only">
                Page caption
              </label>
              <input
                id="asset-caption"
                type="text"
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="Optional page caption…"
                className="w-48 rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />

              <input
                ref={fileInputRef}
                id="storage-file-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={!currentProductId || uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                {uploading ? 'Uploading…' : 'Upload File'}
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
        {folderAssets.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-900">This folder is empty</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload cover art or interior illustrations here, or generate artwork in the Generation studio.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {folderAssets.map((asset) => (
              <article
                key={asset.id}
                className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-200 bg-slate-50">
                  <AssetPreviewImage
                    src={asset.url}
                    alt={asset.caption || asset.name}
                    fallbackLabel={asset.name}
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="truncate text-sm font-semibold text-slate-900" title={asset.name}>
                      {asset.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="capitalize">{asset.kind}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Page {asset.pageOrder}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(asset.sizeBytes)}</span>
                    </div>
                    {asset.caption && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
                        {asset.caption}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={asset.url}
                        download={asset.name}
                        aria-label={`Download ${asset.name}`}
                        className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(asset)}
                        aria-label={`Copy shareable link for ${asset.name}`}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
                      >
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        {copiedId === asset.id ? 'Copied' : 'Link'}
                      </button>
                      {asset.driveWebLink ? (
                        <a
                          href={asset.driveWebLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50/50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 whitespace-nowrap shrink-0"
                        >
                          Drive
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled={!googleConnected}
                          title={
                            googleConnected
                              ? 'Upload this asset to Google Drive'
                              : 'Sign in with Google on Identity tab to upload to Drive'
                          }
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: `Upload "${asset.name}" to Google Drive?`,
                              description:
                                'FolioPress will upload this file into a dedicated product folder in your Google Drive.',
                              confirmLabel: 'Upload to Drive',
                              tone: 'primary',
                              action: () => onUploadAssetToDrive(asset.id),
                            })
                          }
                          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
                        >
                          <CloudUpload className="h-3 w-3" aria-hidden="true" />
                          Drive
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmState({
                          open: true,
                          title: `Delete "${asset.name}"?`,
                          description: 'This removes the asset from your workspace folder.',
                          confirmLabel: 'Delete File',
                          tone: 'danger',
                          action: () => onDeleteAsset(asset.id),
                        })
                      }
                      aria-label={`Delete ${asset.name}`}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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
