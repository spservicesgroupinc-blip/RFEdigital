import { useState } from 'react';
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  CloudUpload,
  Download,
  ExternalLink,
  Eye,
  FileDown,
  Loader2,
} from 'lucide-react';
import type { ExportArtifact, KdpTrimSize, PageTextLayout, Product, StorageAsset } from '../../types/workspace';
import { formatBytes } from '../../lib/workspaceLogic';
import type { KdpPageDimensions } from '../../lib/workspaceLogic';
import { AssetPreviewImage } from '../AssetPreviewImage';
import { PAGE_LAYOUT_OPTIONS } from '../StudioShared';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Select } from '../ui/Select';

interface ExportPanelProps {
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

export function ExportPanel({
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
}: ExportPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <section className="xl:col-span-7">
        <Card>
          <CardHeader>
            <CardTitle>Download Your Finished Product</CardTitle>
            <CardDescription>
              Compile your cover and interior pages into a print-ready Amazon KDP PDF or a downloadable PNG bundle for Etsy and Gumroad.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button
              variant="outline"
              size="md"
              leadingIcon={
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              }
              onClick={() => setShowAdvanced((v) => !v)}
            >
              Advanced export options
            </Button>

            {showAdvanced && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="builder-export-trim" className="block text-xs font-medium text-text-secondary">
                      KDP Trim Specification
                    </label>
                    <Select
                      id="builder-export-trim"
                      value={exportTrim}
                      onChange={(e) => setExportTrim(e.target.value as KdpTrimSize)}
                      className="mt-1 font-mono"
                    >
                      <option value="8.5x8.5">8.5 × 8.5 in (Picture Book)</option>
                      <option value="8.5x11">8.5 × 11 in (Coloring / Activity)</option>
                      <option value="6x9">6 × 9 in (Trade Paperback)</option>
                      <option value="8x10">8 × 10 in (Art Print)</option>
                    </Select>
                  </div>

                  <div className="rounded-md border border-border bg-surface-secondary px-3.5 py-2">
                    <div className="text-[11px] font-medium text-text-muted">Print Canvas Size</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-text tabular-nums">
                      {dims.finalWidthIn}&quot; × {dims.finalHeightIn}&quot;
                    </div>
                    <div className="font-mono text-[11px] text-text-muted tabular-nums">
                      {dims.widthPt} × {dims.heightPt} pt
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="builder-export-layout" className="block text-xs font-medium text-text-secondary">
                    Illustrated Book Text Placement
                  </label>
                  <Select
                    id="builder-export-layout"
                    value={pageLayout}
                    onChange={(e) => setPageLayout(e.target.value as PageTextLayout)}
                    className="mt-1"
                  >
                    {PAGE_LAYOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-[11px] text-text-muted">
                    Typesets each page&apos;s story text from the Story Pages &amp; Copy section (or auto-splits your manuscript) with clean storybook margins and typography.
                  </p>
                </div>

                <div className="flex flex-wrap gap-5 text-xs text-text-secondary">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={exportBleed}
                      onChange={(e) => setExportBleed(e.target.checked)}
                      className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary"
                    />
                    KDP Full Bleed
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeTitlePage}
                      onChange={(e) => setIncludeTitlePage(e.target.checked)}
                      className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary"
                    />
                    Include Title Page
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeCoverTitle}
                      onChange={(e) => setIncludeCoverTitle(e.target.checked)}
                      className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary"
                    />
                    Show Title on Cover
                  </label>
                </div>

                <div className="border-t border-border-subtle pt-4">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-text-secondary">
                      Pages Included ({selectedAssetIds.length} / {productAssets.length})
                    </span>
                    <span className="font-mono text-text-muted tabular-nums">
                      {pageLayout === 'facing-page'
                        ? 'Facing spreads enabled'
                        : `Total PDF pages: ${selectedAssetIds.length + (includeTitlePage ? 1 : 0)}`}
                    </span>
                  </div>

                  {productAssets.length === 0 ? (
                    <p className="rounded-md border border-border bg-surface-secondary p-3 text-xs text-text-muted">
                      No artwork pages yet — exporting now builds a clean title-page proof PDF, or generate pages first in the Generate tab.
                    </p>
                  ) : (
                    <div className="max-h-52 divide-y divide-border overflow-y-auto rounded-md border border-border">
                      {productAssets.map((asset) => {
                        const checked = selectedAssetIds.includes(asset.id);
                        return (
                          <label
                            key={asset.id}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-secondary"
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
                              className="h-4 w-4 rounded border-border-strong text-primary focus:ring-primary"
                            />
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded border border-border bg-surface-tertiary">
                              <AssetPreviewImage src={asset.url} alt={asset.name} fallbackLabel={asset.name} />
                            </div>
                            <div className="min-w-0 flex-1 text-xs">
                              <div className="truncate font-medium text-text">
                                {asset.kind === 'cover' ? 'Cover' : `Page ${asset.pageOrder}`} · {asset.name}
                              </div>
                              <div className="truncate text-[11px] text-text-muted">
                                {asset.storyText ? `"${asset.storyText}"` : `${formatBytes(asset.sizeBytes)}`}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {latestArtifact && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-success-200 bg-success-subtle px-4 py-3 text-xs">
                <div>
                  <div className="font-semibold text-success-900">
                    Finished file ready: {latestArtifact.fileName}
                  </div>
                  <div className="font-mono text-success-700 tabular-nums">
                    {latestArtifact.pageCount} pages · {formatBytes(latestArtifact.sizeBytes)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {latestArtifact.format === 'pdf' && (
                    <Button
                      variant="outline"
                      size="sm"
                      leadingIcon={<Eye className="h-3.5 w-3.5" />}
                      disabled={downloadingId === latestArtifact.id}
                      onClick={() => handlePreviewPdf(latestArtifact)}
                    >
                      Preview
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={downloadingId === latestArtifact.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    disabled={downloadingId === latestArtifact.id}
                    onClick={() => handleDownloadExport(latestArtifact)}
                  >
                    Download Now
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
              <Button variant="outline" size="md" leadingIcon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onBackToGenerate}>
                Back to Generate
              </Button>

              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant="outline"
                  size="md"
                  leadingIcon={<Archive className="h-4 w-4" />}
                  disabled={buildingZip}
                  onClick={handleBuildZip}
                >
                  {buildingZip ? 'Packaging ZIP…' : 'Download PNG Bundle'}
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  leadingIcon={buildingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  disabled={buildingPdf}
                  onClick={handleBuildPdf}
                >
                  {buildingPdf ? 'Building PDF…' : 'Download PDF'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="xl:col-span-5">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>
              Finished Downloads{' '}
              <span className="ml-1 font-mono text-xs font-normal text-text-muted tabular-nums">
                ({productExports.length})
              </span>
            </CardTitle>
            <CardDescription>Exported PDFs and ZIP archives for {product.title}.</CardDescription>
          </CardHeader>

          {productExports.length === 0 ? (
            <EmptyState
              icon={<Download className="h-10 w-10" />}
              title="No exports yet"
              description={`Click Download PDF on the left to create your first export for ${product.title}.`}
            />
          ) : (
            <div className="divide-y divide-border">
              {productExports.map((exp) => (
                <div
                  key={exp.id}
                  className="flex flex-col gap-2.5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-semibold text-text">{exp.fileName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                      <Badge variant="default" size="sm">{exp.format === 'pdf' ? 'PDF' : 'ZIP'}</Badge>
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
                      <Button
                        variant="outline"
                        size="sm"
                        leadingIcon={<Eye className="h-3.5 w-3.5" />}
                        disabled={downloadingId === exp.id}
                        onClick={() => handlePreviewPdf(exp)}
                      >
                        Preview
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      leadingIcon={downloadingId === exp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      disabled={downloadingId === exp.id}
                      onClick={() => handleDownloadExport(exp)}
                    >
                      Download
                    </Button>
                    {exp.driveWebLink ? (
                      <a
                        href={exp.driveWebLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-success-200 bg-success-subtle px-2.5 py-1.5 text-xs font-medium text-success-700"
                      >
                        Drive
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : googleConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        leadingIcon={<CloudUpload className="h-3.5 w-3.5" />}
                        disabled={driveUploadingId === exp.id}
                        onClick={async () => {
                          setDriveUploadingId(exp.id);
                          try {
                            await onUploadArtifactToDrive(exp.id);
                          } finally {
                            setDriveUploadingId(null);
                          }
                        }}
                      >
                        {driveUploadingId === exp.id ? 'Saving…' : 'Drive'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
