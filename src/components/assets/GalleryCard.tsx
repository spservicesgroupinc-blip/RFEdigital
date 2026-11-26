import { Check, Cloud, ExternalLink, Layers, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import type { GalleryImage } from '../../types/workspace';
import { formatBytes } from '../../lib/workspaceLogic';
import { AssetPreviewImage } from '../AssetPreviewImage';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Input } from '../ui/Input';

interface GalleryCardProps {
  image: GalleryImage;
  isEditing: boolean;
  editLabel: string;
  editTags: string;
  savingEdit: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditLabelChange: (value: string) => void;
  onEditTagsChange: (value: string) => void;
  onUseInBuilder: () => void;
  onGeneratePages: () => void;
  onRequestDelete: () => void;
}

export function GalleryCard({
  image,
  isEditing,
  editLabel,
  editTags,
  savingEdit,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditLabelChange,
  onEditTagsChange,
  onUseInBuilder,
  onGeneratePages,
  onRequestDelete,
}: GalleryCardProps) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="relative aspect-square w-full overflow-hidden bg-surface-tertiary">
        <AssetPreviewImage
          src={image.url}
          alt={image.label}
          fallbackLabel={image.label}
          className="h-full w-full object-cover"
        />
      </div>

      <CardContent className="flex flex-1 flex-col justify-between">
        <div>
          {isEditing ? (
            <div className="space-y-2">
              <label htmlFor={`gallery-label-${image.id}`} className="sr-only">
                Photo label
              </label>
              <Input
                id={`gallery-label-${image.id}`}
                type="text"
                value={editLabel}
                onChange={(e) => onEditLabelChange(e.target.value)}
                placeholder="Photo name"
              />
              <label htmlFor={`gallery-tags-${image.id}`} className="sr-only">
                Photo tags
              </label>
              <Input
                id={`gallery-tags-${image.id}`}
                type="text"
                value={editTags}
                onChange={(e) => onEditTagsChange(e.target.value)}
                placeholder="Tags (comma separated)"
              />
              <div className="flex items-center justify-end gap-1.5">
                <Button variant="outline" size="sm" leadingIcon={<X className="h-3 w-3" aria-hidden="true" />} onClick={onCancelEdit}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  isLoading={savingEdit}
                  leadingIcon={<Check className="h-3 w-3" aria-hidden="true" />}
                  onClick={onSaveEdit}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-sm font-semibold text-text">{image.label}</h3>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Rename ${image.label}`}
                    className="text-text-muted hover:bg-surface-tertiary hover:text-text"
                    onClick={onStartEdit}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${image.label}`}
                    className="text-text-muted hover:bg-danger-subtle hover:text-danger"
                    onClick={onRequestDelete}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
                <span className="font-mono tabular-nums">
                  {image.sizeBytes > 0 ? formatBytes(image.sizeBytes) : 'Drive'}
                </span>
                <span aria-hidden="true">·</span>
                {image.driveWebLink ? (
                  <a
                    href={image.driveWebLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-success-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-200"
                  >
                    <Cloud className="h-3 w-3" aria-hidden="true" />
                    Drive
                    <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                  </a>
                ) : (
                  <span>Stored locally</span>
                )}
              </div>

              {image.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {image.tags.map((tag) => (
                    <Badge key={tag} variant="muted" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            onClick={onGeneratePages}
          >
            Multi-Page
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Layers className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />}
            onClick={onUseInBuilder}
          >
            Book Builder
          </Button>
        </div>
      </CardContent>
    </article>
  );
}
