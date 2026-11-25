import {
  Archive,
  ArrowLeft,
  CloudUpload,
  Download,
  ExternalLink,
  Eye,
  FileDown,
  Loader2,
} from 'lucide-react';
import type {
  ExportArtifact,
  KdpTrimSize,
  PageTextLayout,
  Product,
  StorageAsset,
} from '../types/workspace';
import { formatBytes } from '../lib/workspaceLogic';
import type { KdpPageDimensions } from '../lib/workspaceLogic';
import { AssetPreviewImage } from './AssetPreviewImage';
import { PAGE_LAYOUT_OPTIONS } from './StudioShared';

interface StudioDownloadPanelProps {
  product: Product;
  exportTrim: KdpTrimSize;
  setExportTrim: React.Dispatch<React.SetStateAction<KdpTrimSize>>;
  dims: KdpPageDimensions;
  exportBleed: boolean;
  setExportBleed: React.Dispatch<React.SetStateAction<boolean>>;
  includeTitlePage: boolean;
  setIncludeTitlePage: React.Dispatch<React.SetStateAction<boolean>>;
  includeCoverTitle: boolean;
  setIncludeCoverTitle: React.Dispatch<React.SetStateAction<boolean>>;
  pageLayout: PageTextLayout;
  setPageLayout: React.Dispatch<React.SetStateAction<PageTextLayout>>;
  selectedAssetIds: string[];
  setSelectedAssetIds: React.Dispatch<React.SetStateAction<string[]>>;
  productAssets: StorageAsset[];
  latestArtifact: ExportArtifact | null;
  downloadingId: string | null;
  buildingPdf: boolean;
  buildingZip: boolean;
  driveUploadingId: string | null;
  setDriveUploadingId: React.Dispatch<React.SetStateAction<string | null>>;
  productExports: ExportArtifact[];
  googleConnected: boolean;
  handleBuildPdf: () => Promise<void>;
  handleBuildZip: () => Promise<void>;
  handleDownloadExport: (exp: ExportArtifact) => Promise<void>;
  handlePreviewPdf: (exp: ExportArtifact) => Promise<void>;
  onUploadArtifactToDrive: (artifactId: string) => Promise<void>;
  onBackToGenerate: () => void;
}

/** Tab 3 - Download: KDP PDF / PNG bundle export and finished downloads list. */
export function StudioDownloadPanel({
  product,
  exportTrim,
  setExportTrim,
  dims,
  exportBleed,
  setExportBleed,
  includeTitlePage,
  setIncludeTitlePage,
  includeCoverTitle,
  setIncludeCoverTitle,
  pageLayout,
  setPageLayout,
  selectedAssetIds,
  setSelectedAssetIds,
  productAssets,
  latestArtifact,
  downloadingId,
  buildingPdf,
  buildingZip,
  driveUploadingId,
  setDriveUploadingId,
  productExports,
  googleConnected,
  handleBuildPdf,
  handleBuildZip,
  handleDownloadExport,
  handlePreviewPdf,
  onUploadArtifactToDrive,
  onBackToGenerate,
}: StudioDownloadPanelProps) {
  return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6 xl:col-span-7">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-base font-semibold text-slate-900">
                Download Your Finished Product
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
                  Typesets each page&apos;s story text from the Story Pages &amp; Copy section (or auto-splits your manuscript) with clean storybook margins and typography.
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
                    No artwork pages yet — exporting now builds a clean title-page proof PDF, or generate pages first in the Generate tab.
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
                  onClick={onBackToGenerate}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back to Generate
                </button>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={buildingZip}
                    onClick={handleBuildZip}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-55 whitespace-nowrap"
                  >
                    <Archive className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    {buildingZip ? 'Packaging ZIP…' : 'Download PNG Bundle'}
                  </button>
                  <button
                    type="button"
                    disabled={buildingPdf}
                    onClick={handleBuildPdf}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap"
                  >
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    {buildingPdf ? 'Building PDF…' : 'Download PDF'}
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
                <span className="font-medium text-slate-800">Download PDF</span> on the left.
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
  );
}
