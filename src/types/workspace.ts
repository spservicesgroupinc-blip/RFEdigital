export type ModuleId =
  | 'library'
  | 'storage'
  | 'generation'
  | 'planning'
  | 'jobs'
  | 'export'
  | 'identity';

export type ProductCategory = 'childrens-book' | 'coloring-book' | 'art-print' | 'journal';

export type ProductStatus = 'draft' | 'in-production' | 'ready-for-kdp' | 'published';

export type KdpTrimSize = '8.5x8.5' | '6x9' | '8.5x11' | '8x10';

export interface Series {
  id: string;
  name: string;
  description: string;
  targetAge: string;
  marketplace: 'Amazon KDP' | 'Etsy Digital' | 'IngramSpark';
  createdAt: string;
}

export interface Product {
  id: string;
  seriesId: string | null;
  title: string;
  subtitle: string;
  category: ProductCategory;
  status: ProductStatus;
  trimSize: KdpTrimSize;
  pageCount: number;
  includeBleed: boolean;
  isbn: string;
  coverAssetId: string | null;
  driveFolderId: string | null;
  sheetsRowSyncedAt: string | null;
  manuscriptNotes: string;
  updatedAt: string;
  createdAt: string;
}

export interface StorageFolder {
  id: string;
  productId: string | null;
  name: string;
  path: string;
  driveFolderId: string | null;
  createdAt: string;
}

export type AssetKind = 'cover' | 'illustration' | 'manuscript' | 'export';

export interface StorageAsset {
  id: string;
  folderId: string;
  productId: string;
  name: string;
  kind: AssetKind;
  mimeType: string;
  sizeBytes: number;
  url: string;
  caption: string;
  pageOrder: number;
  driveFileId: string | null;
  driveWebLink: string | null;
  createdAt: string;
}

export type GenerationProvider = 'gemini' | 'openrouter';
export type GenerationMode = 'manuscript' | 'illustration' | 'kdp-metadata';

export interface GenerationRecord {
  id: string;
  productId: string;
  mode: GenerationMode;
  provider: GenerationProvider;
  model: string;
  prompt: string;
  outputText?: string;
  assetId?: string;
  createdAt: string;
}

export interface PlanStep {
  id: string;
  order: number;
  title: string;
  stepType: 'manuscript' | 'illustration' | 'export';
  prompt: string;
  queued: boolean;
}

export interface BatchPlan {
  id: string;
  productId: string;
  seriesId: string | null;
  name: string;
  templateId: string;
  trimSize: KdpTrimSize;
  steps: PlanStep[];
  createdAt: string;
  updatedAt: string;
}

export interface PlanTemplate {
  id: string;
  name: string;
  category: ProductCategory;
  trimSize: KdpTrimSize;
  defaultPages: number;
  description: string;
  starterSteps: Array<{
    title: string;
    stepType: 'manuscript' | 'illustration' | 'export';
    prompt: string;
  }>;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'paused';

export interface JobItem {
  id: string;
  planId: string | null;
  productId: string;
  title: string;
  stepType: 'manuscript' | 'illustration' | 'export' | 'sheets-sync';
  prompt: string;
  provider: GenerationProvider;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  resultAssetId: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportArtifact {
  id: string;
  productId: string;
  format: 'pdf' | 'png-bundle';
  fileName: string;
  trimSize: KdpTrimSize;
  includeBleed: boolean;
  pageCount: number;
  sizeBytes: number;
  downloadUrl: string;
  driveFileId: string | null;
  driveWebLink: string | null;
  createdAt: string;
}

export interface ApiTokenRecord {
  id: string;
  name: string;
  prefix: string;
  scope: 'read-only' | 'read-write' | 'apps-script-trigger';
  createdAt: string;
  lastUsedAt: string | null;
}

export interface WorkspaceSettings {
  studioName: string;
  authorImprint: string;
  connectedSpreadsheetId: string;
  connectedSpreadsheetUrl: string;
  connectedDriveRootId: string;
  openRouterConfigured: boolean;
  geminiConfigured: boolean;
}

export interface WorkspaceSnapshot {
  settings: WorkspaceSettings;
  series: Series[];
  products: Product[];
  folders: StorageFolder[];
  assets: StorageAsset[];
  generations: GenerationRecord[];
  plans: BatchPlan[];
  jobs: JobItem[];
  exports: ExportArtifact[];
  tokens: ApiTokenRecord[];
}
