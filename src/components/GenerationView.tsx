import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  FileText,
  ImagePlus,
  Images,
  Layers,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import type {
  GalleryImage,
  GenerationMode,
  GenerationProvider,
  GenerationRecord,
  PageTextLayout,
  Product,
  PromptPrefillRequest,
  StorageAsset,
  WorkspaceSettings,
} from '../types/workspace';
import {
  STYLE_PRESET_OPTIONS,
  buildPromptPackFromConcept,
  parseManuscriptIntoPageTexts,
} from '../lib/workspaceLogic';
import { AssetPreviewImage } from './AssetPreviewImage';

interface GenerationViewProps {
  products: Product[];
  assets: StorageAsset[];
  galleryImages: GalleryImage[];
  generations: GenerationRecord[];
  settings: WorkspaceSettings;
  activeProductId: string | null;
  initialMode?: GenerationMode;
  prefillRequest?: PromptPrefillRequest | null;
  onClearPrefill?: () => void;
  onSelectProduct: (id: string) => void;
  onQuickCreateProduct: (title: string) => Promise<Product>;
  onOpenGallery?: () => void;
  onGenerateText: (payload: {
    productId: string;
    prompt: string;
    mode: GenerationMode;
    provider: GenerationProvider;
    saveToManuscript: boolean;
    openRouterModel?: string;
  }) => Promise<void>;
  onGenerateIllustration: (payload: {
    productId: string;
    prompt: string;
    stylePreset: string;
    provider: GenerationProvider;
    kind: StorageAsset['kind'];
    openRouterModel?: string;
    referenceImageDataUrl?: string;
    referenceAssetId?: string;
    galleryImageId?: string;
    saveReferenceToProduct?: boolean;
    referenceFileName?: string;
    sceneIndex?: number;
    totalScenes?: number;
    storyText?: string;
    textPlacement?: PageTextLayout;
  }) => Promise<void>;
}

const STYLE_PRESETS = STYLE_PRESET_OPTIONS;

const OPENROUTER_IMAGE_MODELS = [
  {
    id: 'google/gemini-2.5-flash-image',
    label: 'google/gemini-2.5-flash-image (Fast Photo-to-Cartoon)',
  },
  {
    id: 'openai/gpt-5-image-mini',
    label: 'openai/gpt-5-image-mini (Cartoon & Storybook)',
  },
  {
    id: 'openai/gpt-5-image',
    label: 'openai/gpt-5-image (High Detail)',
  },
  {
    id: 'google/gemini-3.1-flash-image-preview',
    label: 'google/gemini-3.1-flash-image-preview',
  },
];

export function GenerationView({
  products,
  assets,
  galleryImages,
  generations,
  settings,
  activeProductId,
  initialMode,
  prefillRequest,
  onClearPrefill,
  onSelectProduct,
  onQuickCreateProduct,
  onOpenGallery,
  onGenerateText,
  onGenerateIllustration,
}: GenerationViewProps) {
  const productId = activeProductId || products[0]?.id || '';
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId]
  );

  const [mode, setMode] = useState<GenerationMode>(initialMode ?? 'illustration');
  const [provider, setProvider] = useState<GenerationProvider>(
    settings.openRouterConfigured ? 'openrouter' : 'gemini'
  );
  const [openRouterTextModel, setOpenRouterTextModel] = useState('openai/gpt-4o-mini');
  const [openRouterImageModel, setOpenRouterImageModel] = useState(OPENROUTER_IMAGE_MODELS[0].id);
  const [stylePreset, setStylePreset] = useState<string>(STYLE_PRESETS[0].value);
  const [assetKind, setAssetKind] = useState<StorageAsset['kind']>('illustration');
  const [saveToManuscript, setSaveToManuscript] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [copiedGenId, setCopiedGenId] = useState<string | null>(null);

  // Inline new product creation when workspace starts empty (or when toggled)
  const [creatingNewProduct, setCreatingNewProduct] = useState(false);
  const [newProductTitle, setNewProductTitle] = useState('');

  // Photo-to-Cartoon / Reference Image upload + Gallery selection state
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<{
    name: string;
    mimeType: string;
    dataUrl: string;
  } | null>(null);
  const [selectedGalleryImageId, setSelectedGalleryImageId] = useState<string | null>(null);
  const [useSavedReference, setUseSavedReference] = useState(true);
  const [saveReferenceToProduct, setSaveReferenceToProduct] = useState(true);

  // Multi-Page Sequence from 1 Photo state
  const [multiPageOpen, setMultiPageOpen] = useState(false);
  const [multiPageCount, setMultiPageCount] = useState<3 | 4 | 6>(4);
  const [multiPagePrompts, setMultiPagePrompts] = useState<string[]>([
    'Morning wake-up scene: character stretching happily in a sunlit cozy bedroom, looking excited for the day ahead.',
    'Outdoor exploration: character discovering a magical garden path filled with fluttering butterflies and wildflowers.',
    'Playful adventure moment: character laughing while splashing near a sparkling wooden bridge and friendly woodland animals.',
    'Warm sunset resolution: character curled up happily under glowing lantern light at twilight.',
  ]);
  const [multiPageProgress, setMultiPageProgress] = useState<string | null>(null);

  const [loadedSlotLabel, setLoadedSlotLabel] = useState<string | null>(null);
  const lastPrefillNonceRef = useRef<number>(0);

  // Apply explicit prefill handoff from Product Builder / Trends / Image Gallery
  useEffect(() => {
    if (!prefillRequest || prefillRequest.nonce === lastPrefillNonceRef.current) return;
    lastPrefillNonceRef.current = prefillRequest.nonce;
    setMode(prefillRequest.mode);
    setPrompt(prefillRequest.prompt);
    if (prefillRequest.stylePreset) {
      setStylePreset(prefillRequest.stylePreset);
    }
    if (prefillRequest.assetKind) {
      setAssetKind(prefillRequest.assetKind);
    }
    if (prefillRequest.galleryImageId) {
      setSelectedGalleryImageId(prefillRequest.galleryImageId);
      setUploadedPhoto(null);
      setMultiPageOpen(true);
    }
    if (prefillRequest.mode === 'illustration' && settings.openRouterConfigured) {
      setProvider('openrouter');
    }
    setLoadedSlotLabel(prefillRequest.label ?? 'Product prompt');
    onClearPrefill?.();
  }, [prefillRequest, settings.openRouterConfigured, onClearPrefill]);

  useEffect(() => {
    if (initialMode && !prefillRequest) {
      setMode(initialMode);
      if (initialMode === 'illustration' && settings.openRouterConfigured) {
        setProvider('openrouter');
      }
    }
  }, [initialMode, prefillRequest, settings.openRouterConfigured]);

  const savedReferenceAsset = useMemo(() => {
    if (!selectedProduct) return null;
    if (selectedProduct.referenceAssetId) {
      const exact = assets.find((a) => a.id === selectedProduct.referenceAssetId);
      if (exact) return exact;
    }
    return assets.find((a) => a.productId === selectedProduct.id && a.kind === 'reference') ?? null;
  }, [selectedProduct, assets]);

  const activePromptPack = useMemo(() => {
    if (!selectedProduct) return null;
    return (
      selectedProduct.promptPack ??
      buildPromptPackFromConcept({
        title: selectedProduct.title,
        subtitle: selectedProduct.subtitle,
        category: selectedProduct.category,
        trimSize: selectedProduct.trimSize,
        pageCount: selectedProduct.pageCount,
        concept: selectedProduct.manuscriptNotes || selectedProduct.subtitle || selectedProduct.title,
      })
    );
  }, [selectedProduct]);

  // Auto-fill editable prompt from selected product's promptPack when switching product or mode
  useEffect(() => {
    setUseSavedReference(true);
    if (prefillRequest) return;
    const pack = activePromptPack;
    if (!pack) return;
    if (pack.artStylePreset && STYLE_PRESETS.some((s) => s.value === pack.artStylePreset)) {
      setStylePreset(pack.artStylePreset);
    }
    if (mode === 'illustration' && pack.coverPrompt) {
      setPrompt(pack.coverPrompt);
      setAssetKind('cover');
      setLoadedSlotLabel('Front Cover');
    } else if (mode === 'manuscript' && pack.manuscriptPrompt) {
      setPrompt(pack.manuscriptPrompt);
      setLoadedSlotLabel('Story / Interior Copy');
    } else if (mode === 'kdp-metadata' && pack.kdpMetadataPrompt) {
      setPrompt(pack.kdpMetadataPrompt);
      setLoadedSlotLabel('KDP Listing & Keywords');
    }
  }, [productId, mode]);

  const selectedGalleryImage = useMemo(
    () =>
      selectedGalleryImageId
        ? galleryImages.find((g) => g.id === selectedGalleryImageId) ?? null
        : null,
    [galleryImages, selectedGalleryImageId]
  );

  // Seed multi-page scene prompts from active product prompt pack when product changes
  useEffect(() => {
    if (!activePromptPack) return;
    const basePrompts = activePromptPack.interiorPrompts.map((p) => p.prompt).filter(Boolean);
    if (basePrompts.length >= 3) {
      setMultiPagePrompts((prev) => {
        const next = [...basePrompts];
        while (next.length < 6) {
          next.push(
            prev[next.length] ||
              `New distinct storybook scene ${next.length + 1} for "${selectedProduct?.title ?? 'this book'}" featuring the main character in an expressive pose and fresh environment.`
          );
        }
        return next.slice(0, 6);
      });
    }
  }, [productId]);

  const showNewProductInput = products.length === 0 || creatingNewProduct;
  const hasActiveReference = Boolean(
    uploadedPhoto || selectedGalleryImage || (savedReferenceAsset && useSavedReference)
  );

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Upload a PNG, JPEG, or WebP photo for image generation.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Uploaded photo must be under 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedGalleryImageId(null);
      setUploadedPhoto({
        name: file.name,
        mimeType: file.type,
        dataUrl: String(reader.result),
      });
    };
    reader.onerror = () => {
      setError('Could not read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateMultiPageSequence = async () => {
    if (!hasActiveReference) {
      setError('Upload a photo or select one from your Image Gallery first.');
      return;
    }

    let targetProductId = productId;
    if (showNewProductInput) {
      if (newProductTitle.trim().length < 2) {
        setError('Enter a product title (at least 2 characters) to save your generated book pages.');
        return;
      }
    } else if (!targetProductId) {
      setError('Select or create a product first.');
      return;
    }

    const scenes = multiPagePrompts.slice(0, multiPageCount).map((p) => p.trim()).filter(Boolean);
    if (scenes.length === 0) {
      setError('Enter at least one scene description for your multi-page sequence.');
      return;
    }

    setError('');
    setRunning(true);
    try {
      if (showNewProductInput) {
        const created = await onQuickCreateProduct(newProductTitle.trim());
        targetProductId = created.id;
        setCreatingNewProduct(false);
        setNewProductTitle('');
      }

      const parsedPages = parseManuscriptIntoPageTexts(selectedProduct?.manuscriptNotes ?? '', scenes.length);

      for (let i = 0; i < scenes.length; i++) {
        setMultiPageProgress(`Generating distinct book page ${i + 1} of ${scenes.length} from your photo…`);
        await onGenerateIllustration({
          productId: targetProductId,
          prompt: scenes[i],
          stylePreset,
          provider,
          kind: 'illustration',
          openRouterModel: provider === 'openrouter' ? openRouterImageModel : undefined,
          referenceImageDataUrl: uploadedPhoto?.dataUrl,
          referenceFileName: uploadedPhoto?.name,
          galleryImageId: !uploadedPhoto && selectedGalleryImage ? selectedGalleryImage.id : undefined,
          referenceAssetId:
            !uploadedPhoto && !selectedGalleryImage && useSavedReference && savedReferenceAsset
              ? savedReferenceAsset.id
              : undefined,
          saveReferenceToProduct: Boolean(i === 0 && uploadedPhoto && saveReferenceToProduct),
          sceneIndex: i,
          totalScenes: scenes.length,
          storyText: parsedPages[i] || undefined,
        });
      }
      setMultiPageProgress(null);
    } catch (err) {
      setMultiPageProgress(null);
      setError(err instanceof Error ? err.message : 'Multi-page generation stopped with an error.');
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 5) {
      setError('Enter a descriptive prompt of at least 5 characters.');
      return;
    }

    let targetProductId = productId;
    if (showNewProductInput) {
      if (newProductTitle.trim().length < 2) {
        setError('Enter a product title (at least 2 characters) to save your generated output.');
        return;
      }
    } else if (!targetProductId) {
      setError('Select or create a product first.');
      return;
    }

    setError('');
    setRunning(true);
    try {
      if (showNewProductInput) {
        const created = await onQuickCreateProduct(newProductTitle.trim());
        targetProductId = created.id;
        setCreatingNewProduct(false);
        setNewProductTitle('');
      }

      if (mode === 'illustration') {
        await onGenerateIllustration({
          productId: targetProductId,
          prompt: prompt.trim(),
          stylePreset,
          provider,
          kind: assetKind,
          openRouterModel: provider === 'openrouter' ? openRouterImageModel : undefined,
          referenceImageDataUrl: uploadedPhoto?.dataUrl,
          referenceFileName: uploadedPhoto?.name,
          galleryImageId: !uploadedPhoto && selectedGalleryImage ? selectedGalleryImage.id : undefined,
          referenceAssetId:
            !uploadedPhoto && !selectedGalleryImage && useSavedReference && savedReferenceAsset
              ? savedReferenceAsset.id
              : undefined,
          saveReferenceToProduct: Boolean(uploadedPhoto && saveReferenceToProduct),
        });
      } else {
        await onGenerateText({
          productId: targetProductId,
          prompt: prompt.trim(),
          mode,
          provider,
          saveToManuscript,
          openRouterModel: provider === 'openrouter' ? openRouterTextModel : undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setRunning(false);
    }
  };

  const productGenerations = generations.filter(
    (g) => !productId || g.productId === productId
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Prompt Composer */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 xl:col-span-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">AI Prompt Studio</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Generate copy, KDP metadata, or photo-to-cartoon illustrations via OpenRouter.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Target Product (supports inline creation when empty) */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor={showNewProductInput ? 'gen-new-product' : 'gen-product'}
                className="block text-xs font-medium text-slate-700"
              >
                {showNewProductInput ? 'New Product Title' : 'Target Product'}
              </label>
              {products.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCreatingNewProduct((prev) => !prev)}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                >
                  {creatingNewProduct ? 'Choose existing' : '+ New product'}
                </button>
              )}
            </div>

            {showNewProductInput ? (
              <div className="mt-1">
                <input
                  id="gen-new-product"
                  type="text"
                  value={newProductTitle}
                  onChange={(e) => setNewProductTitle(e.target.value)}
                  placeholder="e.g., Zebo The Dog"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Creates this product and its storage folder automatically when you generate.
                </p>
              </div>
            ) : (
              <select
                id="gen-product"
                value={productId}
                onChange={(e) => onSelectProduct(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.trimSize}&quot;)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Output Mode Tabs */}
          <div>
            <span className="block text-xs font-medium text-slate-700">Output Mode</span>
            <div
              className="mt-1.5 grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1"
              role="group"
              aria-label="Generation output mode"
            >
              {(
                [
                  ['illustration', 'Cartoon / Art'],
                  ['manuscript', 'Story Copy'],
                  ['kdp-metadata', 'KDP Meta'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    if (value === 'illustration' && settings.openRouterConfigured) {
                      setProvider('openrouter');
                    }
                  }}
                  className={`truncate rounded px-1.5 py-2 text-[11px] font-medium transition-colors sm:px-2.5 sm:text-xs ${
                    mode === value
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Provider & Model Row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="gen-provider" className="block text-xs font-medium text-slate-700">
                Server Provider Route
              </label>
              <select
                id="gen-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value as GenerationProvider)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none"
              >
                <option value="openrouter">
                  OpenRouter API {settings.openRouterConfigured ? '(Active)' : '(Needs Key)'}
                </option>
                <option value="gemini">
                  Gemini 4 Hydrogen {mode === 'illustration' ? '(Vector SVG)' : '(Active)'}
                </option>
              </select>
            </div>

            {provider === 'openrouter' && mode === 'illustration' ? (
              <div>
                <label htmlFor="or-img-model" className="block text-xs font-medium text-slate-700">
                  OpenRouter Image Model
                </label>
                <select
                  id="or-img-model"
                  value={openRouterImageModel}
                  onChange={(e) => setOpenRouterImageModel(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                >
                  {OPENROUTER_IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : provider === 'openrouter' ? (
              <div>
                <label htmlFor="or-model" className="block text-xs font-medium text-slate-700">
                  OpenRouter Model ID
                </label>
                <input
                  id="or-model"
                  type="text"
                  value={openRouterTextModel}
                  onChange={(e) => setOpenRouterTextModel(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
            ) : mode === 'illustration' ? (
              <div>
                <label htmlFor="gen-asset-kind" className="block text-xs font-medium text-slate-700">
                  Save Asset As
                </label>
                <select
                  id="gen-asset-kind"
                  value={assetKind}
                  onChange={(e) => setAssetKind(e.target.value as StorageAsset['kind'])}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                >
                  <option value="illustration">Interior Illustration</option>
                  <option value="cover">Front Cover</option>
                </select>
              </div>
            ) : (
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={saveToManuscript}
                    onChange={(e) => setSaveToManuscript(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-700"
                  />
                  Append to manuscript
                </label>
              </div>
            )}
          </div>

          {/* Illustration-specific options: Reference Photo Upload + Style Preset + Asset Kind */}
          {mode === 'illustration' && (
            <>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-800">
                    Reference Photo (1 Photo → Multiple Illustrated Pages)
                  </span>
                  <div className="flex items-center gap-2">
                    {onOpenGallery && (
                      <button
                        type="button"
                        onClick={onOpenGallery}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap"
                      >
                        <Images className="h-3 w-3" aria-hidden="true" />
                        Gallery
                      </button>
                    )}
                    {(uploadedPhoto || selectedGalleryImage) && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedPhoto(null);
                          setSelectedGalleryImageId(null);
                          if (photoInputRef.current) photoInputRef.current.value = '';
                        }}
                        aria-label="Remove selected reference photo"
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800 whitespace-nowrap"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={photoInputRef}
                  id="gen-ref-photo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {uploadedPhoto ? (
                  <div className="mt-2.5 space-y-2.5">
                    <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-2.5">
                      <img
                        src={uploadedPhoto.dataUrl}
                        alt="Uploaded reference photo preview"
                        className="h-16 w-16 shrink-0 rounded border border-slate-200 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-slate-900">
                          {uploadedPhoto.name}
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          AI keeps this character&apos;s identity across new scenes &amp; poses.
                        </p>
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="mt-1 text-xs font-medium text-blue-700 hover:text-blue-800"
                        >
                          Replace photo
                        </button>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={saveReferenceToProduct}
                        onChange={(e) => setSaveReferenceToProduct(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                      />
                      Save to Image Gallery &amp; product for future pages
                    </label>
                  </div>
                ) : selectedGalleryImage ? (
                  <div className="mt-2.5 flex items-center gap-3 rounded-md border border-blue-200 bg-white p-2.5">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
                      <AssetPreviewImage
                        src={selectedGalleryImage.url}
                        alt={selectedGalleryImage.label}
                        fallbackLabel="Gallery"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900">
                        Gallery Photo: {selectedGalleryImage.label}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Ready to generate a single page or a full multi-page sequence with fresh poses.
                      </p>
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="mt-1 text-xs font-medium text-blue-700 hover:text-blue-800"
                      >
                        Upload different photo
                      </button>
                    </div>
                  </div>
                ) : savedReferenceAsset && useSavedReference ? (
                  <div className="mt-2.5 flex items-center gap-3 rounded-md border border-blue-200 bg-white p-2.5">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-50">
                      <AssetPreviewImage
                        src={savedReferenceAsset.url}
                        alt="Saved product reference photo"
                        fallbackLabel="Photo"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900">
                        Using saved product photo
                      </div>
                      <div className="truncate font-mono text-[11px] text-slate-500">
                        {savedReferenceAsset.name}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="text-xs font-medium text-blue-700 hover:text-blue-800"
                        >
                          Upload new photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setUseSavedReference(false)}
                          className="text-xs text-slate-500 hover:text-slate-800"
                        >
                          Text-only instead
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 space-y-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-600 hover:bg-blue-50/30 hover:text-blue-800"
                    >
                      <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                      Upload Reference Photo (PNG, JPEG, WebP)
                    </button>
                    {savedReferenceAsset && !useSavedReference && (
                      <button
                        type="button"
                        onClick={() => setUseSavedReference(true)}
                        className="text-xs font-medium text-blue-700 hover:text-blue-800"
                      >
                        Re-attach saved product photo ({savedReferenceAsset.name})
                      </button>
                    )}
                  </div>
                )}

                {/* Quick Pick from Image Gallery Strip */}
                {galleryImages.length > 0 && (
                  <div className="mt-3 border-t border-slate-200 pt-2.5">
                    <div className="mb-1.5 text-[11px] font-medium text-slate-600">
                      Or pick from your saved Image Gallery:
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                      {galleryImages.slice(0, 10).map((img) => {
                        const active = !uploadedPhoto && selectedGalleryImageId === img.id;
                        return (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => {
                              setUploadedPhoto(null);
                              setSelectedGalleryImageId(active ? null : img.id);
                            }}
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
                            <span className="max-w-[96px] truncate">{img.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Multi-Page Sequence from 1 Photo Panel */}
                {hasActiveReference && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <button
                      type="button"
                      onClick={() => setMultiPageOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between text-xs font-semibold text-blue-800 hover:text-blue-900"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                        Generate Multiple Distinct Pages From This Photo
                      </span>
                      <span className="text-[11px] font-medium">
                        {multiPageOpen ? 'Hide' : 'Expand'}
                      </span>
                    </button>

                    {multiPageOpen && (
                      <div className="mt-2.5 space-y-2.5 rounded-md border border-blue-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-700">Pages to generate:</span>
                          <div className="flex items-center gap-1">
                            {([3, 4, 6] as const).map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setMultiPageCount(n)}
                                className={`rounded border px-2.5 py-1 text-[11px] font-medium ${
                                  multiPageCount === n
                                    ? 'border-blue-700 bg-blue-50 text-blue-900'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {n} Pages
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {Array.from({ length: multiPageCount }).map((_, idx) => (
                            <div key={idx}>
                              <label
                                htmlFor={`multi-scene-${idx}`}
                                className="block text-[11px] font-medium text-slate-600"
                              >
                                Page {idx + 1} Scene (distinct camera angle &amp; pose auto-applied)
                              </label>
                              <input
                                id={`multi-scene-${idx}`}
                                type="text"
                                value={multiPagePrompts[idx] ?? ''}
                                onChange={(e) =>
                                  setMultiPagePrompts((prev) => {
                                    const next = [...prev];
                                    next[idx] = e.target.value;
                                    return next;
                                  })
                                }
                                className="mt-0.5 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>

                        {multiPageProgress && (
                          <div className="flex items-center gap-2 rounded bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-900">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" aria-hidden="true" />
                            {multiPageProgress}
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={running}
                          onClick={handleGenerateMultiPageSequence}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-55"
                        >
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          {running
                            ? 'Generating Multi-Page Sequence…'
                            : `Generate ${multiPageCount} Distinct Book Pages From 1 Photo`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="gen-style" className="block text-xs font-medium text-slate-700">
                    Cartoon / Art Direction Preset
                  </label>
                  <select
                    id="gen-style"
                    value={stylePreset}
                    onChange={(e) => setStylePreset(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
                  >
                    {STYLE_PRESETS.map((preset) => (
                      <option key={preset.label} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                {provider === 'openrouter' && (
                  <div>
                    <label
                      htmlFor="gen-asset-kind-or"
                      className="block text-xs font-medium text-slate-700"
                    >
                      Save Asset As
                    </label>
                    <select
                      id="gen-asset-kind-or"
                      value={assetKind}
                      onChange={(e) => setAssetKind(e.target.value as StorageAsset['kind'])}
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                    >
                      <option value="illustration">Illustration</option>
                      <option value="cover">Front Cover</option>
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Quick-Load Auto-Filled Prompts from Product Prompt Pack */}
          {activePromptPack && !showNewProductInput && (
            <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-slate-700">
                  Auto-filled prompts (click any to load &amp; edit)
                </span>
                {loadedSlotLabel && (
                  <span className="text-[11px] text-blue-700">Loaded: {loadedSlotLabel}</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mode === 'illustration' ? (
                  <>
                    {activePromptPack.coverPrompt && (
                      <button
                        type="button"
                        onClick={() => {
                          setPrompt(activePromptPack.coverPrompt);
                          setAssetKind('cover');
                          if (activePromptPack.artStylePreset) {
                            setStylePreset(activePromptPack.artStylePreset);
                          }
                          setLoadedSlotLabel('Front Cover');
                        }}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-600 hover:text-blue-800"
                      >
                        Front Cover
                      </button>
                    )}
                    {activePromptPack.interiorPrompts.map((item, idx) => (
                      <button
                        key={item.id || idx}
                        type="button"
                        onClick={() => {
                          setPrompt(item.prompt);
                          setAssetKind('illustration');
                          if (activePromptPack.artStylePreset) {
                            setStylePreset(activePromptPack.artStylePreset);
                          }
                          setLoadedSlotLabel(item.title || `Page ${idx + 1}`);
                        }}
                        className="max-w-[180px] truncate rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-600 hover:text-blue-800"
                      >
                        {item.title || `Page ${idx + 1}`}
                      </button>
                    ))}
                  </>
                ) : mode === 'manuscript' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(activePromptPack.manuscriptPrompt);
                      setLoadedSlotLabel('Story / Interior Copy');
                    }}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-600 hover:text-blue-800"
                  >
                    Load Story / Copy Prompt
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(activePromptPack.kdpMetadataPrompt);
                      setLoadedSlotLabel('KDP Listing & Keywords');
                    }}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-600 hover:text-blue-800"
                  >
                    Load KDP Listing Prompt
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="gen-prompt" className="block text-xs font-medium text-slate-700">
              {mode === 'illustration' && hasActiveReference
                ? 'Cartoon / Scene Instructions (editable before generating)'
                : 'Prompt (editable before generating)'}
            </label>
            <textarea
              id="gen-prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === 'illustration'
                  ? hasActiveReference
                    ? 'e.g., Turn this dog into a joyful cartoon character wearing a red bandana, playing in a sunny backyard meadow for a children’s book cover…'
                    : 'Describe the illustration or cartoon scene you want OpenRouter to create…'
                  : mode === 'kdp-metadata'
                    ? 'Ask for an Amazon KDP book description, subtitle ideas, and 7 high-intent keyword phrases…'
                    : 'Describe the chapter, story spread, or page copy to draft…'
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={running}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {mode === 'illustration' ? (
              hasActiveReference ? (
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
              )
            ) : (
              <Wand2 className="h-4 w-4" aria-hidden="true" />
            )}
            {running
              ? mode === 'illustration'
                ? 'Generating image via OpenRouter…'
                : 'Generating via server route…'
              : mode === 'illustration'
                ? hasActiveReference
                  ? 'Generate Cartoon / Illustration from Photo'
                  : 'Generate Illustration & Save to Folder'
                : 'Generate Copy'}
          </button>
        </form>
      </section>

      {/* Right Output Feed */}
      <section className="rounded-lg border border-slate-200 bg-white xl:col-span-7">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Recent Outputs{' '}
            <span className="ml-1 font-mono text-xs font-normal text-slate-500 tabular-nums">
              ({productGenerations.length})
            </span>
          </h2>
          <span className="text-xs text-slate-500">Saved automatically to product history</span>
        </div>

        {productGenerations.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <FileText className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-slate-900">No generations yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Upload a photo on the left to generate a cartoon or storybook illustration via OpenRouter, or draft story copy.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {productGenerations.map((gen) => {
              const linkedAsset = gen.assetId
                ? assets.find((a) => a.id === gen.assetId)
                : null;
              return (
                <article key={gen.id} className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium capitalize text-slate-800">
                        {gen.mode.replace('-', ' ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{gen.model}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {new Date(gen.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {gen.outputText && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(gen.outputText ?? '').catch(() => {});
                          setCopiedGenId(gen.id);
                          setTimeout(() => setCopiedGenId(null), 1600);
                        }}
                        className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        {copiedGenId === gen.id ? 'Copied' : 'Copy text'}
                      </button>
                    )}
                  </div>

                  <p className="mt-2 text-xs font-medium text-slate-600">
                    Prompt: {gen.prompt}
                  </p>

                  {gen.outputText && (
                    <div className="mt-3 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                      {gen.outputText}
                    </div>
                  )}

                  {linkedAsset && (
                    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="h-52 w-52 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        <AssetPreviewImage
                          src={linkedAsset.url}
                          alt={linkedAsset.caption || linkedAsset.name}
                          fallbackLabel={linkedAsset.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600">
                        <div className="font-mono font-medium text-slate-900">
                          {linkedAsset.name}
                        </div>
                        <p>Saved to product storage folder and ready for KDP PDF export.</p>
                        <a
                          href={linkedAsset.url}
                          download={linkedAsset.name}
                          className="inline-block font-medium text-blue-700 hover:text-blue-800"
                        >
                          Download image
                        </a>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
