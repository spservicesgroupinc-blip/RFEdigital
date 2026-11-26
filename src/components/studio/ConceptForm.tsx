import { ArrowRight, Loader2, Sparkles, Upload } from 'lucide-react';
import type { KdpTrimSize, Product, ProductCategory, StorageAsset } from '../../types/workspace';
import { STYLE_PRESET_OPTIONS, pickStylePresetForProduct } from '../../lib/workspaceLogic';
import { AssetPreviewImage } from '../AssetPreviewImage';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

interface ConceptFormProps {
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

export function ConceptForm({
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
}: ConceptFormProps) {
  const hasPhoto = Boolean(newRefPhoto || savedReferenceAsset);

  return (
    <Card>
      <CardHeader
        action={
          !creatingNew && product?.promptPack ? (
            <Button variant="ghost" size="sm" trailingIcon={<ArrowRight className="h-3.5 w-3.5" />} onClick={onSkipToGenerate}>
              Skip to Generate
            </Button>
          ) : undefined
        }
      >
        <CardTitle>Concept: Describe Your Book or Product Idea</CardTitle>
        <CardDescription>
          Enter your title, format, and idea. FolioPress will auto-fill editable prompts for your cover, story copy, KDP listing, and interior pages.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleStep1SaveAndGeneratePrompts} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="builder-title" className="block text-xs font-medium text-text-secondary">
                Book or Product Title *
              </label>
              <Input
                id="builder-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Zebo's Backyard Adventure"
                className="mt-1"
              />
            </div>

            <div>
              <label htmlFor="builder-subtitle" className="block text-xs font-medium text-text-secondary">
                Subtitle (Optional)
              </label>
              <Input
                id="builder-subtitle"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g., A Cozy Bedtime Story for Ages 4–7"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="builder-category" className="block text-xs font-medium text-text-secondary">
                Product Type
              </label>
              <Select
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
                className="mt-1"
              >
                <option value="childrens-book">Children&apos;s Picture Book</option>
                <option value="coloring-book">Coloring / Activity Book</option>
                <option value="art-print">Printable Wall Art</option>
                <option value="journal">Journal / Planner / Flashcards</option>
              </Select>
            </div>

            <div>
              <label htmlFor="builder-trim" className="block text-xs font-medium text-text-secondary">
                KDP Trim Size
              </label>
              <Select
                id="builder-trim"
                value={trimSize}
                onChange={(e) => setTrimSize(e.target.value as KdpTrimSize)}
                className="mt-1 font-mono"
              >
                <option value="8.5x8.5">8.5 × 8.5 in</option>
                <option value="8.5x11">8.5 × 11 in</option>
                <option value="6x9">6 × 9 in</option>
                <option value="8x10">8 × 10 in</option>
              </Select>
            </div>

            <div>
              <label htmlFor="builder-pages" className="block text-xs font-medium text-text-secondary">
                Target Pages
              </label>
              <Input
                id="builder-pages"
                type="number"
                min={1}
                max={828}
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <label htmlFor="builder-audience" className="block text-xs font-medium text-text-secondary">
                Target Audience
              </label>
              <Input
                id="builder-audience"
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Ages 4–7 & Parents"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label htmlFor="builder-concept" className="block text-xs font-medium text-text-secondary">
              Book Concept / Theme Brief
            </label>
            <Textarea
              id="builder-concept"
              rows={3}
              value={conceptSummary}
              onChange={(e) => setConceptSummary(e.target.value)}
              placeholder="Describe your main character, story arc, coloring themes, or what makes this product special…"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border-subtle pt-4 md:grid-cols-2">
            <div>
              <label htmlFor="builder-style" className="block text-xs font-medium text-text-secondary">
                Default Art Direction Style
              </label>
              <Select
                id="builder-style"
                value={artStylePreset}
                onChange={(e) => setArtStylePreset(e.target.value)}
                className="mt-1"
              >
                {STYLE_PRESET_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <label className="mt-3 flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={includeBleed}
                  onChange={(e) => setIncludeBleed(e.target.checked)}
                  className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary"
                />
                Include KDP full-bleed margins (+0.125&quot; width, +0.25&quot; height)
              </label>
            </div>

            <div>
              <span className="block text-xs font-medium text-text-secondary">
                Reference Photo (Optional — Photo to Cartoon)
              </span>
              <input
                ref={refPhotoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              {hasPhoto ? (
                <div className="mt-1 flex items-center gap-3 rounded-md border border-border bg-surface-secondary p-2.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-border bg-surface">
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
                    <div className="truncate text-xs font-medium text-text">
                      {newRefPhoto?.name ?? savedReferenceAsset?.name}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => refPhotoInputRef.current?.click()}
                      className="mt-0.5 h-auto px-0 py-0 text-xs"
                    >
                      Replace photo
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  leadingIcon={<Upload className="h-3.5 w-3.5" />}
                  onClick={() => refPhotoInputRef.current?.click()}
                  className="mt-1 w-full justify-center"
                >
                  Upload Character / Pet Photo
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={generatingPack}
              leadingIcon={<Sparkles className="h-4 w-4" />}
              className="whitespace-nowrap"
            >
              {generatingPack ? 'Generating Editable Prompts…' : 'Save & Auto-Fill Prompts'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
