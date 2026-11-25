import { useMemo, useRef, useState } from 'react';
import {
  Check,
  Cloud,
  ExternalLink,
  Images,
  Layers,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { GalleryImage, Product, WorkspaceSettings } from '../types/workspace';
import { formatBytes } from '../lib/workspaceLogic';
import { AssetPreviewImage } from './AssetPreviewImage';
import { ConfirmDialog } from './ConfirmDialog';

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
      {/* Header & Controls */}
      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900 sm:text-lg">
              Uploaded Image Gallery
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Upload a character, pet, or reference photo once, store it with Google Drive via Apps Script, and reuse it to generate multiple distinct illustrated book pages.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
            <button
              type="button"
              disabled={syncing || !settings.appsScriptConfigured}
              onClick={handleSync}
              title={
                settings.appsScriptConfigured
                  ? 'Push unsynced photos to Google Drive & pull Image_Gallery rows from Apps Script'
                  : 'Connect Apps Script Web App URL in Settings & Sync first'
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-slate-500 ${syncing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {syncing ? 'Syncing…' : 'Sync with Apps Script'}
            </button>

            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Upload Photos
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search photos by name or tag…"
              aria-label="Search uploaded gallery images"
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="font-mono tabular-nums">
              {galleryImages.length} {galleryImages.length === 1 ? 'photo' : 'photos'} saved
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {syncedCount} backed up in Google Drive
            </span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
          >
            {error}
          </div>
        )}
      </section>

      {/* Gallery Grid */}
      {filteredImages.length === 0 ? (
        <section className="rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
          <Images className="mx-auto h-9 w-9 text-slate-300" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            {galleryImages.length === 0
              ? 'No uploaded photos in your gallery yet'
              : 'No photos match your search'}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            {galleryImages.length === 0
              ? 'Upload one photo of a child, pet, or character here. FolioPress stores it in your gallery (and backs it up to Google Drive via Apps Script) so you can generate an entire multi-page illustrated book from a single photo.'
              : 'Try clearing your search filter or upload a new reference photo.'}
          </p>
          {galleryImages.length === 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Upload Your First Photo
            </button>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredImages.map((img) => {
            const isEditing = editingId === img.id;
            return (
              <article
                key={img.id}
                className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                  <AssetPreviewImage
                    src={img.url}
                    alt={img.label}
                    fallbackLabel={img.label}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-3.5">
                  <div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          aria-label="Photo label"
                          placeholder="Photo name"
                          className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={editTags}
                          onChange={(e) => setEditTags(e.target.value)}
                          aria-label="Photo tags"
                          placeholder="Tags (comma separated)"
                          className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-700 focus:outline-none"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingEdit}
                            onClick={() => handleSaveEdit(img.id)}
                            className="inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-900">
                            {img.label}
                          </h3>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              aria-label={`Rename ${img.label}`}
                              onClick={() => startEditing(img)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${img.label}`}
                              onClick={() => setPendingDelete(img)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-mono tabular-nums">
                            {img.sizeBytes > 0 ? formatBytes(img.sizeBytes) : 'Drive'}
                          </span>
                          <span aria-hidden="true">·</span>
                          {img.driveWebLink ? (
                            <a
                              href={img.driveWebLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
                            >
                              <Cloud className="h-3 w-3" aria-hidden="true" />
                              Drive
                              <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                            </a>
                          ) : (
                            <span>Stored locally</span>
                          )}
                        </div>

                        {img.tags.length > 0 && (
                          <div className="mt-1.5 truncate text-[11px] text-slate-500">
                            Tags: {img.tags.join(', ')}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => onGeneratePagesFromPhoto(img)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-700 px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Multi-Page
                    </button>
                    <button
                      type="button"
                      onClick={() => onUseInBuilder(img)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Layers className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
                      Book Builder
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

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
