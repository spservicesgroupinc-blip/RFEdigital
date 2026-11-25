import { useState } from 'react';
import { Copy, ImagePlus, FileText, Wand2 } from 'lucide-react';
import type {
  GenerationMode,
  GenerationProvider,
  GenerationRecord,
  Product,
  StorageAsset,
  WorkspaceSettings,
} from '../types/workspace';
import { AssetPreviewImage } from './AssetPreviewImage';

interface GenerationViewProps {
  products: Product[];
  assets: StorageAsset[];
  generations: GenerationRecord[];
  settings: WorkspaceSettings;
  activeProductId: string | null;
  onSelectProduct: (id: string) => void;
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
  }) => Promise<void>;
}

const STYLE_PRESETS = [
  'Hand-painted gouache picture book illustration on warm cold-press watercolor paper',
  'Crisp black-and-white fine ink line art coloring page, clean white background',
  'Vintage archival botanical print, delicate ink linework and muted sage watercolor washes',
  'Paper-cut storybook collage with soft atmospheric shadows and warm golden twilight light',
];

export function GenerationView({
  products,
  assets,
  generations,
  settings,
  activeProductId,
  onSelectProduct,
  onGenerateText,
  onGenerateIllustration,
}: GenerationViewProps) {
  const productId = activeProductId || products[0]?.id || '';
  const [mode, setMode] = useState<GenerationMode>('manuscript');
  const [provider, setProvider] = useState<GenerationProvider>('gemini');
  const [openRouterModel, setOpenRouterModel] = useState('openai/gpt-4o-mini');
  const [stylePreset, setStylePreset] = useState(STYLE_PRESETS[0]);
  const [assetKind, setAssetKind] = useState<StorageAsset['kind']>('illustration');
  const [saveToManuscript, setSaveToManuscript] = useState(true);
  const [prompt, setPrompt] = useState(
    'Write Spreads 3 and 4 for a calming bedtime picture book where Barnaby the bear and a red fox follow glowing fireflies to a willow tree harbor.'
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [copiedGenId, setCopiedGenId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setError('Create or select a product first.');
      return;
    }
    if (prompt.trim().length < 5) {
      setError('Enter a descriptive prompt of at least 5 characters.');
      return;
    }

    setError('');
    setRunning(true);
    try {
      if (mode === 'illustration') {
        await onGenerateIllustration({
          productId,
          prompt: prompt.trim(),
          stylePreset,
          provider,
          kind: assetKind,
        });
      } else {
        await onGenerateText({
          productId,
          prompt: prompt.trim(),
          mode,
          provider,
          saveToManuscript,
          openRouterModel,
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
              Server-side API routes keep provider keys off the browser.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="gen-product" className="block text-xs font-medium text-slate-700">
              Target Product
            </label>
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
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700">Output Mode</span>
            <div
              className="mt-1.5 grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1"
              role="group"
              aria-label="Generation output mode"
            >
              {(
                [
                  ['manuscript', 'Story Copy'],
                  ['kdp-metadata', 'KDP Metadata'],
                  ['illustration', 'Illustration'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    if (value === 'illustration') {
                      setPrompt(
                        'A warm woodland lantern bear and a red fox standing on mossy stepping stones beside a twilight river filled with floating origami paper boats.'
                      );
                    } else if (value === 'kdp-metadata') {
                      setPrompt(
                        'Write an engaging Amazon KDP book description, subtitle options, and 7 high-intent backend keyword phrases.'
                      );
                    }
                  }}
                  className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
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

          <div className="grid grid-cols-2 gap-3">
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
                <option value="gemini">Gemini 4 Hydrogen (Active)</option>
                <option value="openrouter">
                  OpenRouter {settings.openRouterConfigured ? '(Configured)' : '(Requires Env Key)'}
                </option>
              </select>
            </div>

            {provider === 'openrouter' ? (
              <div>
                <label htmlFor="or-model" className="block text-xs font-medium text-slate-700">
                  OpenRouter Model ID
                </label>
                <input
                  id="or-model"
                  type="text"
                  value={openRouterModel}
                  onChange={(e) => setOpenRouterModel(e.target.value)}
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

          {mode === 'illustration' && (
            <div>
              <label htmlFor="gen-style" className="block text-xs font-medium text-slate-700">
                Art Direction Preset
              </label>
              <select
                id="gen-style"
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-700 focus:outline-none"
              >
                {STYLE_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset.slice(0, 74)}…
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="gen-prompt" className="block text-xs font-medium text-slate-700">
              Prompt
            </label>
            <textarea
              id="gen-prompt"
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the book spread, illustration scene, or KDP listing goals…"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/15"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={running}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            {mode === 'illustration' ? (
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Wand2 className="h-4 w-4" aria-hidden="true" />
            )}
            {running
              ? 'Generating via server route…'
              : mode === 'illustration'
              ? 'Generate Illustration & Save to Folder'
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
              Run a manuscript, KDP metadata, or illustration prompt on the left.
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
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="h-44 w-44 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                        <AssetPreviewImage
                          src={linkedAsset.url}
                          alt={linkedAsset.caption || linkedAsset.name}
                          fallbackLabel={linkedAsset.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="text-xs text-slate-600">
                        <div className="font-mono font-medium text-slate-900">
                          {linkedAsset.name}
                        </div>
                        <p className="mt-1">Saved to product storage folder and ready for KDP PDF export.</p>
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
