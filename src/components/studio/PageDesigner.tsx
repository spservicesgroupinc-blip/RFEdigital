import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Download,
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type { PageTextLayout, Product, StorageAsset } from '../../types/workspace';
import { AssetPreviewImage } from '../AssetPreviewImage';
import { PAGE_LAYOUT_OPTIONS } from '../StudioShared';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

interface PageDesignerProps {
  product: Product;
  productAssets: StorageAsset[];
  pageDrafts: Record<string, { storyText: string; textPlacement: PageTextLayout | '' }>;
  setPageDrafts: React.Dispatch<
    React.SetStateAction<Record<string, { storyText: string; textPlacement: PageTextLayout | '' }>>
  >;
  pageLayout: PageTextLayout;
  setPageLayout: React.Dispatch<React.SetStateAction<PageTextLayout>>;
  includeCoverTitle: boolean;
  setIncludeCoverTitle: React.Dispatch<React.SetStateAction<boolean>>;
  autoFillingPages: boolean;
  savingAssetId: string | null;
  regeneratingAssetId: string | null;
  runningKey: string | null;
  pageUploadInputRef: React.RefObject<HTMLInputElement | null>;
  handleAutoFillPagesFromManuscript: () => Promise<void>;
  handleDirectPageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMatchArtToPageText: (asset: StorageAsset, interiorIndex: number) => Promise<void>;
  handleSavePageDesign: (asset: StorageAsset) => Promise<void>;
  handleMovePage: (index: number, direction: -1 | 1) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
  onOpenPrompts: () => void;
}

export function PageDesigner({
  product,
  productAssets,
  pageDrafts,
  setPageDrafts,
  pageLayout,
  setPageLayout,
  includeCoverTitle,
  setIncludeCoverTitle,
  autoFillingPages,
  savingAssetId,
  regeneratingAssetId,
  runningKey,
  pageUploadInputRef,
  handleAutoFillPagesFromManuscript,
  handleDirectPageUpload,
  handleMatchArtToPageText,
  handleSavePageDesign,
  handleMovePage,
  onDeleteAsset,
  onOpenPrompts,
}: PageDesignerProps) {
  return (
    <Card>
      <CardHeader
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={pageUploadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleDirectPageUpload}
              className="hidden"
            />
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={autoFillingPages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
              disabled={autoFillingPages || productAssets.length === 0}
              onClick={handleAutoFillPagesFromManuscript}
            >
              Auto-Fill Story Text
            </Button>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Upload className="h-3.5 w-3.5" />}
              onClick={() => pageUploadInputRef.current?.click()}
            >
              Upload Page
            </Button>
          </div>
        }
      >
        <CardTitle>
          Story Pages &amp; Copy{' '}
          <span className="ml-1 font-mono text-xs font-normal text-text-muted tabular-nums">
            ({productAssets.length})
          </span>
        </CardTitle>
        <CardDescription>
          Preview and edit exact story text and placement on every page before compiling your KDP PDF.
        </CardDescription>
      </CardHeader>

      {productAssets.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-surface-secondary px-5 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="step3-default-layout" className="font-medium text-text-secondary">
              Book Text Placement:
            </label>
            <Select
              id="step3-default-layout"
              value={pageLayout}
              onChange={(e) => setPageLayout(e.target.value as PageTextLayout)}
              className="w-auto"
            >
              {PAGE_LAYOUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Sparkles className="h-3.5 w-3.5" />}
            onClick={onOpenPrompts}
            className="whitespace-nowrap"
          >
            Generate More Pages
          </Button>
        </div>
      )}

      <CardContent className="p-0">
        {productAssets.length === 0 ? (
          <EmptyState
            icon={<ImagePlus className="h-10 w-10" />}
            title="No artwork pages generated yet"
            description="Generate your cover and interior pages from the prompts above, or upload artwork files directly."
            action={{
              label: 'Back to Edit & Run Prompts',
              onClick: onOpenPrompts,
              icon: <ArrowLeft className="h-4 w-4" />,
            }}
          />
        ) : (
          <div className="divide-y divide-border">
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
                      <Badge variant="muted" size="sm">
                        {asset.kind === 'cover' ? 'COVER' : `PAGE ${idx + 1}`}
                      </Badge>
                      <span className="truncate font-medium text-text">{asset.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={idx === 0}
                        aria-label={`Move ${asset.name} up`}
                        onClick={() => handleMovePage(idx, -1)}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={idx === productAssets.length - 1}
                        aria-label={`Move ${asset.name} down`}
                        onClick={() => handleMovePage(idx, 1)}
                        className="h-7 w-7 p-0"
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <a
                        href={asset.url}
                        download={asset.name}
                        aria-label={`Download ${asset.name}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${asset.name}`}
                        onClick={() => onDeleteAsset(asset.id)}
                        className="h-7 w-7 p-0 text-text-muted hover:bg-danger-subtle hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                    <div className="sm:col-span-5">{renderPreview(asset, effectiveLayout, previewText, product, includeCoverTitle)}</div>

                    <div className="flex flex-col justify-between gap-2.5 sm:col-span-7">
                      {asset.kind === 'cover' ? (
                        <div className="space-y-2 text-xs text-text-secondary">
                          <p className="leading-relaxed">
                            Front cover artwork renders full-bleed with your book title and subtitle banner cleanly typeset at the top.
                          </p>
                          <label className="flex items-center gap-2 font-medium text-text">
                            <input
                              type="checkbox"
                              checked={includeCoverTitle}
                              onChange={(e) => setIncludeCoverTitle(e.target.checked)}
                              className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary"
                            />
                            Show title &amp; subtitle banner on cover
                          </label>
                        </div>
                      ) : (
                        <>
                          <div>
                            <label
                              htmlFor={`story-text-${asset.id}`}
                              className="block text-[11px] font-medium text-text-secondary"
                            >
                              Story Text Printed on This Page
                            </label>
                            <Textarea
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
                              className="mt-1"
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Select
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
                              className="w-auto"
                            >
                              <option value="">
                                Use Book Default ({PAGE_LAYOUT_OPTIONS.find((o) => o.value === pageLayout)?.short})
                              </option>
                              {PAGE_LAYOUT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.short}
                                </option>
                              ))}
                            </Select>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                leadingIcon={<Sparkles className="h-3 w-3" />}
                                disabled={!draft.storyText.trim() || regeneratingAssetId === asset.id || Boolean(runningKey)}
                                onClick={() => {
                                  const interiorIdx = Math.max(
                                    0,
                                    productAssets.filter((a) => a.kind !== 'cover').findIndex((a) => a.id === asset.id)
                                  );
                                  handleMatchArtToPageText(asset, interiorIdx);
                                }}
                              >
                                {regeneratingAssetId === asset.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                                    Matching Art…
                                  </>
                                ) : (
                                  'Match Art to Text'
                                )}
                              </Button>
                              <Button
                                variant={isDirty ? 'primary' : 'outline'}
                                size="sm"
                                leadingIcon={<Save className="h-3 w-3" />}
                                disabled={!isDirty || savingAssetId === asset.id}
                                onClick={() => handleSavePageDesign(asset)}
                              >
                                {savingAssetId === asset.id
                                  ? 'Saving…'
                                  : isDirty
                                    ? 'Save Page Text'
                                    : 'Saved'}
                              </Button>
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
      </CardContent>
    </Card>
  );
}

function renderPreview(
  asset: StorageAsset,
  effectiveLayout: PageTextLayout,
  previewText: string,
  product: Product,
  includeCoverTitle: boolean
) {
  if (asset.kind === 'cover') {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded border border-border bg-[#FAF6EE]">
        <AssetPreviewImage
          src={asset.url}
          alt={product.title}
          fallbackLabel="Cover"
          className="h-full w-full object-cover"
        />
        {includeCoverTitle && (
          <div className="absolute inset-x-3 top-3 rounded border border-amber-200/80 bg-[#FDFBF5]/92 px-2.5 py-2 text-center shadow-xs">
            <div className="font-serif text-xs font-bold leading-tight text-text">{product.title}</div>
            {product.subtitle && (
              <div className="mt-0.5 truncate font-serif text-[10px] italic text-text-secondary">
                {product.subtitle}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (effectiveLayout === 'facing-page') {
    return (
      <div className="grid aspect-[16/10] w-full grid-cols-2 overflow-hidden rounded border border-border bg-[#FDFBF6]">
        <div className="flex items-center justify-center border-r border-border-subtle p-2.5 text-center">
          <p className="line-clamp-5 font-serif text-[10px] leading-relaxed text-text-secondary">
            {previewText || 'Story text appears on this left facing page…'}
          </p>
        </div>
        <div className="h-full w-full overflow-hidden bg-surface-tertiary">
          <AssetPreviewImage
            src={asset.url}
            alt={asset.name}
            fallbackLabel="Art"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    );
  }

  if (effectiveLayout === 'below-image') {
    return (
      <div className="flex aspect-square w-full flex-col overflow-hidden rounded border border-border bg-[#FDFBF6]">
        <div className="h-[68%] w-full overflow-hidden bg-surface-tertiary">
          <AssetPreviewImage
            src={asset.url}
            alt={asset.name}
            fallbackLabel="Art"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-1 items-center justify-center border-t border-amber-100 px-2.5 py-1.5 text-center">
          <p className="line-clamp-3 font-serif text-[10px] leading-snug text-text-secondary">
            {previewText || 'Add story text to typeset cleanly below artwork…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded border border-border bg-surface-tertiary">
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
          <p className="line-clamp-3 font-serif text-[10px] leading-snug text-text">{previewText}</p>
        </div>
      )}
    </div>
  );
}
