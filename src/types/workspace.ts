export type ModuleId =
  | 'library'
  | 'trends'
  | 'builder'
  | 'gallery'
  | 'storage'
  | 'generation'
  | 'planning'
  | 'jobs'
  | 'export'
  | 'identity';

export type TrendMarketplace =
  | 'Amazon KDP'
  | 'Etsy'
  | 'Teachers Pay Teachers'
  | 'Gumroad';

export type TrendProductType =
  | 'childrens-book'
  | 'coloring-book'
  | 'wall-art'
  | 'flashcards'
  | 'ebook-planner';

export type TrendTimeHorizon = 'selling_now' | 'upcoming_seasonal';

export interface TrendSourceLink {
  title: string;
  url: string;
}

export interface TrendSalesEvidence {
  observed_signals: string[];
  estimated_velocity: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface TrendStarterBlueprint {
  target_age_or_audience: string;
  suggested_trim_size: string;
  suggested_page_count: number;
  art_style_direction: string;
  hook_concept: string;
  seed_keywords: string[];
}

export interface TrendCompetingListing {
  title: string;
  marketplace: string;
  observed_price: string;
  observed_signal: string;
  url: string;
}

export interface TrendPriceLadder {
  entry_tier: string;
  mid_tier: string;
  premium_tier: string;
  recommended_price: string;
}

export interface TrendDeepDive {
  researched_at: string;
  provider: GenerationProvider;
  model: string;
  summary: string;
  top_competing_listings: TrendCompetingListing[];
  price_ladder: TrendPriceLadder;
  recurring_buyer_complaints: string[];
  high_intent_keywords: string[];
  differentiation_angle: string;
  sources: TrendSourceLink[];
}

export interface TrendOpportunity {
  id: string;
  title: string;
  product_type: TrendProductType;
  marketplaces: string[];
  opportunity_score: number;
  demand_level: 'High' | 'Medium' | 'Emerging';
  competition_level: 'Low' | 'Medium' | 'High';
  price_range_usd: string;
  sales_evidence: TrendSalesEvidence;
  seasonality: string;
  buyer_pain_points: string[];
  winning_angle: string;
  starter_blueprint: TrendStarterBlueprint;
  sources: TrendSourceLink[];
  deep_dive?: TrendDeepDive;
  created_project_id?: string | null;
}

export interface TrendScanQuery {
  marketplaces: TrendMarketplace[];
  productTypes: TrendProductType[];
  timeHorizon: TrendTimeHorizon;
  customTopic: string;
  provider: GenerationProvider;
}

export interface TrendScanResult {
  id: string;
  researched_at: string;
  provider: GenerationProvider;
  model: string;
  query: TrendScanQuery;
  market_summary: string;
  opportunities: TrendOpportunity[];
}

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

export interface ParsedStorySpread {
  pageNumber: number;
  title: string;
  storyText: string;
  visualNote: string;
}

export interface InteriorPromptItem {
  id: string;
  title: string;
  prompt: string;
  storyText?: string;
  generatedAssetId?: string | null;
}

export interface ProductPromptPack {
  sourceTrendTitle?: string;
  targetAudience: string;
  conceptSummary: string;
  artStylePreset: string;
  manuscriptPrompt: string;
  kdpMetadataPrompt: string;
  coverPrompt: string;
  interiorPrompts: InteriorPromptItem[];
  updatedAt: string;
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
  referenceAssetId?: string | null;
  driveFolderId: string | null;
  sheetsRowSyncedAt: string | null;
  manuscriptNotes: string;
  promptPack?: ProductPromptPack | null;
  updatedAt: string;
  createdAt: string;
}

export interface PromptPrefillRequest {
  productId: string;
  mode: GenerationMode;
  prompt: string;
  stylePreset?: string;
  assetKind?: AssetKind;
  galleryImageId?: string;
  label?: string;
  nonce: number;
}

export interface StorageFolder {
  id: string;
  productId: string | null;
  name: string;
  path: string;
  driveFolderId: string | null;
  createdAt: string;
}

export type AssetKind = 'cover' | 'illustration' | 'manuscript' | 'export' | 'reference';

export type PageTextLayout =
  | 'below-image'
  | 'overlay-bottom'
  | 'overlay-top'
  | 'facing-page'
  | 'none';

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
  storyText?: string;
  textPlacement?: PageTextLayout;
  pageOrder: number;
  driveFileId: string | null;
  driveWebLink: string | null;
  createdAt: string;
}

export interface GalleryImage {
  id: string;
  name: string;
  label: string;
  tags: string[];
  mimeType: string;
  sizeBytes: number;
  url: string;
  driveFileId: string | null;
  driveWebLink: string | null;
  driveDownloadUrl: string | null;
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
  appsScriptConfigured: boolean;
  appsScriptLastSyncAt: string | null;
}

export interface WorkspaceSnapshot {
  settings: WorkspaceSettings;
  series: Series[];
  products: Product[];
  folders: StorageFolder[];
  assets: StorageAsset[];
  galleryImages: GalleryImage[];
  generations: GenerationRecord[];
  plans: BatchPlan[];
  jobs: JobItem[];
  exports: ExportArtifact[];
  tokens: ApiTokenRecord[];
  trendScans: TrendScanResult[];
}
