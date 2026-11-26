import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Modal } from '../ui/Modal';
import type {
  KdpTrimSize,
  Product,
  ProductCategory,
  ProductStatus,
  Series,
} from '../../types/workspace';
import { validateProductInput } from '../../lib/workspaceLogic';

interface NewProductModalProps {
  open: boolean;
  onClose: () => void;
  series: Series[];
  onCreate: (payload: {
    title: string;
    subtitle: string;
    category: ProductCategory;
    status: ProductStatus;
    trimSize: KdpTrimSize;
    pageCount: number;
    includeBleed: boolean;
    seriesId: string | null;
    isbn: string;
    manuscriptNotes: string;
    referencePhoto?: { name: string; mimeType: string; dataUrl: string };
  }) => Promise<Product>;
}

export function NewProductModal({ open, onClose, series, onCreate }: NewProductModalProps) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<ProductCategory>('childrens-book');
  const [trimSize, setTrimSize] = useState<KdpTrimSize>('8.5x8.5');
  const [pageCount, setPageCount] = useState('24');
  const [includeBleed, setIncludeBleed] = useState(true);
  const [seriesId, setSeriesId] = useState('');
  const [isbn, setIsbn] = useState('');
  const [manuscriptNotes, setManuscriptNotes] = useState('');
  const [referencePhoto, setReferencePhoto] = useState<{
    name: string;
    mimeType: string;
    dataUrl: string;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setFormErrors((prev) => ({ ...prev, referencePhoto: 'Upload a PNG, JPEG, or WebP photo.' }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormErrors((prev) => ({ ...prev, referencePhoto: 'Photo must be under 10 MB.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReferencePhoto({
        name: file.name,
        mimeType: file.type,
        dataUrl: String(reader.result),
      });
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.referencePhoto;
        return next;
      });
    };
    reader.onerror = () => {
      setFormErrors((prev) => ({ ...prev, referencePhoto: 'Could not read the selected photo.' }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPages = Number(pageCount);
    const check = validateProductInput({ title, pageCount: parsedPages, category, trimSize });
    if (!check.valid) {
      setFormErrors(check.errors);
      return;
    }

    setSubmitting(true);
    setFormErrors({});
    try {
      await onCreate({
        title: title.trim(),
        subtitle: subtitle.trim(),
        category,
        status: 'draft',
        trimSize,
        pageCount: parsedPages,
        includeBleed,
        seriesId: seriesId || null,
        isbn: isbn.trim(),
        manuscriptNotes: manuscriptNotes.trim(),
        referencePhoto: referencePhoto ?? undefined,
      });
      reset();
      onClose();
    } catch (err) {
      setFormErrors({ form: err instanceof Error ? err.message : 'Unable to save product.' });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setTitle('');
    setSubtitle('');
    setCategory('childrens-book');
    setTrimSize('8.5x8.5');
    setPageCount('24');
    setIncludeBleed(true);
    setSeriesId('');
    setIsbn('');
    setManuscriptNotes('');
    setReferencePhoto(null);
    setFormErrors({});
    if (inputRef.current) inputRef.current.value = '';
  };

  const footer = (
    <>
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" form="new-product-form" isLoading={submitting}>
        {submitting ? 'Creating & Auto-Filling…' : 'Create & Edit Prompts'}
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="New Digital Product" footer={footer} size="lg">
      <form id="new-product-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {formErrors.form && (
          <p role="alert" className="rounded-md border border-danger-100 bg-danger-subtle px-3 py-2 text-xs text-danger">
            {formErrors.form}
          </p>
        )}

        <div>
          <label htmlFor="prod-title" className="block text-xs font-medium text-text-secondary">
            Product Title *
          </label>
          <Input
            id="prod-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Moonlight Harbor"
            error={formErrors.title}
            className="mt-1"
          />
        </div>

        <div>
          <label htmlFor="prod-subtitle" className="block text-xs font-medium text-text-secondary">
            Subtitle / Edition Note
          </label>
          <Input
            id="prod-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="e.g., A Bedtime Picture Book for Ages 4–7"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="prod-category" className="block text-xs font-medium text-text-secondary">
              Category
            </label>
            <Select
              id="prod-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="mt-1"
            >
              <option value="childrens-book">Children&apos;s Book</option>
              <option value="coloring-book">Coloring Book</option>
              <option value="art-print">Art Print</option>
              <option value="journal">Journal</option>
            </Select>
          </div>
          <div>
            <label htmlFor="prod-series" className="block text-xs font-medium text-text-secondary">
              Series
            </label>
            <Select
              id="prod-series"
              value={seriesId}
              onChange={(e) => setSeriesId(e.target.value)}
              className="mt-1"
            >
              <option value="">Standalone title</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="prod-trim" className="block text-xs font-medium text-text-secondary">
              KDP Trim Size
            </label>
            <Select
              id="prod-trim"
              value={trimSize}
              onChange={(e) => setTrimSize(e.target.value as KdpTrimSize)}
              className="mt-1 font-mono"
            >
              <option value="8.5x8.5">8.5 × 8.5 in</option>
              <option value="6x9">6 × 9 in</option>
              <option value="8.5x11">8.5 × 11 in</option>
              <option value="8x10">8 × 10 in</option>
            </Select>
          </div>
          <div>
            <label htmlFor="prod-pages" className="block text-xs font-medium text-text-secondary">
              Page Count
            </label>
            <Input
              id="prod-pages"
              type="number"
              min={1}
              max={828}
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
              error={formErrors.pageCount}
              className="mt-1 font-mono tabular-nums"
            />
          </div>
          <div>
            <label htmlFor="prod-isbn" className="block text-xs font-medium text-text-secondary">
              ISBN / SKU
            </label>
            <Input
              id="prod-isbn"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="Auto if blank"
              className="mt-1 font-mono"
            />
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={includeBleed}
            onChange={(e) => setIncludeBleed(e.target.checked)}
            className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary"
          />
          Include KDP full-bleed margins (+0.125&quot; width, +0.25&quot; height)
        </label>

        <div>
          <label htmlFor="prod-notes" className="block text-xs font-medium text-text-secondary">
            Initial Manuscript / Art Brief
          </label>
          <Textarea
            id="prod-notes"
            rows={3}
            value={manuscriptNotes}
            onChange={(e) => setManuscriptNotes(e.target.value)}
            placeholder="Optional story notes, visual motifs, or target KDP keywords…"
            className="mt-1"
          />
        </div>

        <div className="rounded-md border border-border bg-surface-secondary p-3.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="prod-ref-photo" className="block text-xs font-medium text-text-secondary">
              Reference Photo (Optional — for AI Cartoon / Illustration)
            </label>
            {referencePhoto && (
              <button
                type="button"
                onClick={() => {
                  setReferencePhoto(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="text-xs font-medium text-danger hover:text-danger-700"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-text-muted">
            Upload a photo of a pet, character, or object to turn it into cartoon or storybook art with OpenRouter.
          </p>

          <input
            ref={inputRef}
            id="prod-ref-photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {referencePhoto ? (
            <div className="mt-2.5 flex items-center gap-3 rounded-md border border-border bg-surface p-2.5">
              <img
                src={referencePhoto.dataUrl}
                alt="Selected reference photo preview"
                className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-text">{referencePhoto.name}</div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-1 text-xs font-medium text-primary hover:text-primary-hover"
                >
                  Choose different photo
                </button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="md"
              leadingIcon={<ImagePlus className="h-4 w-4" />}
              onClick={() => inputRef.current?.click()}
              className="mt-2.5 w-full"
            >
              Upload Photo (PNG, JPEG, or WebP)
            </Button>
          )}

          {formErrors.referencePhoto && (
            <p role="alert" className="mt-1.5 text-xs text-danger">
              {formErrors.referencePhoto}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
