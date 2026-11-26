import { Images, Upload } from 'lucide-react';
import type { GalleryImage } from '../../types/workspace';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { GalleryCard } from './GalleryCard';

interface GalleryGridProps {
  images: GalleryImage[];
  galleryImages: GalleryImage[];
  search: string;
  editingId: string | null;
  editLabel: string;
  editTags: string;
  savingEdit: boolean;
  onStartEdit: (image: GalleryImage) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onEditLabelChange: (value: string) => void;
  onEditTagsChange: (value: string) => void;
  onUseInBuilder: (image: GalleryImage) => void;
  onGeneratePages: (image: GalleryImage) => void;
  onRequestDelete: (image: GalleryImage) => void;
  onUploadClick: () => void;
}

export function GalleryGrid({
  images,
  galleryImages,
  search,
  editingId,
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
  onUploadClick,
}: GalleryGridProps) {
  if (images.length === 0) {
    const empty = galleryImages.length === 0;
    return (
      <EmptyState
        icon={<Images className="h-9 w-9" aria-hidden="true" />}
        title={
          empty
            ? 'No uploaded photos in your gallery yet'
            : 'No photos match your search'
        }
        description={
          empty
            ? 'Upload one photo of a child, pet, or character here. FolioPress stores it in your gallery (and backs it up to Google Drive via Apps Script) so you can generate an entire multi-page illustrated book from a single photo.'
            : 'Try clearing your search filter or upload a new reference photo.'
        }
        action={
          empty
            ? {
                label: 'Upload Your First Photo',
                icon: <Upload className="h-4 w-4" aria-hidden="true" />,
                onClick: onUploadClick,
              }
            : undefined
        }
      />
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      role="list"
    >
      {images.map((img) => (
        <div key={img.id} role="listitem">
          <GalleryCard
            image={img}
            isEditing={editingId === img.id}
            editLabel={editLabel}
            editTags={editTags}
            savingEdit={savingEdit}
            onStartEdit={() => onStartEdit(img)}
            onCancelEdit={onCancelEdit}
            onSaveEdit={() => onSaveEdit(img.id)}
            onEditLabelChange={onEditLabelChange}
            onEditTagsChange={onEditTagsChange}
            onUseInBuilder={() => onUseInBuilder(img)}
            onGeneratePages={() => onGeneratePages(img)}
            onRequestDelete={() => onRequestDelete(img)}
          />
        </div>
      ))}
    </div>
  );
}
