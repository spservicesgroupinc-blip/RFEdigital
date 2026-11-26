import { useMemo, useRef, useState } from 'react';
import { Cloud, ExternalLink, Images, Loader2, RefreshCw, Search, Upload } from 'lucide-react';
import type { GalleryImage, Product, WorkspaceSettings } from '../types/workspace';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { SectionHeader } from './ui/SectionHeader';
import { GalleryGrid } from './assets';

interface ImageGalleryViewProps {
  galleryImages: GalleryImage[];
  products: Product[];
  activeProductId: string | null;
  settings: WorkspaceSettings;
  onUploadGalleryImage: (payload: {
    name: string;
    label?: string;
    tags?: string[];
    mimeType: string;
    dataUrl: string;
  }) => Promise<GalleryImage>;
  onUpdateGalleryImage: (
    id: string,
    payload: { label?: string; tags?: string[] }
  ) => Promise<void>;
  onDeleteGalleryImage: (id: string) => Promise<void>;
  onSyncGallery: () => Promise<void>;
  onUseInBuilder: (image: GalleryImage) => void;
  onGeneratePagesFromPhoto: (image: GalleryImage) => void;
}

export function ImageGalleryView({
  galleryImages,
  products,
  activeProductId,
  settings,
  onUploadGalleryImage,
  onUpdateGalleryImage,
  onDeleteGalleryImage,
  onSyncGallery,
  onUseInBuilder,
  onGeneratePagesFromPhoto,
}: ImageGalleryViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editTags, setEditTags] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<GalleryImage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeProduct = useMemo(
    () => products.find((p) => p.id === activeProductId) ?? products[0] ?? null,
    [products, activeProductId]
  );

  const filteredImages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return galleryImages;
    return galleryImages.filter(
      (img) =>
        img.label.toLowerCase().includes(q) ||
        img.name.toLowerCase().includes(q) ||
        img.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [galleryImages, search]);

  const syncedCount = useMemo(
    () => galleryImages.filter((img) => Boolean(img.driveFileId)).length,
    [galleryImages]
  );

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setError('');
    setUploading(true);
    try {
      for (const file of files) {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
          setError(`Skipped "${file.name}": upload PNG, JPEG, or WebP photos only.`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          setError(`Skipped "${file.name}": photo must be under 10 MB.`);
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        const cleanLabel = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
        await onUploadGalleryImage({
          name: file.name,
          label: cleanLabel || file.name,
          tags: activeProduct ? [activeProduct.title.slice(0, 28)] : [],
          mimeType: file.type,
          dataUrl,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSync = async () => {
    setError('');
    setSyncing(true);
    try {
      await onSyncGallery();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apps Script gallery sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const startEditing = (img: GalleryImage) => {
    setEditingId(img.id);
    setEditLabel(img.label);
    setEditTags(img.tags.join(', '));
  };

  const handleSaveEdit = async (id: string) => {
    if (!editLabel.trim()) return;
    setSavingEdit(true);
    setError('');
    try {
      const tags = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await onUpdateGalleryImage(id, { label: editLabel.trim(), tags });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update photo details.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setError('');
    try {
      await onDeleteGalleryImage(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete photo.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Uploaded Image Gallery"
        description="Upload a character, pet, or reference photo once, store it with Google Drive via Apps Script, and reuse it to generate multiple distinct illustrated book pages."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
            <Button
              variant="outline"
              size="md"
              isLoading={syncing}
              disabled={syncing || !settings.appsScriptConfigured}
              leadingIcon={<RefreshCw className={`h-3.5 w-3.5 text-text-muted ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />}
              onClick={handleSync}
              title={
                settings.appsScriptConfigured
                  ? 'Push unsynced photos to Google Drive & pull Image_Gallery rows from Apps Script'
                  : 'Connect Apps Script Web App URL in Settings & Sync first'
              }
            >
              {syncing ? 'Syncing…' : 'Sync with Apps Script'}
            </Button>

            <Button
              variant="primary"
              size="md"
              isLoading={uploading}
              leadingIcon={
                uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                )
              }
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Uploading…' : 'Upload Photos'}
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
                aria-hidden="true"
              />
              <label htmlFor="gallery-search" className="sr-only">
                Search uploaded gallery images
              </label>
              <Input
                id="gallery-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search photos by name or tag…"
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
              <span className="font-mono tabular-nums">
                {galleryImages.length} {galleryImages.length === 1 ? 'photo' : 'photos'} saved
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Cloud className="h-3 w-3" aria-hidden="true" />
                {syncedCount} backed up in Google Drive
              </span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-danger-100 bg-danger-subtle px-3.5 py-2.5 text-xs font-medium text-danger-700"
            >
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      <GalleryGrid
        images={filteredImages}
        galleryImages={galleryImages}
        search={search}
        editingId={editingId}
        editLabel={editLabel}
        editTags={editTags}
        savingEdit={savingEdit}
        onStartEdit={startEditing}
        onCancelEdit={() => setEditingId(null)}
        onSaveEdit={handleSaveEdit}
        onEditLabelChange={setEditLabel}
        onEditTagsChange={setEditTags}
        onUseInBuilder={onUseInBuilder}
        onGeneratePages={onGeneratePagesFromPhoto}
        onRequestDelete={setPendingDelete}
        onUploadClick={() => fileInputRef.current?.click()}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete "${pendingDelete?.label ?? ''}" from gallery?`}
        description="This removes the photo from your workspace gallery (and moves any synced Google Drive copy to Trash). Already generated book illustrations will not be affected."
        confirmLabel="Delete Photo"
        tone="danger"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
