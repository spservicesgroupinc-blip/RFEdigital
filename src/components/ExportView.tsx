import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CloudUpload,
  Download,
  ExternalLink,
  FileDown,
} from 'lucide-react';
import type {
  ExportArtifact,
  KdpTrimSize,
  Product,
  StorageAsset,
} from '../types/workspace';
import { calculateKdpDimensionsPt, formatBytes } from '../lib/workspaceLogic';
import { rasterizeSvgUrlToPng } from '../lib/api';
import { AssetPreviewImage } from './AssetPreviewImage';
import { ConfirmDialog } from './ConfirmDialog';

interface ExportViewProps {
  products: Product[];
  assets: StorageAsset[];
  exportsList: ExportArtifact[];
  activeProductId: string | null;
  googleConnected: boolean;
  onSelectProduct: (id: string) => void;
  onExportPdf: (payload: {
    productId: string;
    assetIds: string[];
    trimSize: KdpTrimSize;
    includeBleed: boolean;
    includeTitlePage: boolean;
    includeCaptions: boolean;
    rasterOverrides?: Record<string, string>;
  }) => Promise<ExportArtifact>;
  onExportBundle: (payload: {
    productId: string;
    assetIds: string[];
  }) => Promise<ExportArtifact>;
  onUploadArtifactToDrive: (artifactId: string) => Promise<void>;
}

export function ExportView({
  products,
  assets,
  exportsList,
  activeProductId,
  googleConnected,
  onSelectProduct,
  onExportPdf,
  onExportBundle,
  onUploadArtifactToDrive,
}: ExportViewProps) {
  const productId = activeProductId || products[0]?.id || '';
  const product = products.find((p) => p.id === productId) ?? null;

  const productAssets = useMemo(
    () =>
      assets
        .filter((a) => a.productId === productId)
        .sort((a, b) => a.pageOrder - b.pageOrder),
    [assets, productId]
  );

  const [trimSize, setTrimSize] = useState<KdpTrimSize>(product?.trimSize ?? '8.5x8.5');
  const [includeBleed, setIncludeBleed] = useState<boolean>(product?.includeBleed ?? true);
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeCaptions, setIncludeCaptions] = useState(true);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [buildingPdf, setBuildingPdf] = useState(false);
  const [buildingZip, setBuildingZip] = useState(false);
  const [error, setError] = useState('');
  const [latestArtifact, setLatestArtifact] = useState<ExportArtifact | null>(null);

  const [confirmDriveArtifact, setConfirmDriveArtifact] = useState<ExportArtifact | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);

  useEffect(() => {
    if (product) {
      setTrimSize(product.trimSize);
      setIncludeBleed(product.includeBleed);
    }
    setSelectedAssetIds(productAssets.map((a) => a.id));
  }, [product, productAssets]);

  const dims = useMemo(
    () => calculateKdpDimensionsPt(trimSize, includeBleed),
    [trimSize, includeBleed]
  );

  const toggleAsset = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBuildPdf = async () => {
    if (!product) return;
    setError('');
    setBuildingPdf(true);
    try {
      const chosenAssets = productAssets.filter((a) => selectedAssetIds.includes(a.id));
      const rasterOverrides: Record<string, string> = {};
      for (const asset of chosenAssets) {
        if (asset.mimeType === 'image/svg+xml' || asset.name.endsWith('.svg')) {
          const pngDataUrl = await rasterizeSvgUrlToPng(asset.url);
          if (pngDataUrl) rasterOverrides[asset.id] = pngDataUrl;
        }
      }

      const artifact = await onExportPdf({
        productId: product.id,
        assetIds: chosenAssets.map((a) => a.id),
        trimSize,
        includeBleed,
        includeTitlePage,
        includeCaptions,
        rasterOverrides,
      });
      setLatestArtifact(artifact);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF assembly failed.');
    } finally {
      setBuildingPdf(false);
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

  const confirmUploadToDrive = async () => {
    if (!confirmDriveArtifact) return;
    setDriveBusy(true);
    try {
      await onUploadArtifactToDrive(confirmDriveArtifact.id);
      setConfirmDriveArtifact(null);
    } finally {
      setDriveBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left KDP PDF & Bundle Composer */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 xl:col-span-6">
        <h2 className="text-base font-semibold text-slate-900">KDP Print-Ready Export Composer</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Assembles selected product artwork into exact KDP trim PDFs via <span className="font-mono">pdf-lib</span> or downloadable ZIP bundles.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="export-product" className="block text-xs font-medium text-slate-700">
              Product to Export
            </label>
            <select
              id="export-product"
              value={productId}
              onChange={(e) => onSelectProduct(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="export-trim" className="block text-xs font-medium text-slate-700">
                Trim Specification
              </label>
              <select
                id="export-trim"
                value={trimSize}
                onChange={(e) => setTrimSize(e.target.value as KdpTrimSize)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              >
                <option value="8.5x8.5">8.5 × 8.5 in (Picture Book)</option>
                <option value="6x9">6 × 9 in (Trade Paperback)</option>
                <option value="8.5x11">8.5 × 11 in (Coloring / Activity)</option>
                <option value="8x10">8 × 10 in (Art Print)</option>
              </select>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2">
              <div className="text-[11px] font-medium text-slate-500">Computed Page Canvas</div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {dims.finalWidthIn}&quot; × {dims.finalHeightIn}&quot;
              </div>
              <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                {dims.widthPt} × {dims.heightPt} pt
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-1 text-xs text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeBleed}
                onChange={(e) => setIncludeBleed(e.target.checked)}
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
              Generate Title Page
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeCaptions}
                onChange={(e) => setIncludeCaptions(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
              Typeset Page Captions
            </label>
          </div>

          {/* Asset Inclusion Checklist */}
          <div className="border-t border-slate-200 pt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">
                Included Pages ({selectedAssetIds.length} / {productAssets.length})
              </span>
              <span className="font-mono text-slate-500 tabular-nums">
                Total PDF pages:{' '}
                {selectedAssetIds.length + (includeTitlePage ? 1 : 0)}
              </span>
            </div>

            {productAssets.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                No images in this product folder yet. A clean title-page proof will be exported.
              </p>
            ) : (
              <div className="max-h-60 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200">
                {productAssets.map((asset) => {
                  const checked = selectedAssetIds.includes(asset.id);
                  return (
                    <label
                      key={asset.id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAsset(asset.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700"
                      />
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">
                        <AssetPreviewImage
                          src={asset.url}
                          alt={asset.name}
                          fallbackLabel={asset.name}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-slate-900">
                          {asset.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Page {asset.pageOrder} · {formatBytes(asset.sizeBytes)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {latestArtifact && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-xs">
              <div>
                <div className="font-semibold text-emerald-900">
                  Built {latestArtifact.fileName}
                </div>
                <div className="font-mono text-emerald-700 tabular-nums">
                  {latestArtifact.pageCount} pages · {formatBytes(latestArtifact.sizeBytes)}
                </div>
              </div>
              <a
                href={latestArtifact.downloadUrl}
                download={latestArtifact.fileName}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download
              </a>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={!product || buildingPdf}
              onClick={handleBuildPdf}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              {buildingPdf ? 'Assembling PDF…' : 'Build KDP PDF'}
            </button>
            <button
              type="button"
              disabled={!product || buildingZip}
              onClick={handleBuildZip}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Archive className="h-4 w-4 text-slate-500" aria-hidden="true" />
              {buildingZip ? 'Packaging ZIP…' : 'Package PNG Bundle (.zip)'}
            </button>
          </div>
        </div>
      </section>

      {/* Right Export History */}
      <section className="rounded-lg border border-slate-200 bg-white xl:col-span-6">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Export History{' '}
            <span className="ml-1 font-mono text-xs font-normal text-slate-500 tabular-nums">
              ({exportsList.length})
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Ready-to-upload KDP interior PDFs and storefront art archives.
          </p>
        </div>

        {exportsList.length === 0 ? (
          <div className="px-6 py-16 text-center text-xs text-slate-500">
            No exports generated yet. Click <span className="font-medium text-slate-800">Build KDP PDF</span> on the left to assemble your first print-ready manuscript.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {exportsList.map((exp) => {
              const linkedProduct = products.find((p) => p.id === exp.productId);
              return (
                <div
                  key={exp.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-semibold text-slate-900">
                      {exp.fileName}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span>{linkedProduct?.title ?? 'Product'}</span>
                      <span aria-hidden="true">·</span>
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
                    <a
                      href={exp.downloadUrl}
                      download={exp.fileName}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </a>
                    {exp.driveWebLink ? (
                      <a
                        href={exp.driveWebLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 whitespace-nowrap shrink-0"
                      >
                        Drive
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled={!googleConnected}
                        onClick={() => setConfirmDriveArtifact(exp)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
                      >
                        <CloudUpload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        Save to Drive
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmDriveArtifact)}
        title={`Upload "${confirmDriveArtifact?.fileName ?? ''}" to Google Drive?`}
        description="FolioPress will store this exported file inside your product's Google Drive folder."
        confirmLabel="Upload to Drive"
        tone="primary"
        busy={driveBusy}
        onConfirm={confirmUploadToDrive}
        onCancel={() => setConfirmDriveArtifact(null)}
      />
    </div>
  );
}
