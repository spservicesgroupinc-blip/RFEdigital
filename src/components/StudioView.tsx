import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type {
  BuilderStep,
  ExportArtifact,
  GalleryImage,
  GenerationMode,
  GenerationProvider,
  GenerationRecord,
  KdpTrimSize,
  PageTextLayout,
  Product,
  ProductCategory,
  ProductPromptPack,
  PromptPrefillRequest,
  StorageAsset,
  WorkspaceSettings,
} from '../types/workspace';
import {
  STYLE_PRESET_OPTIONS,
  buildIllustrationPromptFromStoryText,
  buildPromptPackFromConcept,
  calculateKdpDimensionsPt,
  computeProductReadiness,
  parseManuscriptIntoPageTexts,
  parseManuscriptIntoSpreads,
  pickStylePresetForProduct,
  sanitizeFolderSlug,
  syncInteriorPromptsFromManuscript,
} from '../lib/workspaceLogic';
import { rasterizeSvgUrlToPng } from '../lib/api';
import {
  buildClientKdpPdfBlob,
  cacheArtifactBlob,
  resolveVerifiedArtifactBlob,
  triggerBlobDownload,
} from '../lib/clientPdf';
import { PdfPreviewModal } from './PdfPreviewModal';
import { StudioConceptPanel } from './StudioConceptPanel';
import { StudioDownloadPanel } from './StudioDownloadPanel';
import { StudioGeneratePanel } from './StudioGeneratePanel';

interface StudioViewProps {
  products: Product[];
  assets: StorageAsset[];
  galleryImages: GalleryImage[];
  generations: GenerationRecord[];
  exportsList: ExportArtifact[];
  settings: WorkspaceSettings;
  activeProductId: string | null;
  initialStep?: BuilderStep;
  initialGalleryImageId?: string | null;
  onClearInitialGalleryImage?: () => void;
  googleConnected: boolean;
  onSelectProduct: (id: string) => void;
  onCreateProduct: (payload: {
    title: string;
    subtitle: string;
    category: ProductCategory;
    status: Product['status'];
    trimSize: KdpTrimSize;
    pageCount: number;
    includeBleed: boolean;
    seriesId: string | null;
    isbn: string;
    manuscriptNotes: string;
    referencePhoto?: { name: string; mimeType: string; dataUrl: string };
  }) => Promise<Product>;
  onUpdateProduct: (id: string, payload: Partial<Product>) => Promise<void>;
  onGeneratePromptPack: (payload: {
    productId: string;
    concept?: string;
    targetAudience?: string;
    artStylePreset?: string;
    useAi?: boolean;
  }) => Promise<ProductPromptPack>;
  onGenerateText: (payload: {
    productId: string;
    prompt: string;
    mode: GenerationMode;
    provider: GenerationProvider;
    saveToManuscript: boolean;
  }) => Promise<Product | void>;
  onGenerateIllustration: (payload: {
    productId: string;
    prompt: string;
    stylePreset: string;
    provider: GenerationProvider;
    kind: StorageAsset['kind'];
    referenceAssetId?: string;
    galleryImageId?: string;
    sceneIndex?: number;
    totalScenes?: number;
    storyText?: string;
    textPlacement?: PageTextLayout;
    replaceAssetId?: string;
  }) => Promise<StorageAsset>;
  onUploadAsset: (payload: {
    productId: string;
    name: string;
    mimeType: string;
    dataUrl: string;
    kind: StorageAsset['kind'];
    caption: string;
  }) => Promise<void>;
  onUpdateAsset: (
    id: string,
    payload: {
      storyText?: string;
      textPlacement?: PageTextLayout | '';
      caption?: string;
      pageOrder?: number;
      kind?: StorageAsset['kind'];
    }
  ) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
  onExportPdf: (payload: {
    productId: string;
    assetIds: string[];
    trimSize: KdpTrimSize;
    includeBleed: boolean;
    includeTitlePage: boolean;
    includeCaptions: boolean;
    pageLayout?: PageTextLayout;
    includeCoverTitle?: boolean;
    rasterOverrides?: Record<string, string>;
  }) => Promise<ExportArtifact>;
  onExportBundle: (payload: {
    productId: string;
    assetIds: string[];
  }) => Promise<ExportArtifact>;
  onUploadArtifactToDrive: (artifactId: string) => Promise<void>;
  onOpenInPromptStudio: (req: Omit<PromptPrefillRequest, 'nonce'>) => void;
  onOpenGallery: () => void;
  onGoToTrends: () => void;
}

const STEP_META: Array<{ step: BuilderStep; title: string; short: string }> = [
  { step: 1, title: '1. Concept', short: '1. Concept' },
  { step: 2, title: '2. Generate', short: '2. Generate' },
  { step: 3, title: '3. Download', short: '3. Download' },
];

export function StudioView({
  products,
  assets,
  galleryImages,
  generations,
  exportsList,
  settings,
  activeProductId,
  initialStep,
  initialGalleryImageId,
  onClearInitialGalleryImage,
  googleConnected,
  onSelectProduct,
  onCreateProduct,
  onUpdateProduct,
  onGeneratePromptPack,
  onGenerateText,
  onGenerateIllustration,
  onUploadAsset,
  onUpdateAsset,
  onDeleteAsset,
  onExportPdf,
  onExportBundle,
  onUploadArtifactToDrive,
  onOpenInPromptStudio,
  onOpenGallery,
  onGoToTrends,
}: StudioViewProps) {
  const productId = activeProductId || products[0]?.id || '';
  const product = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  const [creatingNew, setCreatingNew] = useState(products.length === 0);
  const [step, setStep] = useState<BuilderStep>(initialStep ?? (products.length === 0 ? 1 : 2));
  const [selectedGalleryImageId, setSelectedGalleryImageId] = useState<string | null>(
    initialGalleryImageId ?? null
  );

  // Sync external initialStep & gallery handoff changes
  useEffect(() => {
    if (initialStep) {
      setStep(initialStep);
      if (products.length > 0) setCreatingNew(false);
    }
  }, [initialStep, productId, products.length]);

  useEffect(() => {
    if (initialGalleryImageId) {
      setSelectedGalleryImageId(initialGalleryImageId);
      onClearInitialGalleryImage?.();
    }
  }, [initialGalleryImageId, onClearInitialGalleryImage]);

  useEffect(() => {
    if (products.length === 0) {
      setCreatingNew(true);
      setStep(1);
    }
  }, [products.length]);

  // Tab 1: Concept & Specs Form State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState<ProductCategory>('childrens-book');
  const [trimSize, setTrimSize] = useState<KdpTrimSize>('8.5x8.5');
  const [pageCount, setPageCount] = useState('24');
  const [includeBleed, setIncludeBleed] = useState(true);
  const [targetAudience, setTargetAudience] = useState('Ages 4–7 & Parents');
  const [conceptSummary, setConceptSummary] = useState('');
  const [artStylePreset, setArtStylePreset] = useState<string>(STYLE_PRESET_OPTIONS[0].value);
  const [newRefPhoto, setNewRefPhoto] = useState<{
    name: string;
    mimeType: string;
    dataUrl: string;
  } | null>(null);
  const refPhotoInputRef = useRef<HTMLInputElement>(null);
  const pageUploadInputRef = useRef<HTMLInputElement>(null);

  // Tab 2: Editable Prompt Pack State
  const [editablePack, setEditablePack] = useState<ProductPromptPack | null>(null);
  const [promptDirty, setPromptDirty] = useState(false);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [generatingPack, setGeneratingPack] = useState(false);
  const [provider, setProvider] = useState<GenerationProvider>(
    settings.openRouterConfigured ? 'openrouter' : 'gemini'
  );
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);

  // Tab 2 (lower): Illustrated Book Page Designer & Manuscript Copy State
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [pageDrafts, setPageDrafts] = useState<
    Record<string, { storyText: string; textPlacement: PageTextLayout | '' }>
  >({});
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);
  const [regeneratingAssetId, setRegeneratingAssetId] = useState<string | null>(null);
  const [autoFillingPages, setAutoFillingPages] = useState(false);

  // Tab 3: Export State
  const [exportTrim, setExportTrim] = useState<KdpTrimSize>('8.5x8.5');
  const [exportBleed, setExportBleed] = useState(true);
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeCoverTitle, setIncludeCoverTitle] = useState(true);
  const [pageLayout, setPageLayout] = useState<PageTextLayout>('below-image');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [buildingPdf, setBuildingPdf] = useState(false);
  const [buildingZip, setBuildingZip] = useState(false);
  const [latestArtifact, setLatestArtifact] = useState<ExportArtifact | null>(null);
  const [driveUploadingId, setDriveUploadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{
    fileName: string;
    blobUrl: string;
    blob: Blob;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (previewState?.blobUrl) {
        URL.revokeObjectURL(previewState.blobUrl);
      }
    };
  }, [previewState]);

  const [error, setError] = useState('');

  // Product-scoped derived collections
  const productAssets = useMemo(
    () =>
      assets
        .filter((a) => a.productId === productId && a.kind !== 'reference')
        .sort((a, b) => a.pageOrder - b.pageOrder),
    [assets, productId]
  );

  const selectedGalleryImage = useMemo(
    () =>
      selectedGalleryImageId
        ? galleryImages.find((g) => g.id === selectedGalleryImageId) ?? null
        : null,
    [galleryImages, selectedGalleryImageId]
  );

  const savedReferenceAsset = useMemo(() => {
    if (!product) return null;
    if (product.referenceAssetId) {
      const exact = assets.find((a) => a.id === product.referenceAssetId);
      if (exact) return exact;
    }
    return assets.find((a) => a.productId === product.id && a.kind === 'reference') ?? null;
  }, [product, assets]);

  const hasActiveRefPhoto = Boolean(selectedGalleryImage || savedReferenceAsset);

  const coverAsset = useMemo(() => {
    if (!product) return null;
    if (product.coverAssetId) {
      const exact = assets.find((a) => a.id === product.coverAssetId);
      if (exact) return exact;
    }
    return productAssets.find((a) => a.kind === 'cover') ?? productAssets[0] ?? null;
  }, [product, assets, productAssets]);

  const productGenerations = useMemo(
    () => generations.filter((g) => g.productId === productId),
    [generations, productId]
  );

  const productExports = useMemo(
    () => exportsList.filter((e) => e.productId === productId),
    [exportsList, productId]
  );

  const parsedStorySpreads = useMemo(
    () => parseManuscriptIntoSpreads(product?.manuscriptNotes, 24),
    [product?.manuscriptNotes]
  );

  const readiness = useMemo(
    () =>
      product
        ? computeProductReadiness(product, assets, generations, exportsList)
        : null,
    [product, assets, generations, exportsList]
  );

  // Hydrate form states whenever active product changes
  useEffect(() => {
    if (creatingNew || !product) {
      setTitle('');
      setSubtitle('');
      setCategory('childrens-book');
      setTrimSize('8.5x8.5');
      setPageCount('24');
      setIncludeBleed(true);
      setTargetAudience('Ages 4–7 & Parents');
      setConceptSummary('');
      setArtStylePreset(STYLE_PRESET_OPTIONS[0].value);
      setNewRefPhoto(null);
      setEditablePack(null);
      setPromptDirty(false);
      return;
    }

    setTitle(product.title);
    setSubtitle(product.subtitle);
    setCategory(product.category);
    setTrimSize(product.trimSize);
    setPageCount(String(product.pageCount));
    setIncludeBleed(product.includeBleed);

    const existingPack =
      product.promptPack ??
      buildPromptPackFromConcept({
        title: product.title,
        subtitle: product.subtitle,
        category: product.category,
        trimSize: product.trimSize,
        pageCount: product.pageCount,
        concept: product.manuscriptNotes || product.subtitle || product.title,
      });

    setTargetAudience(existingPack.targetAudience);
    setConceptSummary(existingPack.conceptSummary);
    setArtStylePreset(
      existingPack.artStylePreset || pickStylePresetForProduct(product.category)
    );
    setEditablePack(existingPack);
    setPromptDirty(false);

    setNotesDraft(product.manuscriptNotes);
    setNotesDirty(false);

    setExportTrim(product.trimSize);
    setExportBleed(product.includeBleed);
    setPageLayout(
      product.category === 'coloring-book' || product.category === 'art-print'
        ? 'none'
        : 'below-image'
    );
    setLatestArtifact(null);
  }, [product?.id, product?.updatedAt, creatingNew]);

  useEffect(() => {
    setSelectedAssetIds(productAssets.map((a) => a.id));
    setPageDrafts((prev) => {
      const next: Record<string, { storyText: string; textPlacement: PageTextLayout | '' }> = {};
      for (const a of productAssets) {
        next[a.id] = prev[a.id] ?? {
          storyText: a.storyText ?? '',
          textPlacement: a.textPlacement ?? '',
        };
      }
      return next;
    });
  }, [productId, productAssets]);

  const dims = useMemo(
    () => calculateKdpDimensionsPt(exportTrim, exportBleed),
    [exportTrim, exportBleed]
  );

  const latestManuscriptGen = productGenerations.find((g) => g.mode === 'manuscript');
  const latestListingGen = productGenerations.find((g) => g.mode === 'kdp-metadata');

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Upload a PNG, JPEG, or WebP reference photo.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Reference photo must be under 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      if (creatingNew || !product) {
        setNewRefPhoto({ name: file.name, mimeType: file.type, dataUrl });
      } else {
        setError('');
        await onUploadAsset({
          productId: product.id,
          name: file.name,
          mimeType: file.type,
          dataUrl,
          kind: 'reference',
          caption: 'Reference photo for AI cartoon & illustration generation',
        });
      }
      if (refPhotoInputRef.current) refPhotoInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleDirectPageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setError('Upload a PNG, JPEG, WebP, or SVG artwork file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setError('');
      await onUploadAsset({
        productId: product.id,
        name: file.name,
        mimeType: file.type,
        dataUrl: String(reader.result),
        kind: productAssets.length === 0 ? 'cover' : 'illustration',
        caption: file.name.replace(/\.[^.]+$/, ''),
      });
      if (pageUploadInputRef.current) pageUploadInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  // Concept submit -> create/save product & auto-fill editable prompts -> Generate tab
  const handleStep1SaveAndGeneratePrompts = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2) {
      setError('Enter a book or product title (at least 2 characters).');
      return;
    }
    const parsedPages = Math.min(828, Math.max(1, Number(pageCount) || 24));
    setError('');
    setGeneratingPack(true);

    try {
      let targetProductId = product?.id ?? '';
      if (creatingNew || !product) {
        const created = await onCreateProduct({
          title: trimmedTitle,
          subtitle: subtitle.trim(),
          category,
          status: 'draft',
          trimSize,
          pageCount: parsedPages,
          includeBleed,
          seriesId: null,
          isbn: '',
          manuscriptNotes: conceptSummary.trim(),
          referencePhoto: newRefPhoto ?? undefined,
        });
        targetProductId = created.id;
        setCreatingNew(false);
        setNewRefPhoto(null);
      } else {
        await onUpdateProduct(product.id, {
          title: trimmedTitle,
          subtitle: subtitle.trim(),
          category,
          trimSize,
          pageCount: parsedPages,
          includeBleed,
        });
      }

      const generated = await onGeneratePromptPack({
        productId: targetProductId,
        concept: conceptSummary.trim() || subtitle.trim() || trimmedTitle,
        targetAudience: targetAudience.trim() || 'General Audience',
        artStylePreset,
        useAi: true,
      });

      setEditablePack(generated);
      setPromptDirty(false);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare editable prompts.');
    } finally {
      setGeneratingPack(false);
    }
  };

  const updatePackField = <K extends keyof ProductPromptPack>(
    key: K,
    value: ProductPromptPack[K]
  ) => {
    setEditablePack((prev) => (prev ? { ...prev, [key]: value } : prev));
    setPromptDirty(true);
  };

  const handleSavePromptEdits = async (): Promise<ProductPromptPack | null> => {
    if (!product || !editablePack) return null;
    setSavingPrompts(true);
    setError('');
    try {
      const updatedPack: ProductPromptPack = {
        ...editablePack,
        artStylePreset,
        updatedAt: new Date().toISOString(),
      };
      await onUpdateProduct(product.id, { promptPack: updatedPack });
      setEditablePack(updatedPack);
      setPromptDirty(false);
      return updatedPack;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save prompt edits.');
      return null;
    } finally {
      setSavingPrompts(false);
    }
  };

  const handleRegeneratePrompts = async () => {
    if (!product) return;
    setGeneratingPack(true);
    setError('');
    try {
      const fresh = await onGeneratePromptPack({
        productId: product.id,
        concept: editablePack?.conceptSummary || conceptSummary || product.title,
        targetAudience: editablePack?.targetAudience || targetAudience,
        artStylePreset,
        useAi: true,
      });
      setEditablePack(fresh);
      setPromptDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh prompts.');
    } finally {
      setGeneratingPack(false);
    }
  };

  const runSinglePrompt = async (
    key: string,
    action: () => Promise<void>
  ) => {
    if (!product) return;
    setError('');
    setRunningKey(key);
    try {
      if (promptDirty) {
        await handleSavePromptEdits();
      }
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setRunningKey(null);
    }
  };

  const getRefPayload = () =>
    selectedGalleryImage
      ? { galleryImageId: selectedGalleryImage.id }
      : savedReferenceAsset
        ? { referenceAssetId: savedReferenceAsset.id }
        : {};

  const handleGenerateCover = () =>
    runSinglePrompt('cover', async () => {
      if (!product || !editablePack?.coverPrompt.trim()) return;
      await onGenerateIllustration({
        productId: product.id,
        prompt: editablePack.coverPrompt.trim(),
        stylePreset: artStylePreset,
        provider,
        kind: 'cover',
        ...getRefPayload(),
      });
    });

  const handleGenerateStory = () =>
    runSinglePrompt('manuscript', async () => {
      if (!product || !editablePack?.manuscriptPrompt.trim()) return;
      const updated = await onGenerateText({
        productId: product.id,
        prompt: editablePack.manuscriptPrompt.trim(),
        mode: 'manuscript',
        provider,
        saveToManuscript: true,
      });
      if (updated?.promptPack) {
        setEditablePack(updated.promptPack);
        setPromptDirty(false);
      }
    });

  const handleSyncPromptsFromStory = async () => {
    if (!product || !editablePack) return;
    const synced = syncInteriorPromptsFromManuscript({
      manuscriptNotes: product.manuscriptNotes,
      productTitle: product.title,
      artStylePreset,
      existingPrompts: editablePack.interiorPrompts,
      maxPages: 12,
    });
    if (synced.length === 0) {
      setError('Write or generate your Story / Interior Copy first so prompts can match your story pages.');
      return;
    }
    setError('');
    const nextPack: ProductPromptPack = {
      ...editablePack,
      artStylePreset,
      interiorPrompts: synced,
      updatedAt: new Date().toISOString(),
    };
    setEditablePack(nextPack);
    setPromptDirty(false);
    await onUpdateProduct(product.id, { promptPack: nextPack });
  };

  const handleGenerateListing = () =>
    runSinglePrompt('kdp-metadata', async () => {
      if (!product || !editablePack?.kdpMetadataPrompt.trim()) return;
      await onGenerateText({
        productId: product.id,
        prompt: editablePack.kdpMetadataPrompt.trim(),
        mode: 'kdp-metadata',
        provider,
        saveToManuscript: true,
      });
    });

  const handleGenerateInteriorPage = (pageIndex: number) =>
    runSinglePrompt(`page-${pageIndex}`, async () => {
      if (!product || !editablePack) return;
      const item = editablePack.interiorPrompts[pageIndex];
      if (!item || !item.prompt.trim()) return;
      const matchedStory = item.storyText?.trim() || parsedStorySpreads[pageIndex]?.storyText || '';
      const createdAsset = await onGenerateIllustration({
        productId: product.id,
        prompt: item.prompt.trim(),
        stylePreset: artStylePreset,
        provider,
        kind: 'illustration',
        sceneIndex: pageIndex,
        totalScenes: editablePack.interiorPrompts.length,
        storyText: matchedStory || undefined,
        ...getRefPayload(),
      });

      const nextInteriors = editablePack.interiorPrompts.map((p, idx) =>
        idx === pageIndex
          ? { ...p, storyText: matchedStory || p.storyText, generatedAssetId: createdAsset.id }
          : p
      );
      const nextPack: ProductPromptPack = {
        ...editablePack,
        artStylePreset,
        interiorPrompts: nextInteriors,
        updatedAt: new Date().toISOString(),
      };
      setEditablePack(nextPack);
      await onUpdateProduct(product.id, { promptPack: nextPack });
    });

  const handleGenerateAllPagesFromPhoto = async () => {
    if (!product || !editablePack) return;
    setError('');
    setRunningKey('photo-pages');
    try {
      const saved = (await handleSavePromptEdits()) ?? editablePack;
      let workingPack = {
        ...saved,
        interiorPrompts: saved.interiorPrompts.map((p) => ({ ...p })),
      };
      // If story exists and prompts aren't yet linked to story text, align them automatically first
      if (
        parsedStorySpreads.length > 0 &&
        workingPack.interiorPrompts.every((p) => !p.storyText?.trim())
      ) {
        const synced = syncInteriorPromptsFromManuscript({
          manuscriptNotes: product.manuscriptNotes,
          productTitle: product.title,
          artStylePreset,
          existingPrompts: workingPack.interiorPrompts,
          maxPages: Math.max(workingPack.interiorPrompts.length, parsedStorySpreads.length),
        });
        if (synced.length > 0) {
          workingPack = { ...workingPack, interiorPrompts: synced };
          setEditablePack(workingPack);
          await onUpdateProduct(product.id, { promptPack: workingPack });
        }
      }
      const refPayload = getRefPayload();

      const tasks: Array<{ label: string; run: () => Promise<void> }> = [];
      if (workingPack.coverPrompt.trim()) {
        tasks.push({
          label: 'Front Cover Illustration',
          run: async () => {
            await onGenerateIllustration({
              productId: product.id,
              prompt: workingPack.coverPrompt.trim(),
              stylePreset: artStylePreset,
              provider,
              kind: 'cover',
              ...refPayload,
            });
          },
        });
      }

      workingPack.interiorPrompts.forEach((page, idx) => {
        if (page.prompt.trim()) {
          const matchedStory = page.storyText?.trim() || parsedStorySpreads[idx]?.storyText || '';
          tasks.push({
            label: page.title || `Scene ${idx + 1}`,
            run: async () => {
              const asset = await onGenerateIllustration({
                productId: product.id,
                prompt: page.prompt.trim(),
                stylePreset: artStylePreset,
                provider,
                kind: 'illustration',
                sceneIndex: idx,
                totalScenes: workingPack.interiorPrompts.length,
                storyText: matchedStory || undefined,
                ...refPayload,
              });
              workingPack.interiorPrompts[idx] = {
                ...workingPack.interiorPrompts[idx],
                storyText: matchedStory || workingPack.interiorPrompts[idx].storyText,
                generatedAssetId: asset.id,
              };
              setEditablePack({ ...workingPack });
              await onUpdateProduct(product.id, { promptPack: workingPack });
            },
          });
        }
      });

      for (let i = 0; i < tasks.length; i++) {
        setBatchStatus(
          `Generating story-matched page ${i + 1} of ${tasks.length} from your photo: ${tasks[i].label}…`
        );
        await tasks[i].run();
      }
      setBatchStatus(null);
      setStep(2);
    } catch (err) {
      setBatchStatus(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Stopped during multi-page photo generation. You can retry any remaining page below.'
      );
    } finally {
      setRunningKey(null);
    }
  };

  const handleBuildAllSections = async () => {
    if (!product || !editablePack) return;
    setError('');
    setRunningKey('all');
    try {
      const saved = (await handleSavePromptEdits()) ?? editablePack;
      let workingPack = { ...saved, interiorPrompts: saved.interiorPrompts.map((p) => ({ ...p })) };
      let latestManuscript = product.manuscriptNotes;
      const refPayload = getRefPayload();

      // Step A: Generate story manuscript FIRST so every interior illustration matches the actual story!
      if (workingPack.manuscriptPrompt.trim()) {
        setBatchStatus('Writing story manuscript & matching illustration prompts…');
        const updated = await onGenerateText({
          productId: product.id,
          prompt: workingPack.manuscriptPrompt.trim(),
          mode: 'manuscript',
          provider,
          saveToManuscript: true,
        });
        if (updated) {
          latestManuscript = updated.manuscriptNotes;
          if (updated.promptPack && updated.promptPack.interiorPrompts.length > 0) {
            workingPack = {
              ...updated.promptPack,
              interiorPrompts: updated.promptPack.interiorPrompts.map((p) => ({ ...p })),
            };
            setEditablePack(workingPack);
          }
        }
      }

      const freshSpreads = parseManuscriptIntoSpreads(latestManuscript, 24);
      if (
        freshSpreads.length > 0 &&
        workingPack.interiorPrompts.every((p) => !p.storyText?.trim())
      ) {
        const synced = syncInteriorPromptsFromManuscript({
          manuscriptNotes: latestManuscript,
          productTitle: product.title,
          artStylePreset,
          existingPrompts: workingPack.interiorPrompts,
          maxPages: Math.max(workingPack.interiorPrompts.length, freshSpreads.length),
        });
        if (synced.length > 0) {
          workingPack = { ...workingPack, interiorPrompts: synced };
          setEditablePack(workingPack);
          await onUpdateProduct(product.id, { promptPack: workingPack });
        }
      }

      const tasks: Array<{ label: string; run: () => Promise<void> }> = [];
      if (workingPack.kdpMetadataPrompt.trim()) {
        tasks.push({
          label: 'KDP Listing & Keywords',
          run: async () => {
            await onGenerateText({
              productId: product.id,
              prompt: workingPack.kdpMetadataPrompt.trim(),
              mode: 'kdp-metadata',
              provider,
              saveToManuscript: true,
            });
          },
        });
      }
      if (workingPack.coverPrompt.trim()) {
        tasks.push({
          label: 'Front Cover Artwork',
          run: async () => {
            await onGenerateIllustration({
              productId: product.id,
              prompt: workingPack.coverPrompt.trim(),
              stylePreset: artStylePreset,
              provider,
              kind: 'cover',
              ...refPayload,
            });
          },
        });
      }

      workingPack.interiorPrompts.forEach((page, idx) => {
        if (page.prompt.trim() && !page.generatedAssetId) {
          const matchedStory = page.storyText?.trim() || freshSpreads[idx]?.storyText || '';
          tasks.push({
            label: page.title || `Interior Page ${idx + 1}`,
            run: async () => {
              const asset = await onGenerateIllustration({
                productId: product.id,
                prompt: page.prompt.trim(),
                stylePreset: artStylePreset,
                provider,
                kind: 'illustration',
                sceneIndex: idx,
                totalScenes: workingPack.interiorPrompts.length,
                storyText: matchedStory || undefined,
                ...refPayload,
              });
              workingPack.interiorPrompts[idx] = {
                ...workingPack.interiorPrompts[idx],
                storyText: matchedStory || workingPack.interiorPrompts[idx].storyText,
                generatedAssetId: asset.id,
              };
              setEditablePack({ ...workingPack });
              await onUpdateProduct(product.id, { promptPack: workingPack });
            },
          });
        }
      });

      for (let i = 0; i < tasks.length; i++) {
        setBatchStatus(`Building step ${i + 1} of ${tasks.length}: ${tasks[i].label}…`);
        await tasks[i].run();
      }
      setBatchStatus(null);
      setStep(2);
    } catch (err) {
      setBatchStatus(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Stopped during batch generation. You can retry any remaining section below.'
      );
    } finally {
      setRunningKey(null);
    }
  };

  const handleMatchArtToPageText = async (asset: StorageAsset, interiorIndex: number) => {
    if (!product) return;
    const draft = pageDrafts[asset.id] ?? {
      storyText: asset.storyText ?? '',
      textPlacement: (asset.textPlacement ?? '') as PageTextLayout | '',
    };
    const cleanStory = draft.storyText.trim();
    if (!cleanStory) {
      setError('Enter story text for this page first so the illustration can match it.');
      return;
    }

    setError('');
    setRegeneratingAssetId(asset.id);
    try {
      // Save any edited text/placement first
      await onUpdateAsset(asset.id, {
        storyText: cleanStory,
        textPlacement: draft.textPlacement,
      });

      const storyMatchedPrompt = buildIllustrationPromptFromStoryText({
        storyText: cleanStory,
        productTitle: product.title,
        pageIndex: interiorIndex,
        totalPages: Math.max(1, productAssets.filter((a) => a.kind !== 'cover').length),
        artStylePreset,
      });

      await onGenerateIllustration({
        productId: product.id,
        prompt: storyMatchedPrompt,
        stylePreset: artStylePreset,
        provider,
        kind: 'illustration',
        sceneIndex: interiorIndex,
        totalScenes: Math.max(1, productAssets.filter((a) => a.kind !== 'cover').length),
        storyText: cleanStory,
        textPlacement: draft.textPlacement || undefined,
        replaceAssetId: asset.id,
        ...getRefPayload(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate illustration for this page.');
    } finally {
      setRegeneratingAssetId(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!product) return;
    setSavingNotes(true);
    try {
      await onUpdateProduct(product.id, { manuscriptNotes: notesDraft });
      setNotesDirty(false);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAutoFillPagesFromManuscript = async () => {
    if (!product) return;
    const interiorAssets = productAssets.filter((a) => a.kind !== 'cover');
    if (interiorAssets.length === 0) {
      setError('Add or generate interior illustration pages first before placing story text.');
      return;
    }
    const parsed = parseManuscriptIntoPageTexts(notesDraft, interiorAssets.length);
    if (parsed.length === 0) {
      setError(
        'No read-aloud story paragraphs found in your manuscript box yet. Generate Story Copy in the Generate tab or type your story paragraphs (e.g. "Page 1: ...") on the right.'
      );
      return;
    }

    setError('');
    setAutoFillingPages(true);
    try {
      if (notesDirty) {
        await onUpdateProduct(product.id, { manuscriptNotes: notesDraft });
        setNotesDirty(false);
      }
      for (let i = 0; i < interiorAssets.length; i++) {
        const text = parsed[i];
        if (!text) continue;
        const target = interiorAssets[i];
        await onUpdateAsset(target.id, { storyText: text });
        setPageDrafts((prev) => ({
          ...prev,
          [target.id]: {
            storyText: text,
            textPlacement: prev[target.id]?.textPlacement ?? target.textPlacement ?? '',
          },
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not auto-fill story text onto pages.');
    } finally {
      setAutoFillingPages(false);
    }
  };

  const handleSavePageDesign = async (asset: StorageAsset) => {
    const draft = pageDrafts[asset.id];
    if (!draft) return;
    setSavingAssetId(asset.id);
    setError('');
    try {
      await onUpdateAsset(asset.id, {
        storyText: draft.storyText,
        textPlacement: draft.textPlacement,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save page text.');
    } finally {
      setSavingAssetId(null);
    }
  };

  const handleMovePage = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= productAssets.length) return;
    const current = productAssets[index];
    const swapWith = productAssets[targetIdx];
    const currentOrder = current.pageOrder;
    const swapOrder = swapWith.pageOrder === currentOrder ? currentOrder + direction : swapWith.pageOrder;
    setError('');
    try {
      await onUpdateAsset(current.id, { pageOrder: swapOrder });
      await onUpdateAsset(swapWith.id, { pageOrder: currentOrder });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reorder pages.');
    }
  };

  const handleBuildPdf = async () => {
    if (!product) return;
    setError('');
    setBuildingPdf(true);
    try {
      const chosenAssets = productAssets.filter((a) => selectedAssetIds.includes(a.id));

      // 1. Build a guaranteed-valid, compact KDP PDF Blob locally (immune to Vercel 4.5MB limit & /tmp cold starts)
      const clientPdf = await buildClientKdpPdfBlob({
        product,
        assets: chosenAssets,
        trimSize: exportTrim,
        includeBleed: exportBleed,
        includeTitlePage,
        includeCaptions: pageLayout !== 'none',
        pageLayout,
        includeCoverTitle,
        authorImprint: settings.authorImprint,
      });

      // 2. Also persist export metadata on the server for Finished Downloads & Drive sync
      let artifact: ExportArtifact;
      try {
        const rasterOverrides: Record<string, string> = {};
        for (const asset of chosenAssets) {
          if (asset.mimeType === 'image/svg+xml' || asset.name.endsWith('.svg')) {
            const png = await rasterizeSvgUrlToPng(asset.url);
            if (png) rasterOverrides[asset.id] = png;
          }
        }
        artifact = await onExportPdf({
          productId: product.id,
          assetIds: chosenAssets.map((a) => a.id),
          trimSize: exportTrim,
          includeBleed: exportBleed,
          includeTitlePage,
          includeCaptions: pageLayout !== 'none',
          pageLayout,
          includeCoverTitle,
          rasterOverrides,
        });
      } catch {
        const fallbackName = `${sanitizeFolderSlug(product.title)}-${exportTrim}.pdf`;
        artifact = {
          id: `local-${Date.now()}`,
          productId: product.id,
          format: 'pdf',
          fileName: fallbackName,
          trimSize: exportTrim,
          includeBleed: exportBleed,
          pageCount: clientPdf.pageCount,
          sizeBytes: clientPdf.sizeBytes,
          downloadUrl: '',
          driveFileId: null,
          driveWebLink: null,
          createdAt: new Date().toISOString(),
        };
      }

      cacheArtifactBlob(artifact.id, clientPdf.blob);
      setLatestArtifact({
        ...artifact,
        pageCount: clientPdf.pageCount,
        sizeBytes: clientPdf.sizeBytes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF assembly failed.');
    } finally {
      setBuildingPdf(false);
    }
  };

  const handleDownloadExport = async (exp: ExportArtifact) => {
    setError('');
    setDownloadingId(exp.id);
    try {
      const blob = await resolveVerifiedArtifactBlob({
        artifact: exp,
        product: product ?? undefined,
        assets,
        authorImprint: settings.authorImprint,
        pageLayout,
        includeTitlePage,
        includeCoverTitle,
      });
      triggerBlobDownload(blob, exp.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreviewPdf = async (exp: ExportArtifact) => {
    setError('');
    setDownloadingId(exp.id);
    try {
      const blob = await resolveVerifiedArtifactBlob({
        artifact: exp,
        product: product ?? undefined,
        assets,
        authorImprint: settings.authorImprint,
        pageLayout,
        includeTitlePage,
        includeCoverTitle,
      });
      if (previewState?.blobUrl) {
        URL.revokeObjectURL(previewState.blobUrl);
      }
      setPreviewState({
        fileName: exp.fileName,
        blobUrl: URL.createObjectURL(blob),
        blob,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open PDF preview.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleBuildZip = async () => {
    if (!product) return;
    setError('');
    setBuildingZip(true);
    try {
      const artifact = await onExportBundle({
        productId: product.id,
        assetIds: selectedAssetIds,
      });
      setLatestArtifact(artifact);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bundle packaging failed.');
    } finally {
      setBuildingZip(false);
    }
  };

  const isStepComplete = (s: BuilderStep): boolean => {
    if (!readiness || creatingNew) return false;
    if (s === 1) return readiness.hasConcept;
    if (s === 2) return readiness.hasPrompts || readiness.interiorCount > 0 || readiness.hasManuscript;
    return readiness.exportCount > 0;
  };

  return (
    <div className="space-y-5">
      {/* Unified Product Context & 3-Step Progress Bar */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900 sm:text-lg">
              {creatingNew ? 'Start a New Digital Product' : product?.title ?? 'Product Studio'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Simple 3-step workflow from book concept or market trend to a finished KDP PDF.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {products.length > 0 && (
              <select
                aria-label="Switch active product"
                value={creatingNew ? '__new__' : productId}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setCreatingNew(true);
                    setStep(1);
                  } else {
                    setCreatingNew(false);
                    onSelectProduct(e.target.value);
                  }
                }}
                className="max-w-[220px] rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
                <option value="__new__">+ Start New Book / Product</option>
              </select>
            )}

            <button
              type="button"
              onClick={onGoToTrends}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Find Niche in Trends
            </button>
          </div>
        </div>

        {/* 3-Tab Studio Stepper */}
        <nav
          aria-label="Studio tabs"
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {STEP_META.map((item) => {
            const active = step === item.step;
            const done = isStepComplete(item.step);
            const disabled = creatingNew && item.step > 1;
            return (
              <button
                key={item.step}
                type="button"
                disabled={disabled}
                aria-current={active ? 'step' : undefined}
                onClick={() => setStep(item.step)}
                className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-left text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  active
                    ? 'border-blue-700 bg-blue-50 text-blue-900'
                    : done
                      ? 'border-slate-200 bg-slate-50/70 text-slate-800 hover:border-slate-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="truncate sm:hidden">{item.short}</span>
                <span className="hidden truncate sm:inline">{item.title}</span>
                {done && !active && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </nav>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
        >
          {error}
        </div>
      )}

      {/* TAB 1: CONCEPT & SPECS */}
      {step === 1 && (
        <StudioConceptPanel
          creatingNew={creatingNew}
          product={product}
          title={title}
          subtitle={subtitle}
          category={category}
          trimSize={trimSize}
          pageCount={pageCount}
          includeBleed={includeBleed}
          targetAudience={targetAudience}
          conceptSummary={conceptSummary}
          artStylePreset={artStylePreset}
          newRefPhoto={newRefPhoto}
          refPhotoInputRef={refPhotoInputRef}
          savedReferenceAsset={savedReferenceAsset}
          generatingPack={generatingPack}
          setTitle={setTitle}
          setSubtitle={setSubtitle}
          setCategory={setCategory}
          setTrimSize={setTrimSize}
          setPageCount={setPageCount}
          setIncludeBleed={setIncludeBleed}
          setTargetAudience={setTargetAudience}
          setConceptSummary={setConceptSummary}
          setArtStylePreset={setArtStylePreset}
          handlePhotoUpload={handlePhotoUpload}
          handleStep1SaveAndGeneratePrompts={handleStep1SaveAndGeneratePrompts}
          onSkipToGenerate={() => setStep(2)}
        />
      )}


      {/* TAB 2: GENERATE - PROMPTS + STORY PAGES & COPY */}
      {step === 2 && product && editablePack && (
        <StudioGeneratePanel
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
          productAssets={productAssets}
          pageUploadInputRef={pageUploadInputRef}
          autoFillingPages={autoFillingPages}
          pageDrafts={pageDrafts}
          setPageDrafts={setPageDrafts}
          pageLayout={pageLayout}
          setPageLayout={setPageLayout}
          includeCoverTitle={includeCoverTitle}
          setIncludeCoverTitle={setIncludeCoverTitle}
          notesDraft={notesDraft}
          setNotesDraft={setNotesDraft}
          notesDirty={notesDirty}
          setNotesDirty={setNotesDirty}
          savingNotes={savingNotes}
          copiedNotes={copiedNotes}
          setCopiedNotes={setCopiedNotes}
          savingAssetId={savingAssetId}
          regeneratingAssetId={regeneratingAssetId}
          updatePackField={updatePackField}
          handleSavePromptEdits={handleSavePromptEdits}
          handleRegeneratePrompts={handleRegeneratePrompts}
          handleBuildAllSections={handleBuildAllSections}
          handleGenerateCover={handleGenerateCover}
          handleGenerateStory={handleGenerateStory}
          handleGenerateListing={handleGenerateListing}
          handleGenerateInteriorPage={handleGenerateInteriorPage}
          handleGenerateAllPagesFromPhoto={handleGenerateAllPagesFromPhoto}
          handleSyncPromptsFromStory={handleSyncPromptsFromStory}
          handlePhotoUpload={handlePhotoUpload}
          handleDirectPageUpload={handleDirectPageUpload}
          handleAutoFillPagesFromManuscript={handleAutoFillPagesFromManuscript}
          handleMatchArtToPageText={handleMatchArtToPageText}
          handleSaveNotes={handleSaveNotes}
          handleSavePageDesign={handleSavePageDesign}
          handleMovePage={handleMovePage}
          onDeleteAsset={onDeleteAsset}
          onOpenInPromptStudio={onOpenInPromptStudio}
          onOpenGallery={onOpenGallery}
          onBackToConcept={() => setStep(1)}
          onContinueToDownload={() => setStep(3)}
        />
      )}


      {/* TAB 3: DOWNLOAD - EXPORT FINISHED PRODUCT */}
      {step === 3 && product && (
        <StudioDownloadPanel
          product={product}
          exportTrim={exportTrim}
          setExportTrim={setExportTrim}
          dims={dims}
          exportBleed={exportBleed}
          setExportBleed={setExportBleed}
          includeTitlePage={includeTitlePage}
          setIncludeTitlePage={setIncludeTitlePage}
          includeCoverTitle={includeCoverTitle}
          setIncludeCoverTitle={setIncludeCoverTitle}
          pageLayout={pageLayout}
          setPageLayout={setPageLayout}
          selectedAssetIds={selectedAssetIds}
          setSelectedAssetIds={setSelectedAssetIds}
          productAssets={productAssets}
          latestArtifact={latestArtifact}
          downloadingId={downloadingId}
          buildingPdf={buildingPdf}
          buildingZip={buildingZip}
          driveUploadingId={driveUploadingId}
          setDriveUploadingId={setDriveUploadingId}
          productExports={productExports}
          googleConnected={googleConnected}
          handleBuildPdf={handleBuildPdf}
          handleBuildZip={handleBuildZip}
          handleDownloadExport={handleDownloadExport}
          handlePreviewPdf={handlePreviewPdf}
          onUploadArtifactToDrive={onUploadArtifactToDrive}
          onBackToGenerate={() => setStep(2)}
        />
      )}

      <PdfPreviewModal
        open={Boolean(previewState)}
        fileName={previewState?.fileName ?? ''}
        blobUrl={previewState?.blobUrl ?? null}
        onDownload={() => {
          if (previewState) {
            triggerBlobDownload(previewState.blob, previewState.fileName);
          }
        }}
        onClose={() => {
          if (previewState?.blobUrl) {
            URL.revokeObjectURL(previewState.blobUrl);
          }
          setPreviewState(null);
        }}
      />
    </div>
  );
}
