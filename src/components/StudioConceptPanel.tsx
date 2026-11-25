import { ArrowRight, Loader2, Sparkles, Upload } from 'lucide-react';
import type {
  KdpTrimSize,
  Product,
  ProductCategory,
  StorageAsset,
} from '../types/workspace';
import {
  STYLE_PRESET_OPTIONS,
  pickStylePresetForProduct,
} from '../lib/workspaceLogic';
import { AssetPreviewImage } from './AssetPreviewImage';

interface StudioConceptPanelProps {
  creatingNew: boolean;
  product: Product | null;
  title: string;
  subtitle: string;
  category: ProductCategory;
  trimSize: KdpTrimSize;
  pageCount: string;
  includeBleed: boolean;
  targetAudience: string;
  conceptSummary: string;
  artStylePreset: string;
  newRefPhoto: { name: string; mimeType: string; dataUrl: string } | null;
  refPhotoInputRef: React.RefObject<HTMLInputElement | null>;
  savedReferenceAsset: StorageAsset | null;
  generatingPack: boolean;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  setSubtitle: React.Dispatch<React.SetStateAction<string>>;
  setCategory: React.Dispatch<React.SetStateAction<ProductCategory>>;
  setTrimSize: React.Dispatch<React.SetStateAction<KdpTrimSize>>;
  setPageCount: React.Dispatch<React.SetStateAction<string>>;
  setIncludeBleed: React.Dispatch<React.SetStateAction<boolean>>;
  setTargetAudience: React.Dispatch<React.SetStateAction<string>>;
  setConceptSummary: React.Dispatch<React.SetStateAction<string>>;
  setArtStylePreset: React.Dispatch<React.SetStateAction<string>>;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleStep1SaveAndGeneratePrompts: (e: React.FormEvent) => Promise<void>;
  onSkipToGenerate: () => void;
}

/** Tab 1 — Concept & Specs form. State and handlers live in StudioView. */
export function StudioConceptPanel({
  creatingNew,
  product,
  title,
  subtitle,
  category,
  trimSize,
  pageCount,
  includeBleed,
  targetAudience,
  conceptSummary,
  artStylePreset,
  newRefPhoto,
  refPhotoInputRef,
  savedReferenceAsset,
  generatingPack,
  setTitle,
  setSubtitle,
  setCategory,
  setTrimSize,
  setPageCount,
  setIncludeBleed,
  setTargetAudience,
  setConceptSummary,
  setArtStylePreset,
  handlePhotoUpload,
  handleStep1SaveAndGeneratePrompts,
  onSkipToGenerate,
}: StudioConceptPanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Concept: Describe Your Book or Product Idea
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Enter your title, format, and idea. FolioPress will auto-fill editable prompts for your cover, story copy, KDP listing, and interior pages.
          </p>
        </div>
        {!creatingNew && product?.promptPack && (
          <button
            type="button"
            onClick={onSkipToGenerate}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
          >
            Skip to Generate
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <form onSubmit={handleStep1SaveAndGeneratePrompts} className="mt-5 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="builder-title" className="block text-xs font-medium text-slate-700">
              Book or Product Title *
            </label>
            <input
              id="builder-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Zebo's Backyard Adventure"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="builder-subtitle" className="block text-xs font-medium text-slate-700">
              Subtitle (Optional)
            </label>
            <input
              id="builder-subtitle"
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="e.g., A Cozy Bedtime Story for Ages 4–7"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="builder-category" className="block text-xs font-medium text-slate-700">
              Product Type
            </label>
            <select
              id="builder-category"
              value={category}
              onChange={(e) => {
                const nextCat = e.target.value as ProductCategory;
                setCategory(nextCat);
                setArtStylePreset(pickStylePresetForProduct(nextCat));
                if (nextCat === 'coloring-book') setTrimSize('8.5x11');
                else if (nextCat === 'art-print') setTrimSize('8x10');
                else if (nextCat === 'childrens-book') setTrimSize('8.5x8.5');
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            >
              <option value="childrens-book">Children&apos;s Picture Book</option>
              <option value="coloring-book">Coloring / Activity Book</option>
              <option value="art-print">Printable Wall Art</option>
              <option value="journal">Journal / Planner / Flashcards</option>
            </select>
          </div>

          <div>
            <label htmlFor="builder-trim" className="block text-xs font-medium text-slate-700">
              KDP Trim Size
            </label>
            <select
              id="builder-trim"
              value={trimSize}
              onChange={(e) => setTrimSize(e.target.value as KdpTrimSize)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            >
              <option value="8.5x8.5">8.5 × 8.5 in</option>
              <option value="8.5x11">8.5 × 11 in</option>
              <option value="6x9">6 × 9 in</option>
              <option value="8x10">8 × 10 in</option>
            </select>
          </div>

          <div>
            <label htmlFor="builder-pages" className="block text-xs font-medium text-slate-700">
              Target Pages
            </label>
            <input
              id="builder-pages"
              type="number"
              min={1}
              max={828}
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="builder-audience" className="block text-xs font-medium text-slate-700">
              Target Audience
            </label>
            <input
              id="builder-audience"
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g., Ages 4–7 & Parents"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="builder-concept" className="block text-xs font-medium text-slate-700">
            Book Concept / Theme Brief
          </label>
          <textarea
            id="builder-concept"
            rows={3}
            value={conceptSummary}
            onChange={(e) => setConceptSummary(e.target.value)}
            placeholder="Describe your main character, story arc, coloring themes, or what makes this product special…"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 md:grid-cols-2">
          <div>
            <label htmlFor="builder-style" className="block text-xs font-medium text-slate-700">
              Default Art Direction Style
            </label>
            <select
              id="builder-style"
              value={artStylePreset}
              onChange={(e) => setArtStylePreset(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
            >
              {STYLE_PRESET_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={includeBleed}
                onChange={(e) => setIncludeBleed(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              Include KDP full-bleed margins (+0.125&quot; width, +0.25&quot; height)
            </label>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700">
              Reference Photo (Optional — Photo to Cartoon)
            </span>
            <input
              ref={refPhotoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            {newRefPhoto || (!creatingNew && savedReferenceAsset) ? (
              <div className="mt-1 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-slate-200 bg-white">
                  {newRefPhoto ? (
                    <img
                      src={newRefPhoto.dataUrl}
                      alt="Uploaded reference photo"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <AssetPreviewImage
                      src={savedReferenceAsset?.url}
                      alt="Saved reference photo"
                      fallbackLabel="Photo"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-slate-900">
                    {newRefPhoto?.name ?? savedReferenceAsset?.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => refPhotoInputRef.current?.click()}
                    className="mt-0.5 text-xs font-medium text-blue-700 hover:text-blue-800"
                  >
                    Replace photo
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => refPhotoInputRef.current?.click()}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50/70 px-3 py-2.5 text-xs font-medium text-slate-700 hover:border-blue-600 hover:text-blue-800"
              >
                <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                Upload Character / Pet Photo
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="submit"
            disabled={generatingPack}
            className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {generatingPack ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Generating Editable Prompts…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Save &amp; Auto-Fill Prompts
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
