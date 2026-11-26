import { CloudUpload, Copy, Download, ExternalLink, Trash2 } from 'lucide-react';
import type { GalleryImage, StorageAsset } from '../../types/workspace';
import { formatBytes } from '../../lib/workspaceLogic';
import { AssetPreviewImage } from '../AssetPreviewImage';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

interface AssetCardProps {
  item: StorageAsset | GalleryImage;
  type: 'storage' | 'gallery';
  copiedId: string | null;
  googleConnected: boolean;
  onCopy: (item: StorageAsset | GalleryImage) => void;
  onRequestUploadToDrive: (asset: StorageAsset) => void;
  onRequestDelete: (item: StorageAsset | GalleryImage, type: 'storage' | 'gallery') => void;
}

export function AssetCard({
  item,
  type,
  copiedId,
  googleConnected,
  onCopy,
  onRequestUploadToDrive,
  onRequestDelete,
}: AssetCardProps) {
  const isGallery = type === 'gallery';
  const title = isGallery ? (item as GalleryImage).label : (item as StorageAsset).name;
  const subtitle = isGallery
    ? 'Global reference'
    : `${(item as StorageAsset).kind} · ${(item as StorageAsset).pageOrder}`;
  const driveWebLink = 'driveWebLink' in item ? item.driveWebLink : null;
  const caption = !isGallery ? (item as StorageAsset).caption : null;

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-border bg-surface-tertiary">
        <AssetPreviewImage src={item.url} alt={title} fallbackLabel={title} />
      </div>

      <CardContent className="flex flex-1 flex-col justify-between">
        <div>
          <h3 className="truncate text-sm font-semibold text-text" title={title}>
            {title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
            <Badge variant="default" size="sm" className="capitalize">
              {subtitle}
            </Badge>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{formatBytes(item.sizeBytes)}</span>
          </div>
          {caption && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-secondary">
              {caption}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={item.url}
              download={item.name}
              aria-label={`Download ${item.name}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-strong bg-surface text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            </a>

            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Copy className="h-3 w-3" aria-hidden="true" />}
              onClick={() => onCopy(item)}
            >
              {copiedId === item.id ? 'Copied' : 'Link'}
            </Button>

            {driveWebLink ? (
              <a
                href={driveWebLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-success-200 bg-success-subtle px-2 py-1.5 text-xs font-medium text-success-700 transition-colors hover:bg-success-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-200"
              >
                Drive
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : (
              !isGallery && (
                <Button
                  variant="outline"
                  size="sm"
                  leadingIcon={<CloudUpload className="h-3 w-3" aria-hidden="true" />}
                  disabled={!googleConnected}
                  title={
                    googleConnected
                      ? 'Upload this asset to Google Drive'
                      : 'Sign in with Google in Settings to upload to Drive'
                  }
                  onClick={() => onRequestUploadToDrive(item as StorageAsset)}
                >
                  Drive
                </Button>
              )
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            aria-label={`Delete ${item.name}`}
            className="text-text-muted hover:bg-danger-subtle hover:text-danger"
            onClick={() => onRequestDelete(item, type)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </CardContent>
    </article>
  );
}
