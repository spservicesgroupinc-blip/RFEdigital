import type { GalleryImage, StorageAsset } from '../../types/workspace';
import { EmptyState } from '../ui/EmptyState';
import { AssetCard } from './AssetCard';

interface AssetGridProps {
  assets: StorageAsset[];
  galleryImages: GalleryImage[];
  search: string;
  copiedId: string | null;
  googleConnected: boolean;
  onCopy: (item: StorageAsset | GalleryImage) => void;
  onRequestUploadToDrive: (asset: StorageAsset) => void;
  onRequestDelete: (item: StorageAsset | GalleryImage, type: 'storage' | 'gallery') => void;
}

export function AssetGrid({
  assets,
  galleryImages,
  search,
  copiedId,
  googleConnected,
  onCopy,
  onRequestUploadToDrive,
  onRequestDelete,
}: AssetGridProps) {
  const q = search.trim().toLowerCase();

  const filteredStorageAssets = assets.filter((asset) => {
    if (
      q &&
      !asset.name.toLowerCase().includes(q) &&
      !(asset.caption ?? '').toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const filteredGalleryImages = galleryImages.filter((img) => {
    if (
      q &&
      !img.name.toLowerCase().includes(q) &&
      !img.label.toLowerCase().includes(q)
    ) {
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

  if (visibleAssets.length === 0) {
    return (
      <EmptyState
        title="No assets yet"
        description="Upload product files or global reference photos to see them here."
      />
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      role="list"
    >
      {visibleAssets.map((item) => (
        <div key={`${item.type}-${item.id}`} role="listitem">
          <AssetCard
            item={item}
            type={item.type}
            copiedId={copiedId}
            googleConnected={googleConnected}
            onCopy={onCopy}
            onRequestUploadToDrive={onRequestUploadToDrive}
            onRequestDelete={onRequestDelete}
          />
        </div>
      ))}
    </div>
  );
}
