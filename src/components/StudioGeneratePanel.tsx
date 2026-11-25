import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Copy,
  Download,
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
import type {
  GalleryImage,
  GenerationProvider,
  GenerationRecord,
  PageTextLayout,
  Product,
  ProductPromptPack,
  StorageAsset,
  WorkspaceSettings,
} from '../types/workspace';
import { STYLE_PRESET_OPTIONS } from '../lib/workspaceLogic';
import type { parseManuscriptIntoSpreads } from '../lib/workspaceLogic';
import { AssetPreviewImage } from './AssetPreviewImage';
import { PAGE_LAYOUT_OPTIONS } from './StudioShared';

interface StudioGeneratePanelProps {
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
  productAssets: StorageAsset[];
  pageUploadInputRef: React.RefObject<HTMLInputElement | null>;
  autoFillingPages: boolean;
  pageDrafts: Record<string, { storyText: string; textPlacement: PageTextLayout | '' }>;
  setPageDrafts: React.Dispatch<
    React.SetStateAction<Record<string, { storyText: string; textPlacement: PageTextLayout | '' }>>
  >;
  pageLayout: PageTextLayout;
  setPageLayout: React.Dispatch<React.SetStateAction<PageTextLayout>>;
  includeCoverTitle: boolean;
  setIncludeCoverTitle: React.Dispatch<React.SetStateAction<boolean>>;
  notesDraft: string;
  setNotesDraft: React.Dispatch<React.SetStateAction<string>>;
  notesDirty: boolean;
  setNotesDirty: React.Dispatch<React.SetStateAction<boolean>>;
  savingNotes: boolean;
  copiedNotes: boolean;
  setCopiedNotes: React.Dispatch<React.SetStateAction<boolean>>;
  savingAssetId: string | null;
  regeneratingAssetId: string | null;
  updatePackField: <K extends keyof ProductPromptPack>(
    key: K,
    value: ProductPromptPack[K]
  ) => void;
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
  handleDirectPageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAutoFillPagesFromManuscript: () => Promise<void>;
  handleMatchArtToPageText: (asset: StorageAsset, interiorIndex: number) => Promise<void>;
  handleSaveNotes: () => Promise<void>;
  handleSavePageDesign: (asset: StorageAsset) => Promise<void>;
  handleMovePage: (index: number, direction: -1 | 1) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
  onOpenGallery: () => void;
  onBackToConcept: () => void;
  onContinueToDownload: () => void;
}

/** Tab 2 - Generate: editable prompt pack (top) + story pages & copy (bottom). */
export function StudioGeneratePanel({
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
  productAssets,
  pageUploadInputRef,
  autoFillingPages,
  pageDrafts,
  setPageDrafts,
  pageLayout,
  setPageLayout,
  includeCoverTitle,
  setIncludeCoverTitle,
  notesDraft,
  setNotesDraft,
  notesDirty,
  setNotesDirty,
  savingNotes,
  copiedNotes,
  setCopiedNotes,
  savingAssetId,
  regeneratingAssetId,
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
  handleDirectPageUpload,
  handleAutoFillPagesFromManuscript,
  handleMatchArtToPageText,
  handleSaveNotes,
  handleSavePageDesign,
  handleMovePage,
  onDeleteAsset,
  onOpenGallery,
  onBackToConcept,
  onContinueToDownload,
}: StudioGeneratePanelProps) {
  return (
    <>
        <section id="studio-prompts-section" className="rounded-lg border border-slate-200 bg-white">
          {/* Header & Action Toolbar */}
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <h3 className="text-base font-semibold text-slate-900">
                Generate: Review &amp; Edit Prompts Before Generating
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {editablePack.sourceTrendTitle
                  ? `Auto-filled from Market Trend "${editablePack.sourceTrendTitle}". Edit any prompt below, then generate one section at a time or build everything at once.`
                  : 'Every section prompt is pre-filled from your concept. Tweak any wording you like before generating your artwork and copy.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                aria-label="AI Provider for generation"
                value={provider}
                onChange={(e) => setProvider(e.target.value as GenerationProvider)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none"
              >
                <option value="openrouter">
                  OpenRouter {settings.openRouterConfigured ? '(Active)' : '(Needs Key)'}
                </option>
                <option value="gemini">Gemini 4 Hydrogen</option>
              </select>

              <button
                type="button"
                disabled={savingPrompts || !promptDirty}
                onClick={handleSavePromptEdits}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  promptDirty
                    ? 'border-blue-700 bg-blue-50 text-blue-900 hover:bg-blue-100'
                    : 'border-slate-200 bg-white text-slate-500 disabled:opacity-50'
                }`}
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                {savingPrompts ? 'Saving…' : promptDirty ? 'Save Prompt Edits' : 'Edits Saved'}
              </button>

              <button
                type="button"
                disabled={generatingPack || Boolean(runningKey)}
                onClick={handleRegeneratePrompts}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${generatingPack ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh with AI
              </button>

              <button
                type="button"
                disabled={Boolean(runningKey) || Boolean(generateBookStage)}
                onClick={handleGenerateBook}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {generateBookStage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {generateBookStage}
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    Generate Book
                  </>
                )}
              </button>
            </div>
          </div>

          {batchStatus && (
            <div
              role="status"
              className="flex items-center gap-2 border-b border-blue-200 bg-blue-50 px-5 py-2.5 text-xs font-medium text-blue-900 sm:px-6"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" aria-hidden="true" />
              {batchStatus}
            </div>
          )}

          {/* Shared Art Style, Image Gallery Picker & 1-Photo Multi-Page Generator */}
          <div className="space-y-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-wrap items-center gap-2.5">
                <label
                  htmlFor="step2-art-style"
                  className="text-xs font-medium text-slate-700 whitespace-nowrap"
                >
                  Art Style:
                </label>
                <select
                  id="step2-art-style"
                  value={artStylePreset}
                  onChange={(e) => {
                    setArtStylePreset(e.target.value);
                    updatePackField('artStylePreset', e.target.value);
                  }}
                  className="max-w-full flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 sm:max-w-md"
                >
                  {STYLE_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => refPhotoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  Upload Photo
                </button>
                <button
                  type="button"
                  onClick={onOpenGallery}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Images className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  Image Gallery ({galleryImages.length})
                </button>
                <input
                  ref={refPhotoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Active Reference Photo + Gallery Strip + 1-Photo Multi-Page Action */}
            <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {selectedGalleryImage || savedReferenceAsset ? (
                  <>
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-blue-200 bg-slate-50">
                      <AssetPreviewImage
                        src={selectedGalleryImage?.url ?? savedReferenceAsset?.url}
                        alt={selectedGalleryImage?.label ?? savedReferenceAsset?.name ?? 'Reference'}
                        fallbackLabel="Photo"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-900">
                        Character Reference:{' '}
                        {selectedGalleryImage?.label ?? savedReferenceAsset?.name}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        AI keeps this character&apos;s likeness while creating a brand-new pose, setting &amp; camera angle on every page.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">
                    Pick a photo from your Image Gallery or upload one photo to generate an entire multi-page illustrated book featuring that character.
                  </p>
                )}
              </div>

              {hasActiveRefPhoto && (
                <button
                  type="button"
                  disabled={Boolean(runningKey)}
                  onClick={handleGenerateAllPagesFromPhoto}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-55 whitespace-nowrap shrink-0"
                >
                  {runningKey === 'photo-pages' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Generating Book Pages…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      Generate All {editablePack.interiorPrompts.length + 1} Pages From Photo
                    </>
                  )}
                </button>
              )}
            </div>

            {galleryImages.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                <span className="shrink-0 text-[11px] font-medium text-slate-500">
                  Gallery:
                </span>
                {galleryImages.slice(0, 10).map((img) => {
                  const active = selectedGalleryImageId === img.id;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() =>
                        setSelectedGalleryImageId(active ? null : img.id)
                      }
                      className={`flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-blue-700 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="h-5 w-5 shrink-0 overflow-hidden rounded-xs bg-slate-100">
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

          <div className="divide-y divide-slate-200">
            {/* Section A: Front Cover Prompt */}
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Front Cover Artwork Prompt</h4>
                  <p className="text-xs text-slate-500">
                    Generates the main cover image saved directly to your product folder.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={Boolean(runningKey) || !editablePack.coverPrompt.trim()}
                    onClick={handleGenerateCover}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-55 whitespace-nowrap"
                  >
                    {runningKey === 'cover' ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Generating Cover…
                      </>
                    ) : (
                      <>
                        <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                        Generate Cover
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-4 sm:flex-row">
                <textarea
                  rows={3}
                  aria-label="Front cover art prompt"
                  value={editablePack.coverPrompt}
                  onChange={(e) => updatePackField('coverPrompt', e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none"
                />
                {coverAsset && (
                  <div className="h-28 w-24 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    <AssetPreviewImage
                      src={coverAsset.url}
                      alt="Generated cover preview"
                      fallbackLabel="Cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section B: Story / Interior Copy Prompt */}
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Story / Interior Copy Prompt
                  </h4>
                  <p className="text-xs text-slate-500">
                    Drafts the full manuscript, front matter, or page-by-page copy for your product.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={Boolean(runningKey) || !editablePack.manuscriptPrompt.trim()}
                    onClick={handleGenerateStory}
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-700 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-55 whitespace-nowrap"
                  >
                    {runningKey === 'manuscript' ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Writing Copy…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Generate Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <textarea
                rows={3}
                aria-label="Story and interior copy prompt"
                value={editablePack.manuscriptPrompt}
                onChange={(e) => updatePackField('manuscriptPrompt', e.target.value)}
                className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none"
              />

              {latestManuscriptGen?.outputText && (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <div className="font-medium text-slate-900">Latest Generated Copy</div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                    {latestManuscriptGen.outputText}
                  </p>
                </div>
              )}
            </div>

            {/* Section C: KDP Listing & Keywords Prompt */}
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    KDP / Storefront Listing &amp; Keywords Prompt
                  </h4>
                  <p className="text-xs text-slate-500">
                    Generates subtitle ideas, product blurb, categories, and 7 high-intent keywords.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={Boolean(runningKey) || !editablePack.kdpMetadataPrompt.trim()}
                    onClick={handleGenerateListing}
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-700 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-55 whitespace-nowrap"
                  >
                    {runningKey === 'kdp-metadata' ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        Drafting Listing…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Generate Listing
                      </>
                    )}
                  </button>
                </div>
              </div>

              <textarea
                rows={3}
                aria-label="KDP listing and keywords prompt"
                value={editablePack.kdpMetadataPrompt}
                onChange={(e) => updatePackField('kdpMetadataPrompt', e.target.value)}
                className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none"
              />

              {latestListingGen?.outputText && (
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <div className="font-medium text-slate-900">Latest Generated Listing</div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                    {latestListingGen.outputText}
                  </p>
                </div>
              )}
            </div>

            {/* Section D: Interior Page Prompts */}
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Interior Page Prompts{' '}
                    <span className="ml-1 font-mono text-xs font-normal text-slate-500 tabular-nums">
                      ({editablePack.interiorPrompts.length})
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Edit each page or spread prompt before generating, or add extra pages.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={parsedStorySpreads.length === 0 || Boolean(runningKey)}
                    onClick={handleSyncPromptsFromStory}
                    title={
                      parsedStorySpreads.length > 0
                        ? `Sync all page prompts to your ${parsedStorySpreads.length} story spreads`
                        : 'Generate or write story text first'
                    }
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-700 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-45 whitespace-nowrap"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                    Sync Prompts From Story{parsedStorySpreads.length > 0 ? ` (${parsedStorySpreads.length})` : ''}
                  </button>
                  <button
                    type="button"
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
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add Page Prompt
                  </button>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
                {editablePack.interiorPrompts.map((page, idx) => {
                  const linkedAsset = page.generatedAssetId
                    ? assets.find((a) => a.id === page.generatedAssetId)
                    : null;
                  const isRunningThis = runningKey === `page-${idx}`;
                  const matchedStoryText =
                    page.storyText?.trim() || parsedStorySpreads[idx]?.storyText || '';
                  return (
                    <div key={page.id || idx} className="p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium text-slate-400 tabular-nums">
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
                          className="min-w-0 flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={Boolean(runningKey) || !page.prompt.trim()}
                          onClick={() => handleGenerateInteriorPage(idx)}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-700 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
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
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${page.title}`}
                          onClick={() =>
                            updatePackField(
                              'interiorPrompts',
                              editablePack.interiorPrompts.filter((_, i) => i !== idx)
                            )
                          }
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      {linkedAsset ? (
                        <div className="mt-2">
                          <label className="text-[11px] font-medium text-slate-500">
                            Story Text
                          </label>
                          <div className="mt-1 flex items-start gap-2">
                            <textarea
                              rows={2}
                              aria-label={`Interior page ${idx + 1} story text`}
                              value={
                                pageDrafts[linkedAsset.id]?.storyText ?? linkedAsset.storyText ?? ''
                              }
                              onChange={(e) =>
                                setPageDrafts((prev) => ({
                                  ...prev,
                                  [linkedAsset.id]: {
                                    storyText: e.target.value,
                                    textPlacement: prev[linkedAsset.id]?.textPlacement ?? '',
                                  },
                                }))
                              }
                              className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:outline-none"
                            />
                            {(pageDrafts[linkedAsset.id]?.storyText ?? linkedAsset.storyText ?? '') !==
                              (linkedAsset.storyText ?? '') && (
                              <button
                                type="button"
                                onClick={() => handleSavePageDesign(linkedAsset)}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                              >
                                <Save className="h-3 w-3" aria-hidden="true" />
                                Save
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        matchedStoryText && (
                          <div className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-950">
                            <span className="font-semibold text-amber-900">Matched Story Text: </span>
                            <span className="italic">&ldquo;{matchedStoryText}&rdquo;</span>
                          </div>
                        )
                      )}

                      <div className="mt-2.5 flex flex-col gap-3 sm:flex-row">
                        <textarea
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
                          className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none"
                        />
                        {linkedAsset && (
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
                            <AssetPreviewImage
                              src={linkedAsset.url}
                              alt={page.title}
                              fallbackLabel={page.title}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Generate Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={onBackToConcept}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to Concept
            </button>
            <button
              type="button"
              onClick={async () => {
                if (promptDirty) await handleSavePromptEdits();
                document.getElementById('studio-pages-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Review Pages &amp; Copy
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>

        <div id="studio-pages-section" className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Illustrated Book Page Designer */}
          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">
                  Story Pages &amp; Copy{' '}
                  <span className="ml-1 font-mono text-xs font-normal text-slate-500 tabular-nums">
                    ({productAssets.length})
                  </span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Preview and edit exact story text and placement on every page before compiling your KDP PDF.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <input
                  ref={pageUploadInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleDirectPageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={autoFillingPages || productAssets.length === 0}
                  onClick={handleAutoFillPagesFromManuscript}
                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-700 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
                >
                  {autoFillingPages ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Auto-Fill Story Text
                </button>
                <button
                  type="button"
                  onClick={() => pageUploadInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  Upload Page
                </button>
              </div>
            </div>

            {/* Book-wide Default Text Layout Bar */}
            {productAssets.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="step3-default-layout" className="font-medium text-slate-700">
                    Book Text Placement:
                  </label>
                  <select
                    id="step3-default-layout"
                    value={pageLayout}
                    onChange={(e) => setPageLayout(e.target.value as PageTextLayout)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none"
                  >
                    {PAGE_LAYOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('studio-prompts-section')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Generate More Pages
                </button>
              </div>
            )}

            {productAssets.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sm font-medium text-slate-900">No artwork pages generated yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Generate your cover and interior pages from the prompts above, or upload artwork files directly.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('studio-prompts-section')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to Edit &amp; Run Prompts
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {productAssets.map((asset, idx) => {
                  const draft = pageDrafts[asset.id] ?? {
                    storyText: asset.storyText ?? '',
                    textPlacement: asset.textPlacement ?? '',
                  };
                  const effectiveLayout: PageTextLayout = draft.textPlacement || pageLayout;
                  const isDirty =
                    draft.storyText !== (asset.storyText ?? '') ||
                    draft.textPlacement !== (asset.textPlacement ?? '');
                  const previewText = draft.storyText.trim();

                  return (
                    <div key={asset.id} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-semibold text-slate-500 tabular-nums">
                            {asset.kind === 'cover' ? 'COVER' : `PAGE ${idx + 1}`}
                          </span>
                          <span className="truncate font-medium text-slate-900">
                            {asset.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            aria-label={`Move ${asset.name} up`}
                            onClick={() => handleMovePage(idx, -1)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35"
                          >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === productAssets.length - 1}
                            aria-label={`Move ${asset.name} down`}
                            onClick={() => handleMovePage(idx, 1)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-35"
                          >
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <a
                            href={asset.url}
                            download={asset.name}
                            aria-label={`Download ${asset.name}`}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                          <button
                            type="button"
                            aria-label={`Remove ${asset.name}`}
                            onClick={() => onDeleteAsset(asset.id)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                        {/* Live Miniature Illustrated Book Page Preview */}
                        <div className="sm:col-span-5">
                          {asset.kind === 'cover' ? (
                            <div className="relative aspect-square w-full overflow-hidden rounded border border-slate-300 bg-[#FAF6EE]">
                              <AssetPreviewImage
                                src={asset.url}
                                alt={product.title}
                                fallbackLabel="Cover"
                                className="h-full w-full object-cover"
                              />
                              {includeCoverTitle && (
                                <div className="absolute inset-x-3 top-3 rounded border border-amber-200/80 bg-[#FDFBF5]/92 px-2.5 py-2 text-center shadow-xs">
                                  <div className="font-serif text-xs font-bold leading-tight text-slate-900">
                                    {product.title}
                                  </div>
                                  {product.subtitle && (
                                    <div className="mt-0.5 truncate font-serif text-[10px] italic text-slate-600">
                                      {product.subtitle}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : effectiveLayout === 'facing-page' ? (
                            <div className="grid aspect-[16/10] w-full grid-cols-2 overflow-hidden rounded border border-slate-300 bg-[#FDFBF6]">
                              <div className="flex items-center justify-center border-r border-slate-200 p-2.5 text-center">
                                <p className="line-clamp-5 font-serif text-[10px] leading-relaxed text-slate-800">
                                  {previewText || 'Story text appears on this left facing page…'}
                                </p>
                              </div>
                              <div className="h-full w-full overflow-hidden bg-slate-100">
                                <AssetPreviewImage
                                  src={asset.url}
                                  alt={asset.name}
                                  fallbackLabel="Art"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            </div>
                          ) : effectiveLayout === 'below-image' ? (
                            <div className="flex aspect-square w-full flex-col overflow-hidden rounded border border-slate-300 bg-[#FDFBF6]">
                              <div className="h-[68%] w-full overflow-hidden bg-slate-100">
                                <AssetPreviewImage
                                  src={asset.url}
                                  alt={asset.name}
                                  fallbackLabel="Art"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex flex-1 items-center justify-center border-t border-amber-100 px-2.5 py-1.5 text-center">
                                <p className="line-clamp-3 font-serif text-[10px] leading-snug text-slate-800">
                                  {previewText || 'Add story text to typeset cleanly below artwork…'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="relative aspect-square w-full overflow-hidden rounded border border-slate-300 bg-slate-100">
                              <AssetPreviewImage
                                src={asset.url}
                                alt={asset.name}
                                fallbackLabel="Art"
                                className="h-full w-full object-cover"
                              />
                              {effectiveLayout !== 'none' && previewText && (
                                <div
                                  className={`absolute inset-x-2.5 rounded border border-amber-200/80 bg-[#FDFBF5]/92 px-2.5 py-1.5 text-center shadow-xs ${
                                    effectiveLayout === 'overlay-top' ? 'top-2.5' : 'bottom-2.5'
                                  }`}
                                >
                                  <p className="line-clamp-3 font-serif text-[10px] leading-snug text-slate-900">
                                    {previewText}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Story Text & Placement Controls */}
                        <div className="flex flex-col justify-between gap-2.5 sm:col-span-7">
                          {asset.kind === 'cover' ? (
                            <div className="space-y-2 text-xs text-slate-600">
                              <p className="leading-relaxed">
                                Front cover artwork renders full-bleed with your book title and subtitle banner cleanly typeset at the top.
                              </p>
                              <label className="flex items-center gap-2 font-medium text-slate-800">
                                <input
                                  type="checkbox"
                                  checked={includeCoverTitle}
                                  onChange={(e) => setIncludeCoverTitle(e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                                />
                                Show title &amp; subtitle banner on cover
                              </label>
                            </div>
                          ) : (
                            <>
                              <div>
                                <label
                                  htmlFor={`story-text-${asset.id}`}
                                  className="block text-[11px] font-medium text-slate-700"
                                >
                                  Story Text Printed on This Page
                                </label>
                                <textarea
                                  id={`story-text-${asset.id}`}
                                  rows={3}
                                  value={draft.storyText}
                                  onChange={(e) =>
                                    setPageDrafts((prev) => ({
                                      ...prev,
                                      [asset.id]: {
                                        ...draft,
                                        storyText: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Type the 1–3 read-aloud sentences that belong on this illustrated book page…"
                                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
                                />
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <select
                                  aria-label={`Text placement for page ${idx + 1}`}
                                  value={draft.textPlacement}
                                  onChange={(e) =>
                                    setPageDrafts((prev) => ({
                                      ...prev,
                                      [asset.id]: {
                                        ...draft,
                                        textPlacement: e.target.value as PageTextLayout | '',
                                      },
                                    }))
                                  }
                                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
                                >
                                  <option value="">
                                    Use Book Default ({PAGE_LAYOUT_OPTIONS.find((o) => o.value === pageLayout)?.short})
                                  </option>
                                  {PAGE_LAYOUT_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.short}
                                    </option>
                                  ))}
                                </select>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={
                                      !draft.storyText.trim() ||
                                      regeneratingAssetId === asset.id ||
                                      Boolean(runningKey)
                                    }
                                    onClick={() => {
                                      const interiorIdx = Math.max(
                                        0,
                                        productAssets
                                          .filter((a) => a.kind !== 'cover')
                                          .findIndex((a) => a.id === asset.id)
                                      );
                                      handleMatchArtToPageText(asset, interiorIdx);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-md border border-blue-700 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
                                  >
                                    {regeneratingAssetId === asset.id ? (
                                      <>
                                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                        Matching Art…
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                                        Match Art to Text
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!isDirty || savingAssetId === asset.id}
                                    onClick={() => handleSavePageDesign(asset)}
                                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                                      isDirty
                                        ? 'bg-blue-700 text-white hover:bg-blue-800'
                                        : 'border border-slate-200 bg-slate-50 text-slate-400'
                                    }`}
                                  >
                                    <Save className="h-3 w-3" aria-hidden="true" />
                                    {savingAssetId === asset.id
                                      ? 'Saving…'
                                      : isDirty
                                        ? 'Save Page Text'
                                        : 'Saved'}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Manuscript & Listing Copy Editor */}
          <section className="flex flex-col rounded-lg border border-slate-200 bg-white xl:col-span-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">
                  Full Story Manuscript &amp; Copy
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Write or edit your manuscript here, then click <span className="font-medium text-slate-700">Auto-Fill Story Text</span> to place each spread onto its matching page.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(notesDraft).catch(() => {});
                  setCopiedNotes(true);
                  setTimeout(() => setCopiedNotes(false), 1600);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                {copiedNotes ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="flex flex-1 flex-col p-5">
              <textarea
                rows={14}
                aria-label="Product manuscript and listing copy"
                value={notesDraft}
                onChange={(e) => {
                  setNotesDraft(e.target.value);
                  setNotesDirty(true);
                }}
                placeholder="Write or paste your story spreads here (e.g., Page 1: Zebo wagged his tail at the garden gate...)"
                className="flex-1 rounded-md border border-slate-300 bg-slate-50/60 p-3 text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none"
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={!notesDirty || savingNotes}
                  onClick={handleSaveNotes}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" aria-hidden="true" />
                  {savingNotes ? 'Saving…' : notesDirty ? 'Save Copy Edits' : 'Saved'}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (notesDirty) await handleSaveNotes();
                    onContinueToDownload();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                >
                  Continue to Download
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        </div>
    </>
  );
}
