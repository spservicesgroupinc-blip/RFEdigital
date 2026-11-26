import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ImagePlus,
  Images,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import type { GalleryImage, GenerationProvider, GenerationRecord, PageTextLayout, Product, ProductPromptPack, StorageAsset, WorkspaceSettings } from '../../types/workspace';
import { STYLE_PRESET_OPTIONS } from '../../lib/workspaceLogic';
import type { parseManuscriptIntoSpreads } from '../../lib/workspaceLogic';
import { AssetPreviewImage } from '../AssetPreviewImage';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

interface PromptEditorProps {
  product: Product;
  editablePack: ProductPromptPack;
  settings: WorkspaceSettings;
  provider: GenerationProvider;
  setProvider: React.Dispatch<React.SetStateAction<GenerationProvider>>;
  savingPrompts: boolean;
  promptDirty: boolean;
  generatingPack: boolean;
  runningKey: string | null;
  batchStatus: string | null;
  artStylePreset: string;
  setArtStylePreset: React.Dispatch<React.SetStateAction<string>>;
  galleryImages: GalleryImage[];
  selectedGalleryImage: GalleryImage | null;
  savedReferenceAsset: StorageAsset | null;
  hasActiveRefPhoto: boolean;
  selectedGalleryImageId: string | null;
  setSelectedGalleryImageId: React.Dispatch<React.SetStateAction<string | null>>;
  refPhotoInputRef: React.RefObject<HTMLInputElement | null>;
  coverAsset: StorageAsset | null;
  assets: StorageAsset[];
  latestManuscriptGen: GenerationRecord | undefined;
  latestListingGen: GenerationRecord | undefined;
  parsedStorySpreads: ReturnType<typeof parseManuscriptIntoSpreads>;
  pageDrafts: Record<string, { storyText: string; textPlacement: PageTextLayout | '' }>;
  setPageDrafts: React.Dispatch<
    React.SetStateAction<Record<string, { storyText: string; textPlacement: PageTextLayout | '' }>>
  >;
  savingAssetId: string | null;
  handleSavePageDesign: (asset: StorageAsset) => Promise<void>;
  updatePackField: <K extends keyof ProductPromptPack>(key: K, value: ProductPromptPack[K]) => void;
  handleSavePromptEdits: () => Promise<ProductPromptPack | null>;
  handleRegeneratePrompts: () => Promise<void>;
  handleBuildAllSections: () => Promise<void>;
  handleGenerateBook: () => Promise<void>;
  generateBookStage: string | null;
  handleGenerateCover: () => void;
  handleGenerateStory: () => void;
  handleGenerateListing: () => void;
  handleGenerateInteriorPage: (pageIndex: number) => void;
  handleGenerateAllPagesFromPhoto: () => Promise<void>;
  handleSyncPromptsFromStory: () => Promise<void>;
  handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenGallery: () => void;
  onBackToConcept: () => void;
  onReviewPages: () => void;
}

export function PromptEditor({
  product,
  editablePack,
  settings,
  provider,
  setProvider,
  savingPrompts,
  promptDirty,
  generatingPack,
  runningKey,
  batchStatus,
  artStylePreset,
  setArtStylePreset,
  galleryImages,
  selectedGalleryImage,
  savedReferenceAsset,
  hasActiveRefPhoto,
  selectedGalleryImageId,
  setSelectedGalleryImageId,
  refPhotoInputRef,
  coverAsset,
  assets,
  latestManuscriptGen,
  latestListingGen,
  parsedStorySpreads,
  pageDrafts,
  setPageDrafts,
  savingAssetId,
  handleSavePageDesign,
  updatePackField,
  handleSavePromptEdits,
  handleRegeneratePrompts,
  handleBuildAllSections,
  handleGenerateBook,
  generateBookStage,
  handleGenerateCover,
  handleGenerateStory,
  handleGenerateListing,
  handleGenerateInteriorPage,
  handleGenerateAllPagesFromPhoto,
  handleSyncPromptsFromStory,
  handlePhotoUpload,
  onOpenGallery,
  onBackToConcept,
  onReviewPages,
}: PromptEditorProps) {
  const headerDescription = editablePack.sourceTrendTitle
    ? `Auto-filled from Market Trend "${editablePack.sourceTrendTitle}". Edit any prompt below, then generate one section at a time or build everything at once.`
    : 'Every section prompt is pre-filled from your concept. Tweak any wording you like before generating your artwork and copy.';

  return (
    <Card id="studio-prompts-section">
      <CardHeader
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="AI Provider for generation"
              value={provider}
              onChange={(e) => setProvider(e.target.value as GenerationProvider)}
              className="w-auto"
            >
              <option value="openrouter">
                OpenRouter {settings.openRouterConfigured ? '(Active)' : '(Needs Key)'}
              </option>
              <option value="gemini">Gemini 4 Hydrogen</option>
            </Select>

            <Button
              variant={promptDirty ? 'secondary' : 'outline'}
              size="sm"
              leadingIcon={<Save className="h-3.5 w-3.5" />}
              disabled={savingPrompts || !promptDirty}
              onClick={handleSavePromptEdits}
            >
              {savingPrompts ? 'Saving…' : promptDirty ? 'Save Prompt Edits' : 'Edits Saved'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              leadingIcon={<RefreshCw className={`h-3.5 w-3.5 ${generatingPack ? 'animate-spin' : ''}`} />}
              disabled={generatingPack || Boolean(runningKey)}
              onClick={handleRegeneratePrompts}
            >
              Refresh with AI
            </Button>

            <Button
              variant="primary"
              size="sm"
              leadingIcon={generateBookStage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              disabled={Boolean(runningKey) || Boolean(generateBookStage)}
              onClick={handleGenerateBook}
            >
              {generateBookStage ? generateBookStage : 'Generate Book'}
            </Button>
          </div>
        }
      >
        <CardTitle>Generate: Review &amp; Edit Prompts Before Generating</CardTitle>
        <CardDescription>{headerDescription}</CardDescription>
      </CardHeader>

      {batchStatus && (
        <div
          role="status"
          className="flex items-center gap-2 border-b border-primary-200 bg-primary-subtle px-5 py-2.5 text-xs font-medium text-primary-900 sm:px-6"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
          {batchStatus}
        </div>
      )}

      <div className="space-y-3 border-b border-border-subtle bg-surface-secondary px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <label htmlFor="step2-art-style" className="whitespace-nowrap text-xs font-medium text-text-secondary">
              Art Style:
            </label>
            <Select
              id="step2-art-style"
              value={artStylePreset}
              onChange={(e) => {
                setArtStylePreset(e.target.value);
                updatePackField('artStylePreset', e.target.value);
              }}
              className="max-w-full flex-1 sm:max-w-md"
            >
              {STYLE_PRESET_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button variant="outline" size="sm" leadingIcon={<Upload className="h-3.5 w-3.5" />} onClick={() => refPhotoInputRef.current?.click()}>
              Upload Photo
            </Button>
            <Button variant="outline" size="sm" leadingIcon={<Images className="h-3.5 w-3.5" />} onClick={onOpenGallery}>
              Image Gallery ({galleryImages.length})
            </Button>
            <input
              ref={refPhotoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {selectedGalleryImage || savedReferenceAsset ? (
              <>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-primary-200 bg-surface-secondary">
                  <AssetPreviewImage
                    src={selectedGalleryImage?.url ?? savedReferenceAsset?.url}
                    alt={selectedGalleryImage?.label ?? savedReferenceAsset?.name ?? 'Reference'}
                    fallbackLabel="Photo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-text">
                    Character Reference: {selectedGalleryImage?.label ?? savedReferenceAsset?.name}
                  </div>
                  <p className="text-[11px] text-text-muted">
                    AI keeps this character&apos;s likeness while creating a brand-new pose, setting &amp; camera angle on every page.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-text-muted">
                Pick a photo from your Image Gallery or upload one photo to generate an entire multi-page illustrated book featuring that character.
              </p>
            )}
          </div>

          {hasActiveRefPhoto && (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={runningKey === 'photo-pages' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              disabled={Boolean(runningKey)}
              onClick={handleGenerateAllPagesFromPhoto}
              className="whitespace-nowrap"
            >
              {runningKey === 'photo-pages'
                ? 'Generating Book Pages…'
                : `Generate All ${editablePack.interiorPrompts.length + 1} Pages From Photo`}
            </Button>
          )}
        </div>

        {galleryImages.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <span className="shrink-0 text-[11px] font-medium text-text-muted">Gallery:</span>
            {galleryImages.slice(0, 10).map((img) => {
              const active = selectedGalleryImageId === img.id;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedGalleryImageId(active ? null : img.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary-subtle text-primary-900'
                      : 'border-border bg-surface text-text-secondary hover:border-border-strong'
                  }`}
                >
                  <span className="h-5 w-5 shrink-0 overflow-hidden rounded-xs bg-surface-tertiary">
                    <AssetPreviewImage
                      src={img.url}
                      alt={img.label}
                      fallbackLabel=""
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="max-w-[110px] truncate">{img.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="divide-y divide-border">
        <PromptSection
          title="Front Cover Artwork Prompt"
          description="Generates the main cover image saved directly to your product folder."
          running={runningKey === 'cover'}
          runningLabel="Generating Cover…"
          actionLabel="Generate Cover"
          actionIcon={<ImagePlus className="h-3.5 w-3.5" />}
          disabled={Boolean(runningKey) || !editablePack.coverPrompt.trim()}
          onAction={handleGenerateCover}
        >
          <div className="mt-3 flex flex-col gap-4 sm:flex-row">
            <Textarea
              rows={3}
              aria-label="Front cover art prompt"
              value={editablePack.coverPrompt}
              onChange={(e) => updatePackField('coverPrompt', e.target.value)}
              className="flex-1"
            />
            {coverAsset && (
              <div className="h-28 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-surface-secondary">
                <AssetPreviewImage src={coverAsset.url} alt="Generated cover preview" fallbackLabel="Cover" />
              </div>
            )}
          </div>
        </PromptSection>

        <PromptSection
          title="Story / Interior Copy Prompt"
          description="Drafts the full manuscript, front matter, or page-by-page copy for your product."
          running={runningKey === 'manuscript'}
          runningLabel="Writing Copy…"
          actionLabel="Generate Copy"
          actionIcon={<Wand2 className="h-3.5 w-3.5" />}
          disabled={Boolean(runningKey) || !editablePack.manuscriptPrompt.trim()}
          onAction={handleGenerateStory}
          variant="secondary"
        >
          <Textarea
            rows={3}
            aria-label="Story and interior copy prompt"
            value={editablePack.manuscriptPrompt}
            onChange={(e) => updatePackField('manuscriptPrompt', e.target.value)}
            className="mt-3"
          />
          {latestManuscriptGen?.outputText && (
            <div className="mt-3 rounded-md border border-border bg-surface-secondary p-3 text-xs text-text-secondary">
              <div className="font-medium text-text">Latest Generated Copy</div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                {latestManuscriptGen.outputText}
              </p>
            </div>
          )}
        </PromptSection>

        <PromptSection
          title="KDP / Storefront Listing &amp; Keywords Prompt"
          description="Generates subtitle ideas, product blurb, categories, and 7 high-intent keywords."
          running={runningKey === 'kdp-metadata'}
          runningLabel="Drafting Listing…"
          actionLabel="Generate Listing"
          actionIcon={<Wand2 className="h-3.5 w-3.5" />}
          disabled={Boolean(runningKey) || !editablePack.kdpMetadataPrompt.trim()}
          onAction={handleGenerateListing}
          variant="secondary"
        >
          <Textarea
            rows={3}
            aria-label="KDP listing and keywords prompt"
            value={editablePack.kdpMetadataPrompt}
            onChange={(e) => updatePackField('kdpMetadataPrompt', e.target.value)}
            className="mt-3"
          />
          {latestListingGen?.outputText && (
            <div className="mt-3 rounded-md border border-border bg-surface-secondary p-3 text-xs text-text-secondary">
              <div className="font-medium text-text">Latest Generated Listing</div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                {latestListingGen.outputText}
              </p>
            </div>
          )}
        </PromptSection>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-text">
                Interior Page Prompts{' '}
                <span className="ml-1 font-mono text-xs font-normal text-text-muted tabular-nums">
                  ({editablePack.interiorPrompts.length})
                </span>
              </h4>
              <p className="text-xs text-text-muted">Edit each page or spread prompt before generating, or add extra pages.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<BookOpen className="h-3.5 w-3.5" />}
                disabled={parsedStorySpreads.length === 0 || Boolean(runningKey)}
                onClick={handleSyncPromptsFromStory}
                title={
                  parsedStorySpreads.length > 0
                    ? `Sync all page prompts to your ${parsedStorySpreads.length} story spreads`
                    : 'Generate or write story text first'
                }
              >
                Sync Prompts From Story{parsedStorySpreads.length > 0 ? ` (${parsedStorySpreads.length})` : ''}
              </Button>
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() =>
                  updatePackField('interiorPrompts', [
                    ...editablePack.interiorPrompts,
                    {
                      id: `page-${Date.now().toString(36)}`,
                      title: `Page ${editablePack.interiorPrompts.length + 1} — New Scene`,
                      prompt: `Publication-ready interior illustration for "${product.title}" matching the established art style and ${product.trimSize}" composition.`,
                    },
                  ])
                }
              >
                Add Page Prompt
              </Button>
            </div>
          </div>

          <div className="mt-4 divide-y divide-border rounded-md border border-border">
            {editablePack.interiorPrompts.map((page, idx) => {
              const linkedAsset = page.generatedAssetId ? assets.find((a) => a.id === page.generatedAssetId) : null;
              const isRunningThis = runningKey === `page-${idx}`;
              const matchedStoryText = page.storyText?.trim() || parsedStorySpreads[idx]?.storyText || '';

              return (
                <div key={page.id || idx} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-medium text-text-muted tabular-nums">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <input
                      type="text"
                      aria-label={`Interior page ${idx + 1} title`}
                      value={page.title}
                      onChange={(e) =>
                        updatePackField(
                          'interiorPrompts',
                          editablePack.interiorPrompts.map((item, i) =>
                            i === idx ? { ...item, title: e.target.value } : item
                          )
                        )
                      }
                      className="min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-ring"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={Boolean(runningKey) || !page.prompt.trim()}
                      onClick={() => handleGenerateInteriorPage(idx)}
                    >
                      {isRunningThis ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          Generating…
                        </>
                      ) : linkedAsset ? (
                        'Regenerate'
                      ) : (
                        'Generate Page'
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${page.title}`}
                      onClick={() =>
                        updatePackField(
                          'interiorPrompts',
                          editablePack.interiorPrompts.filter((_, i) => i !== idx)
                        )
                      }
                      className="h-7 w-7 p-0 text-text-muted hover:bg-danger-subtle hover:text-danger"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>

                  {linkedAsset ? (
                    <div className="mt-2">
                      <label className="text-[11px] font-medium text-text-muted">Story Text</label>
                      <div className="mt-1 flex items-start gap-2">
                        <Textarea
                          rows={2}
                          aria-label={`Interior page ${idx + 1} story text`}
                          value={pageDrafts[linkedAsset.id]?.storyText ?? linkedAsset.storyText ?? ''}
                          onChange={(e) =>
                            setPageDrafts((prev) => ({
                              ...prev,
                              [linkedAsset.id]: {
                                storyText: e.target.value,
                                textPlacement: prev[linkedAsset.id]?.textPlacement ?? '',
                              },
                            }))
                          }
                          className="flex-1"
                        />
                        {(pageDrafts[linkedAsset.id]?.storyText ?? linkedAsset.storyText ?? '') !==
                          (linkedAsset.storyText ?? '') && (
                          <Button
                            variant="primary"
                            size="sm"
                            leadingIcon={<Save className="h-3 w-3" />}
                            disabled={savingAssetId === linkedAsset.id}
                            onClick={() => handleSavePageDesign(linkedAsset)}
                          >
                            {savingAssetId === linkedAsset.id ? 'Saving…' : 'Save'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    matchedStoryText && (
                      <div className="mt-2 rounded-md border border-warning-100 bg-warning-subtle px-3 py-2 text-[11px] leading-relaxed text-warning-900">
                        <span className="font-semibold text-warning-700">Matched Story Text: </span>
                        <span className="italic">&ldquo;{matchedStoryText}&rdquo;</span>
                      </div>
                    )
                  )}

                  <div className="mt-2.5 flex flex-col gap-3 sm:flex-row">
                    <Textarea
                      rows={2}
                      aria-label={`Interior page ${idx + 1} prompt`}
                      value={page.prompt}
                      onChange={(e) =>
                        updatePackField(
                          'interiorPrompts',
                          editablePack.interiorPrompts.map((item, i) =>
                            i === idx ? { ...item, prompt: e.target.value } : item
                          )
                        )
                      }
                      className="flex-1 bg-surface-secondary focus:bg-surface"
                    />
                    {linkedAsset && (
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded border border-border bg-surface-secondary">
                        <AssetPreviewImage src={linkedAsset.url} alt={page.title} fallbackLabel={page.title} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-4 sm:px-6">
        <Button variant="outline" size="md" leadingIcon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onBackToConcept}>
          Back to Concept
        </Button>
        <Button
          variant="primary"
          size="md"
          trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          onClick={async () => {
            if (promptDirty) await handleSavePromptEdits();
            onReviewPages();
          }}
        >
          Review Pages &amp; Copy
        </Button>
      </div>
    </Card>
  );
}

interface PromptSectionProps {
  title: string;
  description: string;
  running: boolean;
  runningLabel: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  disabled: boolean;
  onAction: () => void;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

function PromptSection({
  title,
  description,
  running,
  runningLabel,
  actionLabel,
  actionIcon,
  disabled,
  onAction,
  variant = 'primary',
  children,
}: PromptSectionProps) {
  return (
    <div className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-text">{title}</h4>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
        <Button
          variant={variant}
          size="sm"
          leadingIcon={running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : actionIcon}
          disabled={disabled}
          onClick={onAction}
        >
          {running ? runningLabel : actionLabel}
        </Button>
      </div>
      {children}
    </div>
  );
}
