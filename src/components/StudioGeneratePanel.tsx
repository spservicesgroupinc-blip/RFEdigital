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
import type { parseManuscriptIntoSpreads } from '../lib/workspaceLogic';
import { ManuscriptEditor } from './studio/ManuscriptEditor';
import { PageDesigner } from './studio/PageDesigner';
import { PromptEditor } from './studio/PromptEditor';

export interface StudioGeneratePanelProps {
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

/** Tab 2 - Generate: prompts, artwork, story pages, and manuscript copy. */
export function StudioGeneratePanel(props: StudioGeneratePanelProps) {
  const {
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
  } = props;

  return (
    <>
      <PromptEditor
        product={product}
        editablePack={editablePack}
        settings={settings}
        provider={provider}
        setProvider={setProvider}
        savingPrompts={savingPrompts}
        promptDirty={promptDirty}
        generatingPack={generatingPack}
        runningKey={runningKey}
        batchStatus={batchStatus}
        artStylePreset={artStylePreset}
        setArtStylePreset={setArtStylePreset}
        galleryImages={galleryImages}
        selectedGalleryImage={selectedGalleryImage}
        savedReferenceAsset={savedReferenceAsset}
        hasActiveRefPhoto={hasActiveRefPhoto}
        selectedGalleryImageId={selectedGalleryImageId}
        setSelectedGalleryImageId={setSelectedGalleryImageId}
        refPhotoInputRef={refPhotoInputRef}
        coverAsset={coverAsset}
        assets={assets}
        latestManuscriptGen={latestManuscriptGen}
        latestListingGen={latestListingGen}
        parsedStorySpreads={parsedStorySpreads}
        pageDrafts={pageDrafts}
        setPageDrafts={setPageDrafts}
        savingAssetId={savingAssetId}
        handleSavePageDesign={handleSavePageDesign}
        updatePackField={updatePackField}
        handleSavePromptEdits={handleSavePromptEdits}
        handleRegeneratePrompts={handleRegeneratePrompts}
        handleBuildAllSections={handleBuildAllSections}
        handleGenerateBook={handleGenerateBook}
        generateBookStage={generateBookStage}
        handleGenerateCover={handleGenerateCover}
        handleGenerateStory={handleGenerateStory}
        handleGenerateListing={handleGenerateListing}
        handleGenerateInteriorPage={handleGenerateInteriorPage}
        handleGenerateAllPagesFromPhoto={handleGenerateAllPagesFromPhoto}
        handleSyncPromptsFromStory={handleSyncPromptsFromStory}
        handlePhotoUpload={handlePhotoUpload}
        onOpenGallery={onOpenGallery}
        onBackToConcept={onBackToConcept}
        onReviewPages={() =>
          document.getElementById('studio-pages-section')?.scrollIntoView({ behavior: 'smooth' })
        }
      />

      <div id="studio-pages-section" className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <PageDesigner
            product={product}
            productAssets={productAssets}
            pageDrafts={pageDrafts}
            setPageDrafts={setPageDrafts}
            pageLayout={pageLayout}
            setPageLayout={setPageLayout}
            includeCoverTitle={includeCoverTitle}
            setIncludeCoverTitle={setIncludeCoverTitle}
            autoFillingPages={autoFillingPages}
            savingAssetId={savingAssetId}
            regeneratingAssetId={regeneratingAssetId}
            runningKey={runningKey}
            pageUploadInputRef={pageUploadInputRef}
            handleAutoFillPagesFromManuscript={handleAutoFillPagesFromManuscript}
            handleDirectPageUpload={handleDirectPageUpload}
            handleMatchArtToPageText={handleMatchArtToPageText}
            handleSavePageDesign={handleSavePageDesign}
            handleMovePage={handleMovePage}
            onDeleteAsset={onDeleteAsset}
            onOpenPrompts={() =>
              document.getElementById('studio-prompts-section')?.scrollIntoView({ behavior: 'smooth' })
            }
          />
        </div>

        <div className="xl:col-span-5">
          <ManuscriptEditor
            notesDraft={notesDraft}
            setNotesDraft={setNotesDraft}
            notesDirty={notesDirty}
            setNotesDirty={setNotesDirty}
            savingNotes={savingNotes}
            copiedNotes={copiedNotes}
            setCopiedNotes={setCopiedNotes}
            handleSaveNotes={handleSaveNotes}
            onContinueToDownload={onContinueToDownload}
          />
        </div>
      </div>
    </>
  );
}
