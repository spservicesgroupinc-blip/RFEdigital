import type {
  ApiTokenRecord,
  BatchPlan,
  ExportArtifact,
  GenerationMode,
  GenerationProvider,
  GenerationRecord,
  JobItem,
  KdpTrimSize,
  Product,
  ProductCategory,
  ProductStatus,
  Series,
  StorageAsset,
  TrendDeepDive,
  TrendMarketplace,
  TrendOpportunity,
  TrendProductType,
  TrendScanResult,
  TrendTimeHorizon,
  WorkspaceSettings,
  WorkspaceSnapshot,
} from '../types/workspace';
import type { JobAction } from './workspaceLogic';

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const workspaceApi = {
  getWorkspace: () => requestJson<WorkspaceSnapshot>('/api/workspace'),

  // Library
  createSeries: (payload: {
    name: string;
    description: string;
    targetAge: string;
    marketplace: Series['marketplace'];
  }) =>
    requestJson<{ series: Series }>('/api/library/series', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createProduct: (payload: {
    title: string;
    subtitle: string;
    category: ProductCategory;
    status: ProductStatus;
    trimSize: KdpTrimSize;
    pageCount: number;
    includeBleed: boolean;
    seriesId: string | null;
    isbn: string;
    manuscriptNotes: string;
    referencePhoto?: {
      name: string;
      mimeType: string;
      dataUrl: string;
    };
  }) =>
    requestJson<{ product: Product; referenceAsset?: StorageAsset | null }>('/api/library/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProduct: (id: string, payload: Partial<Product>) =>
    requestJson<{ product: Product }>(`/api/library/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  deleteProduct: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/library/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Storage
  uploadAsset: (payload: {
    productId: string;
    name: string;
    mimeType: string;
    dataUrl: string;
    kind: StorageAsset['kind'];
    caption: string;
  }) =>
    requestJson<{ asset: StorageAsset }>('/api/storage/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteAsset: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/storage/assets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Generation
  generateText: (payload: {
    productId: string;
    prompt: string;
    mode: GenerationMode;
    provider: GenerationProvider;
    saveToManuscript: boolean;
    openRouterModel?: string;
  }) =>
    requestJson<{ record: GenerationRecord; product: Product }>('/api/generate/text', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateIllustration: (payload: {
    productId: string;
    prompt: string;
    stylePreset: string;
    provider: GenerationProvider;
    kind: StorageAsset['kind'];
    openRouterModel?: string;
    referenceImageDataUrl?: string;
    referenceAssetId?: string;
    saveReferenceToProduct?: boolean;
    referenceFileName?: string;
  }) =>
    requestJson<{ record: GenerationRecord; asset: StorageAsset; product?: Product }>(
      '/api/generate/illustration',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  generateOutline: (payload: {
    productId?: string;
    productTitle?: string;
    category?: ProductCategory;
    brief: string;
    stepCount: number;
  }) =>
    requestJson<{
      steps: Array<{ title: string; stepType: 'manuscript' | 'illustration' | 'export'; prompt: string }>;
      model: string;
    }>('/api/generate/outline', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Planning
  createPlan: (payload: {
    productId: string;
    name: string;
    templateId: string;
    steps: Array<{ title: string; stepType: 'manuscript' | 'illustration' | 'export'; prompt: string }>;
  }) =>
    requestJson<{ plan: BatchPlan }>('/api/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  queuePlan: (planId: string, provider: GenerationProvider = 'gemini') =>
    requestJson<{ jobs: JobItem[]; plan: BatchPlan }>(
      `/api/plans/${encodeURIComponent(planId)}/queue`,
      {
        method: 'POST',
        body: JSON.stringify({ provider }),
      }
    ),

  deletePlan: (planId: string) =>
    requestJson<{ ok: boolean }>(`/api/plans/${encodeURIComponent(planId)}`, {
      method: 'DELETE',
    }),

  // Jobs
  listJobs: () => requestJson<{ jobs: JobItem[] }>('/api/jobs'),

  runNextJob: (jobId?: string) =>
    requestJson<{ processed: boolean; job?: JobItem; message?: string }>('/api/jobs/run-next', {
      method: 'POST',
      body: JSON.stringify(jobId ? { jobId } : {}),
    }),

  jobAction: (jobId: string, action: JobAction) =>
    requestJson<{ job: JobItem }>(`/api/jobs/${encodeURIComponent(jobId)}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  // Export
  exportPdf: (payload: {
    productId: string;
    assetIds: string[];
    trimSize: KdpTrimSize;
    includeBleed: boolean;
    includeTitlePage: boolean;
    includeCaptions: boolean;
    rasterOverrides?: Record<string, string>;
  }) =>
    requestJson<{ artifact: ExportArtifact }>('/api/export/pdf', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  exportBundle: (payload: { productId: string; assetIds: string[] }) =>
    requestJson<{ artifact: ExportArtifact }>('/api/export/bundle', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Identity
  createToken: (payload: { name: string; scope: ApiTokenRecord['scope'] }) =>
    requestJson<{ record: ApiTokenRecord; plainTextToken: string }>('/api/identity/tokens', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  revokeToken: (id: string) =>
    requestJson<{ ok: boolean }>(`/api/identity/tokens/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  updateSettings: (payload: Partial<WorkspaceSettings>) =>
    requestJson<{ settings: WorkspaceSettings }>('/api/identity/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  // Google Workspace live APIs (Bearer OAuth token from in-memory session)
  bootstrapGoogleSheet: (accessToken: string) =>
    requestJson<{ spreadsheetId: string; spreadsheetUrl: string }>('/api/google/sheets/bootstrap', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({}),
    }),

  syncGoogleSheet: (accessToken: string, spreadsheetId?: string) =>
    requestJson<{ syncedAt: string; rowsWritten: number; spreadsheetUrl: string }>(
      '/api/google/sheets/sync',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(spreadsheetId ? { spreadsheetId } : {}),
      }
    ),

  uploadToGoogleDrive: (
    accessToken: string,
    payload: { artifactId?: string; assetId?: string }
  ) =>
    requestJson<{ driveFileId: string; driveWebLink: string }>('/api/google/drive/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    }),

  // Google Apps Script Web App Bridge (server reads APPS_SCRIPT_WEBAPP_URL from Secrets)
  getCodeGs: () => requestJson<{ filename: string; source: string }>('/api/bridge/code-gs'),

  getBridgeStatus: () =>
    requestJson<{
      ok: boolean;
      setup?: {
        spreadsheetId?: string;
        spreadsheetUrl?: string;
        driveRootId?: string;
        driveRootUrl?: string;
        initializedAt?: string;
        triggerInstalled?: boolean;
      };
      counts?: { products: number; series: number; assets: number; jobs: number };
    }>('/api/bridge/status'),

  runBridgeSetup: () =>
    requestJson<{
      ok: boolean;
      spreadsheetId?: string;
      spreadsheetUrl?: string;
      driveRootId?: string;
      driveRootUrl?: string;
      triggerInstalled?: boolean;
    }>('/api/bridge/setup', { method: 'POST', body: JSON.stringify({}) }),

  syncViaBridge: () =>
    requestJson<{
      syncedAt: string;
      rowsWritten: Record<string, number>;
      spreadsheetUrl?: string;
    }>('/api/bridge/sync', { method: 'POST', body: JSON.stringify({}) }),

  // Current Trends Research (Live Web Search)
  runTrendsScan: (payload: {
    marketplaces: TrendMarketplace[];
    productTypes: TrendProductType[];
    timeHorizon: TrendTimeHorizon;
    customTopic: string;
    provider: GenerationProvider;
    openRouterModel?: string;
  }) =>
    requestJson<{
      scan: TrendScanResult;
      researched_at: string;
      market_summary: string;
      opportunities: TrendOpportunity[];
    }>('/api/ai/trends', {
      method: 'POST',
      body: JSON.stringify({ mode: 'scan', ...payload }),
    }),

  runTrendDeepDive: (payload: {
    scanId: string;
    opportunityId: string;
    opportunity: TrendOpportunity;
    provider: GenerationProvider;
    openRouterModel?: string;
  }) =>
    requestJson<{ deepDive: TrendDeepDive }>('/api/ai/trends', {
      method: 'POST',
      body: JSON.stringify({ mode: 'deep_dive', ...payload }),
    }),

  deleteTrendScan: (scanId: string) =>
    requestJson<{ ok: boolean }>(`/api/ai/trends/${encodeURIComponent(scanId)}`, {
      method: 'DELETE',
    }),

  createProjectFromTrend: (payload: {
    scanId: string;
    opportunityId: string;
    opportunity: TrendOpportunity;
    deepDive?: TrendDeepDive;
  }) =>
    requestJson<{ product: Product; plan: BatchPlan }>('/api/ai/trends/create-project', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

/**
 * Rasterizes an SVG asset URL to a 1200x1200 PNG data URL in the browser
 * so pdf-lib can embed vector illustrations crisply into print-ready KDP PDFs.
 */
export async function rasterizeSvgUrlToPng(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
