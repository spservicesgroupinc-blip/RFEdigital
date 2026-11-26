import { useRef, useState } from 'react';
import type { GalleryImage, Product, StorageAsset } from '../types/workspace';
import { ConfirmDialog } from './ConfirmDialog';
import { AssetGrid, AssetToolbar } from './assets';

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
    const fullUrl =
      'driveWebLink' in item && item.driveWebLink
        ? item.driveWebLink
        : `${window.location.origin}${item.url}`;
    navigator.clipboard?.writeText(fullUrl).catch(() => {});
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleRequestUploadToDrive = (asset: StorageAsset) => {
    setConfirmState({
      open: true,
      title: `Upload "${asset.name}" to Google Drive?`,
      description:
        'FolioPress will upload this file into a dedicated product folder in your Google Drive.',
      confirmLabel: 'Upload to Drive',
      tone: 'primary',
      action: () => onUploadAssetToDrive(asset.id),
    });
  };

  const handleRequestDelete = (item: StorageAsset | GalleryImage, type: 'storage' | 'gallery') => {
    setConfirmState({
      open: true,
      title: `Delete "${item.name}"?`,
      description: 'This removes the asset from your workspace.',
      confirmLabel: 'Delete File',
      tone: 'danger',
      action: () => (type === 'gallery' ? onDeleteGalleryImage(item.id) : onDeleteAsset(item.id)),
    });
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
      <AssetToolbar
        search={search}
        onSearchChange={setSearch}
        products={products}
        currentProductId={currentProductId}
        onSelectProduct={onSelectProduct}
        uploadScope={uploadScope}
        onUploadScopeChange={setUploadScope}
        uploadKind={uploadKind}
        onUploadKindChange={setUploadKind}
        uploadCaption={uploadCaption}
        onUploadCaptionChange={setUploadCaption}
        uploading={uploading}
        uploadError={uploadError}
        fileInputRef={fileInputRef}
        onUploadClick={() => fileInputRef.current?.click()}
        onFileSelect={handleFileChange}
      />

      <AssetGrid
        assets={assets}
        galleryImages={galleryImages}
        search={search}
        copiedId={copiedId}
        googleConnected={googleConnected}
        onCopy={handleCopyLink}
        onRequestUploadToDrive={handleRequestUploadToDrive}
        onRequestDelete={handleRequestDelete}
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
