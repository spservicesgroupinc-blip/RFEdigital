import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  CloudUpload,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileDown,
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
  buildPromptPackFromConcept,
  calculateKdpDimensionsPt,
  computeProductReadiness,
  formatBytes,
  parseManuscriptIntoPageTexts,
  pickStylePresetForProduct,
  sanitizeFolderSlug,
} from '../lib/workspaceLogic';
import { rasterizeSvgUrlToPng } from '../lib/api';
import {
  buildClientKdpPdfBlob,
  cacheArtifactBlob,
  resolveVerifiedArtifactBlob,
  triggerBlobDownload,
} from '../lib/clientPdf';
import { AssetPreviewImage } from './AssetPreviewImage';
import { PdfPreviewModal } from './PdfPreviewModal';

export type BuilderStep = 1 | 2 | 3 | 4;

const PAGE_LAYOUT_OPTIONS: Array<{ value: PageTextLayout; label: string; short: string }> = [
  {
    value: 'below-image',
    label: 'Below Illustration — Classic Picture Book',
    short: 'Below Art',
  },
  {
    value: 'overlay-bottom',
    label: 'Story Card Over Art — Bottom Banner',
    short: 'Bottom Card',
  },
  {
    value: 'overlay-top',
    label: 'Story Card Over Art — Top Banner',
    short: 'Top Card',
  },
  {
    value: 'facing-page',
    label: 'Facing-Page Spread — Story Left, Art Right',
    short: 'Facing Spread',
  },
  {
    value: 'none',
    label: 'Artwork Only — No Text',
    short: 'Art Only',
  },
];

interface ProductBuilderViewProps {
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
  }) => Promise<void>;
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
  { step: 1, title: '1. Concept & Specs', short: '1. Concept' },
  { step: 2, title: '2. Edit Prompts', short: '2. Prompts' },
  { step: 3, title: '3. Pages & Copy', short: '3. Pages' },
  { step: 4, title: '4. Export Product', short: '4. Export' },
];

export function ProductBuilderView({
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
}: ProductBuilderViewProps) {
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

  // Step 1: Concept & Specs Form State
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

  // Step 2: Editable Prompt Pack State
  const [editablePack, setEditablePack] = useState<ProductPromptPack | null>(null);
  const [promptDirty, setPromptDirty] = useState(false);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [generatingPack, setGeneratingPack] = useState(false);
  const [provider, setProvider] = useState<GenerationProvider>(
    settings.openRouterConfigured ? 'openrouter' : 'gemini'
  );
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);

  // Step 3: Illustrated Book Page Designer & Manuscript Copy State
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [copiedNotes, setCopiedNotes] = useState(false);
  const [pageDrafts, setPageDrafts] = useState<
    Record<string, { storyText: string; textPlacement: PageTextLayout | '' }>
  >({});
  const [savingAssetId, setSavingAssetId] = useState<string | null>(null);
  const [autoFillingPages, setAutoFillingPages] = useState(false);

  // Step 4: Export State
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

  // Step 1 submit -> create/save product & auto-fill editable prompts -> Step 2
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
      await onGenerateText({
        productId: product.id,
        prompt: editablePack.manuscriptPrompt.trim(),
        mode: 'manuscript',
        provider,
        saveToManuscript: true,
      });
    });

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
      const parsedPages = parseManuscriptIntoPageTexts(product.manuscriptNotes, 24);
      const createdAsset = await onGenerateIllustration({
        productId: product.id,
        prompt: item.prompt.trim(),
        stylePreset: artStylePreset,
        provider,
        kind: 'illustration',
        sceneIndex: pageIndex,
        totalScenes: editablePack.interiorPrompts.length,
        storyText: parsedPages[pageIndex] || undefined,
        ...getRefPayload(),
      });

      const nextInteriors = editablePack.interiorPrompts.map((p, idx) =>
        idx === pageIndex ? { ...p, generatedAssetId: createdAsset.id } : p
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
      const workingPack = {
        ...saved,
        interiorPrompts: saved.interiorPrompts.map((p) => ({ ...p })),
      };
      const parsedPages = parseManuscriptIntoPageTexts(product.manuscriptNotes, 24);
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
                storyText: parsedPages[idx] || undefined,
                ...refPayload,
              });
              workingPack.interiorPrompts[idx] = {
                ...workingPack.interiorPrompts[idx],
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
          `Generating distinct page ${i + 1} of ${tasks.length} from your photo: ${tasks[i].label}…`
        );
        await tasks[i].run();
      }
      setBatchStatus(null);
      setStep(3);
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
      const refPayload = getRefPayload();

      const tasks: Array<{ label: string; run: () => Promise<void> }> = [];
      if (workingPack.manuscriptPrompt.trim()) {
        tasks.push({
          label: 'Story / Interior Copy',
          run: () =>
            onGenerateText({
              productId: product.id,
              prompt: workingPack.manuscriptPrompt.trim(),
              mode: 'manuscript',
              provider,
              saveToManuscript: true,
            }),
        });
      }
      if (workingPack.kdpMetadataPrompt.trim()) {
        tasks.push({
          label: 'KDP Listing & Keywords',
          run: () =>
            onGenerateText({
              productId: product.id,
              prompt: workingPack.kdpMetadataPrompt.trim(),
              mode: 'kdp-metadata',
              provider,
              saveToManuscript: true,
            }),
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
                ...refPayload,
              });
              workingPack.interiorPrompts[idx] = {
                ...workingPack.interiorPrompts[idx],
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
      setStep(3);
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
        'No read-aloud story paragraphs found in your manuscript box yet. Generate Story Copy in Step 2 or type your story paragraphs (e.g. "Page 1: ...") on the right.'
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
    if (s === 2) return readiness.hasPrompts;
    if (s === 3) return readiness.interiorCount > 0 || readiness.hasManuscript;
    return readiness.exportCount > 0;
  };

  return (
    <div className="space-y-5">
      {/* Unified Product Context & 4-Step Progress Bar */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-slate-900 sm:text-lg">
              {creatingNew ? 'Start a New Digital Product' : product?.title ?? 'Product Builder'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Simple 4-step workflow from book concept or market trend to a finished KDP PDF.
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

        {/* 4-Step Horizontal Stepper */}
        <nav
          aria-label="Product creation steps"
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
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

      {/* STEP 1: CONCEPT & SPECS */}
      {step === 1 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Step 1: Describe Your Book or Product Concept
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Enter your title, format, and idea. FolioPress will auto-fill editable prompts for your cover, story copy, KDP listing, and interior pages.
              </p>
            </div>
            {!creatingNew && product?.promptPack && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
              >
                Skip to Edit Prompts
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
      )}

      {/* STEP 2: REVIEW & EDIT AUTO-FILLED PROMPTS */}
      {step === 2 && product && editablePack && (
        <section className="rounded-lg border border-slate-200 bg-white">
          {/* Header & Action Toolbar */}
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <h3 className="text-base font-semibold text-slate-900">
                Step 2: Review &amp; Edit Prompts Before Generating
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
                disabled={Boolean(runningKey)}
                onClick={handleBuildAllSections}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {runningKey === 'all' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Building…
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    Build All Sections
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
                    onClick={() =>
                      onOpenInPromptStudio({
                        productId: product.id,
                        mode: 'illustration',
                        prompt: editablePack.coverPrompt,
                        stylePreset: artStylePreset,
                        assetKind: 'cover',
                        label: 'Front Cover Artwork',
                      })
                    }
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Open in Prompt Studio
                  </button>
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
                    onClick={() =>
                      onOpenInPromptStudio({
                        productId: product.id,
                        mode: 'manuscript',
                        prompt: editablePack.manuscriptPrompt,
                        label: 'Story / Interior Copy',
                      })
                    }
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Open in Prompt Studio
                  </button>
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
                    onClick={() =>
                      onOpenInPromptStudio({
                        productId: product.id,
                        mode: 'kdp-metadata',
                        prompt: editablePack.kdpMetadataPrompt,
                        label: 'KDP Listing & Keywords',
                      })
                    }
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Open in Prompt Studio
                  </button>
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

              <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
                {editablePack.interiorPrompts.map((page, idx) => {
                  const linkedAsset = page.generatedAssetId
                    ? assets.find((a) => a.id === page.generatedAssetId)
                    : null;
                  const isRunningThis = runningKey === `page-${idx}`;
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
                          onClick={() =>
                            onOpenInPromptStudio({
                              productId: product.id,
                              mode: 'illustration',
                              prompt: page.prompt,
                              stylePreset: artStylePreset,
                              assetKind: 'illustration',
                              label: page.title,
                            })
                          }
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap"
                        >
                          Studio
                        </button>
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

          {/* Step 2 Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to Concept
            </button>
            <button
              type="button"
              onClick={async () => {
                if (promptDirty) await handleSavePromptEdits();
                setStep(3);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Continue to Pages &amp; Copy
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: ILLUSTRATED BOOK PAGE DESIGNER & COPY */}
      {step === 3 && product && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* Illustrated Book Page Designer */}
          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">
                  Step 3: Illustrated Book Page Designer{' '}
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
                  onClick={() => setStep(2)}
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
                  Go back to Step 2 to generate your cover and interior pages from your prompts or photo, or upload artwork files directly.
                </p>
                <button
                  type="button"
                  onClick={() => setStep(2)}
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
                    setStep(4);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap"
                >
                  Continue to Export
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* STEP 4: EXPORT FINISHED PRODUCT */}
      {step === 4 && product && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 xl:col-span-7">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900">
                Step 4: Export Your Finished Product
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Compile your cover and interior pages into a print-ready Amazon KDP PDF or a downloadable PNG bundle for Etsy and Gumroad.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="builder-export-trim" className="block text-xs font-medium text-slate-700">
                    KDP Trim Specification
                  </label>
                  <select
                    id="builder-export-trim"
                    value={exportTrim}
                    onChange={(e) => setExportTrim(e.target.value as KdpTrimSize)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                  >
                    <option value="8.5x8.5">8.5 × 8.5 in (Picture Book)</option>
                    <option value="8.5x11">8.5 × 11 in (Coloring / Activity)</option>
                    <option value="6x9">6 × 9 in (Trade Paperback)</option>
                    <option value="8x10">8 × 10 in (Art Print)</option>
                  </select>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2">
                  <div className="text-[11px] font-medium text-slate-500">Print Canvas Size</div>
                  <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                    {dims.finalWidthIn}&quot; × {dims.finalHeightIn}&quot;
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {dims.widthPt} × {dims.heightPt} pt
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="builder-export-layout" className="block text-xs font-medium text-slate-700">
                  Illustrated Book Text Placement
                </label>
                <select
                  id="builder-export-layout"
                  value={pageLayout}
                  onChange={(e) => setPageLayout(e.target.value as PageTextLayout)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none"
                >
                  {PAGE_LAYOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Typesets each page&apos;s story text from Step 3 (or auto-splits your manuscript) with clean storybook margins and typography.
                </p>
              </div>

              <div className="flex flex-wrap gap-5 text-xs text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportBleed}
                    onChange={(e) => setExportBleed(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                  KDP Full Bleed
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeTitlePage}
                    onChange={(e) => setIncludeTitlePage(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                  Include Title Page
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeCoverTitle}
                    onChange={(e) => setIncludeCoverTitle(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                  Show Title on Cover
                </label>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">
                    Pages Included ({selectedAssetIds.length} / {productAssets.length})
                  </span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    {pageLayout === 'facing-page'
                      ? 'Facing spreads enabled'
                      : `Total PDF pages: ${selectedAssetIds.length + (includeTitlePage ? 1 : 0)}`}
                  </span>
                </div>

                {productAssets.length === 0 ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                    No artwork pages yet — exporting now builds a clean title-page proof PDF, or return to Step 2 to generate pages first.
                  </p>
                ) : (
                  <div className="max-h-52 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200">
                    {productAssets.map((asset) => {
                      const checked = selectedAssetIds.includes(asset.id);
                      return (
                        <label
                          key={asset.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedAssetIds((prev) =>
                                prev.includes(asset.id)
                                  ? prev.filter((id) => id !== asset.id)
                                  : [...prev, asset.id]
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-blue-700"
                          />
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                            <AssetPreviewImage
                              src={asset.url}
                              alt={asset.name}
                              fallbackLabel={asset.name}
                            />
                          </div>
                          <div className="min-w-0 flex-1 text-xs">
                            <div className="truncate font-medium text-slate-900">
                              {asset.kind === 'cover' ? 'Cover' : `Page ${asset.pageOrder}`} · {asset.name}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">
                              {asset.storyText
                                ? `"${asset.storyText}"`
                                : `${formatBytes(asset.sizeBytes)}`}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {latestArtifact && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs">
                  <div>
                    <div className="font-semibold text-emerald-900">
                      Finished file ready: {latestArtifact.fileName}
                    </div>
                    <div className="font-mono text-emerald-700 tabular-nums">
                      {latestArtifact.pageCount} pages · {formatBytes(latestArtifact.sizeBytes)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {latestArtifact.format === 'pdf' && (
                      <button
                        type="button"
                        disabled={downloadingId === latestArtifact.id}
                        onClick={() => handlePreviewPdf(latestArtifact)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 whitespace-nowrap"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        Preview
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={downloadingId === latestArtifact.id}
                      onClick={() => handleDownloadExport(latestArtifact)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap"
                    >
                      {downloadingId === latestArtifact.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Download Now
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to Pages
                </button>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={buildingZip}
                    onClick={handleBuildZip}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-55 whitespace-nowrap"
                  >
                    <Archive className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    {buildingZip ? 'Packaging ZIP…' : 'Download PNG Bundle (.zip)'}
                  </button>
                  <button
                    type="button"
                    disabled={buildingPdf}
                    onClick={handleBuildPdf}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
                  >
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    {buildingPdf ? 'Building PDF…' : 'Build Finished KDP PDF'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Product Exports List */}
          <section className="rounded-lg border border-slate-200 bg-white xl:col-span-5">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                Finished Downloads{' '}
                <span className="ml-1 font-mono text-xs font-normal text-slate-500 tabular-nums">
                  ({productExports.length})
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Exported PDFs and ZIP archives for {product.title}.
              </p>
            </div>

            {productExports.length === 0 ? (
              <div className="px-6 py-14 text-center text-xs text-slate-500">
                No exports yet for this product. Click{' '}
                <span className="font-medium text-slate-800">Build Finished KDP PDF</span> on the left.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {productExports.map((exp) => (
                  <div
                    key={exp.id}
                    className="flex flex-col gap-2.5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs font-semibold text-slate-900">
                        {exp.fileName}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="uppercase">{exp.format === 'pdf' ? 'PDF' : 'ZIP'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{exp.trimSize}&quot;</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{exp.pageCount} pp</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{formatBytes(exp.sizeBytes)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {exp.format === 'pdf' && (
                        <button
                          type="button"
                          disabled={downloadingId === exp.id}
                          onClick={() => handlePreviewPdf(exp)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                          Preview
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={downloadingId === exp.id}
                        onClick={() => handleDownloadExport(exp)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {downloadingId === exp.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Download
                      </button>
                      {exp.driveWebLink ? (
                        <a
                          href={exp.driveWebLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700"
                        >
                          Drive
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : googleConnected ? (
                        <button
                          type="button"
                          disabled={driveUploadingId === exp.id}
                          onClick={async () => {
                            setDriveUploadingId(exp.id);
                            try {
                              await onUploadArtifactToDrive(exp.id);
                            } finally {
                              setDriveUploadingId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <CloudUpload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                          {driveUploadingId === exp.id ? 'Saving…' : 'Drive'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
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
