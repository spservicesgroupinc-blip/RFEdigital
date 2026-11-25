import type {
  BatchPlan,
  ExportArtifact,
  GenerationRecord,
  InteriorPromptItem,
  JobItem,
  JobStatus,
  KdpTrimSize,
  PlanTemplate,
  Product,
  ProductCategory,
  ProductPromptPack,
  ProductStatus,
  StorageAsset,
  TrendDeepDive,
  TrendOpportunity,
  TrendProductType,
  TrendSourceLink,
} from '../types/workspace.js';

export interface KdpPageDimensions {
  trimWidthIn: number;
  trimHeightIn: number;
  finalWidthIn: number;
  finalHeightIn: number;
  widthPt: number;
  heightPt: number;
  marginPt: number;
}

const TRIM_DIMENSIONS_IN: Record<KdpTrimSize, { w: number; h: number }> = {
  '8.5x8.5': { w: 8.5, h: 8.5 },
  '6x9': { w: 6.0, h: 9.0 },
  '8.5x11': { w: 8.5, h: 11.0 },
  '8x10': { w: 8.0, h: 10.0 },
};

/**
 * Calculates Amazon KDP page geometry in inches and PostScript points (72 pt/in).
 * Standard KDP full-bleed adds 0.125" to outside width and 0.25" to height (top + bottom).
 */
export function calculateKdpDimensionsPt(
  trimSize: KdpTrimSize,
  includeBleed: boolean
): KdpPageDimensions {
  const base = TRIM_DIMENSIONS_IN[trimSize] ?? TRIM_DIMENSIONS_IN['8.5x8.5'];
  const finalWidthIn = includeBleed ? Number((base.w + 0.125).toFixed(3)) : base.w;
  const finalHeightIn = includeBleed ? Number((base.h + 0.25).toFixed(3)) : base.h;
  const widthPt = Math.round(finalWidthIn * 72);
  const heightPt = Math.round(finalHeightIn * 72);
  const marginPt = includeBleed ? 36 : 45;

  return {
    trimWidthIn: base.w,
    trimHeightIn: base.h,
    finalWidthIn,
    finalHeightIn,
    widthPt,
    heightPt,
    marginPt,
  };
}

/**
 * Normalizes a product or folder title into a safe Drive/filesystem slug.
 */
export function sanitizeFolderSlug(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || 'untitled-product';
}

/**
 * Filters products by live search query, category, and production status.
 */
export function filterProducts(
  products: Product[],
  query: string,
  category: ProductCategory | 'all',
  status: ProductStatus | 'all'
): Product[] {
  const needle = query.trim().toLowerCase();
  return products.filter((p) => {
    if (category !== 'all' && p.category !== category) return false;
    if (status !== 'all' && p.status !== status) return false;
    if (!needle) return true;
    return (
      p.title.toLowerCase().includes(needle) ||
      p.subtitle.toLowerCase().includes(needle) ||
      p.isbn.toLowerCase().includes(needle)
    );
  });
}

export interface ProductValidationInput {
  title: string;
  pageCount: number;
  category: ProductCategory;
  trimSize: KdpTrimSize;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateProductInput(input: ProductValidationInput): ValidationResult {
  const errors: Record<string, string> = {};
  const trimmedTitle = input.title.trim();

  if (!trimmedTitle) {
    errors.title = 'Product title is required.';
  } else if (trimmedTitle.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  } else if (trimmedTitle.length > 120) {
    errors.title = 'Title cannot exceed 120 characters.';
  }

  if (!Number.isFinite(input.pageCount) || input.pageCount < 1 || input.pageCount > 828) {
    errors.pageCount = 'KDP page count must be between 1 and 828.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateTokenName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, errors: { name: 'Token label is required.' } };
  }
  if (trimmed.length < 3 || trimmed.length > 60) {
    return {
      valid: false,
      errors: { name: 'Token label must be between 3 and 60 characters.' },
    };
  }
  return { valid: true, errors: {} };
}

/**
 * Expands unqueued steps in a batch generation plan into job payloads ready for the queue.
 */
export function expandPlanToJobs(
  plan: BatchPlan,
  productTitle: string,
  provider: 'gemini' | 'openrouter' = 'gemini'
): Array<Omit<JobItem, 'id' | 'createdAt' | 'updatedAt'>> {
  return plan.steps
    .filter((step) => !step.queued)
    .sort((a, b) => a.order - b.order)
    .map((step) => ({
      planId: plan.id,
      productId: plan.productId,
      title: `${productTitle} — ${step.title}`,
      stepType: step.stepType,
      prompt: step.prompt,
      provider,
      status: 'queued' as JobStatus,
      attempts: 0,
      maxAttempts: 3,
      resultAssetId: null,
      resultSummary: null,
      errorMessage: null,
    }));
}

export type JobAction = 'pause' | 'resume' | 'retry' | 'cancel';

/**
 * Pure job state-machine transition helper enforcing valid queue transitions.
 */
export function transitionJobStatus(
  job: JobItem,
  action: JobAction
): { ok: true; nextStatus: JobStatus; resetError: boolean } | { ok: false; reason: string } {
  switch (action) {
    case 'pause':
      if (job.status !== 'queued') {
        return { ok: false, reason: 'Only queued jobs can be paused.' };
      }
      return { ok: true, nextStatus: 'paused', resetError: false };
    case 'resume':
      if (job.status !== 'paused') {
        return { ok: false, reason: 'Only paused jobs can be resumed.' };
      }
      return { ok: true, nextStatus: 'queued', resetError: false };
    case 'retry':
      if (job.status !== 'failed') {
        return { ok: false, reason: 'Only failed jobs can be retried.' };
      }
      if (job.attempts >= job.maxAttempts) {
        return { ok: false, reason: 'Maximum retry attempts reached.' };
      }
      return { ok: true, nextStatus: 'queued', resetError: true };
    case 'cancel':
      if (job.status === 'completed') {
        return { ok: false, reason: 'Completed jobs cannot be cancelled.' };
      }
      return { ok: true, nextStatus: 'failed', resetError: false };
    default:
      return { ok: false, reason: 'Unsupported job action.' };
  }
}

/**
 * Picks the next runnable job in FIFO order (matching Apps Script time-driven single-step ticks).
 */
export function getNextRunnableJob(jobs: JobItem[]): JobItem | null {
  const queued = jobs
    .filter((j) => j.status === 'queued')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return queued[0] ?? null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'tpl-picture-book-24',
    name: 'Children’s Picture Book (24 Pages, 8.5×8.5")',
    category: 'childrens-book',
    trimSize: '8.5x8.5',
    defaultPages: 24,
    description:
      'Classic KDP square picture book workflow: story arc, key double-page watercolor spreads, and print-ready PDF assembly.',
    starterSteps: [
      {
        title: 'Story Manuscript & Page Breaks',
        stepType: 'manuscript',
        prompt:
          'Write a gentle 8-spread children’s picture book manuscript (ages 4-7) with rhythmic read-aloud cadence and clear visual cues per spread.',
      },
      {
        title: 'Spread 1 — Opening Forest Scene',
        stepType: 'illustration',
        prompt:
          'Warm storybook illustration of the opening twilight pine forest path with a brass lantern, soft gouache color palette, centered focal subject.',
      },
      {
        title: 'Spread 2 — River Crossing Adventure',
        stepType: 'illustration',
        prompt:
          'Storybook illustration of two woodland friends crossing mossy stepping stones over a starlit brook with floating paper lanterns.',
      },
      {
        title: 'KDP Print-Ready Interior PDF',
        stepType: 'export',
        prompt: 'Assemble ordered book assets into an 8.5×8.5 in full-bleed KDP interior PDF.',
      },
    ],
  },
  {
    id: 'tpl-coloring-book-30',
    name: 'Botanical & Cottage Coloring Book (8.5×11")',
    category: 'coloring-book',
    trimSize: '8.5x11',
    defaultPages: 30,
    description:
      'Single-sided KDP coloring interior with bold black line art illustrations and crisp white margins.',
    starterSteps: [
      {
        title: 'KDP Subtitle, Blurb & 7 Backend Keywords',
        stepType: 'manuscript',
        prompt:
          'Draft a compelling Amazon KDP book description, subtitle, and 7 high-intent backend keywords for a cozy meadow cottage coloring book.',
      },
      {
        title: 'Plate 01 — Meadow Cottage Line Art',
        stepType: 'illustration',
        prompt:
          'Clean high-contrast black ink line art coloring page of a storybook thatched cottage, wildflowers, and garden gate on pure white background.',
      },
      {
        title: 'Plate 02 — Conservatory Greenhouse Line Art',
        stepType: 'illustration',
        prompt:
          'Clean black ink line art coloring page of a Victorian glass greenhouse filled with ferns, hanging planters, and botanical jars.',
      },
      {
        title: 'KDP 8.5×11" Print PDF Bundle',
        stepType: 'export',
        prompt: 'Compile coloring plates into an 8.5×11 in KDP manuscript PDF.',
      },
    ],
  },
  {
    id: 'tpl-wall-art-pack',
    name: 'Printable Fine Art Pack (8×10" Bundle)',
    category: 'art-print',
    trimSize: '8x10',
    defaultPages: 12,
    description:
      'Multi-print Etsy & digital storefront wall art collection with matching archival botanical compositions.',
    starterSteps: [
      {
        title: 'Listing Copy & Print Care Sheet',
        stepType: 'manuscript',
        prompt:
          'Write storefront listing copy and a printable home-printing guide covering paper weights and 8x10 framing tips.',
      },
      {
        title: 'Print 01 — Woodland Maidenhair Fern',
        stepType: 'illustration',
        prompt:
          'Archival botanical study of maidenhair fern and chamomile blossoms on textured off-white cotton paper, delicate ink and sage wash.',
      },
      {
        title: 'Print-Ready PDF & PNG Bundle',
        stepType: 'export',
        prompt: 'Assemble 8×10 in print portfolio PDF and ZIP archive.',
      },
    ],
  },
];

/**
 * Validates that a configured Google Apps Script Web App URL uses HTTPS
 * and strictly points to Google's Apps Script macro hostnames (SSRF defense).
 */
export function validateAppsScriptWebAppUrl(
  urlString: string
): { valid: boolean; error?: string } {
  const trimmed = urlString.trim();
  if (!trimmed) {
    return {
      valid: false,
      error:
        'APPS_SCRIPT_WEBAPP_URL is not configured. Deploy code.gs as a Web App and paste the URL into Settings > Secrets.',
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Apps Script Web App URL must use HTTPS.' };
    }
    const allowedHosts = new Set(['script.google.com', 'script.googleusercontent.com']);
    if (!allowedHosts.has(parsed.hostname)) {
      return {
        valid: false,
        error: 'Apps Script Web App URL must be hosted on script.google.com.',
      };
    }
    if (!parsed.pathname.includes('/macros/')) {
      return {
        valid: false,
        error: 'Apps Script Web App URL must point to a /macros/s/.../exec deployment.',
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'APPS_SCRIPT_WEBAPP_URL is not a valid URL.' };
  }
}

/**
 * Generates a clean Google Apps Script (Code.gs) bridge for time-driven job queue execution
 * and Google Sheets library persistence.
 */
export function generateAppsScriptBridge(spreadsheetId: string, workspaceUrl: string): string {
  const safeSheetId = spreadsheetId.trim() || 'AUTO_CREATED_ON_FIRST_RUN';
  const safeUrl = workspaceUrl.trim().replace(/\/+$/, '') || 'https://your-workspace-domain.com';

  return `// Full copy-and-paste script lives in /code.gs at the project root.
// Connected Spreadsheet ID: ${safeSheetId}
// Workspace Callback URL: ${safeUrl}
// Run setupWorkspace() once in Apps Script, deploy as a Web App,
// and save the Web App URL as APPS_SCRIPT_WEBAPP_URL in Settings > Secrets.`;
}

/**
 * Strictly validates external citation URLs returned by live web search.
 * Only http: and https: URLs are permitted (blocks javascript:, data:, vbscript:, etc.).
 */
export function sanitizeSourceUrl(rawUrl: string): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extracts and parses a JSON object from an LLM response that may include markdown code fences
 * or brief prose before/after the JSON payload.
 */
export function extractJsonObjectFromText(rawText: string): Record<string, unknown> {
  const trimmed = rawText.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  try {
    const direct = JSON.parse(candidate);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return direct as Record<string, unknown>;
    }
  } catch {
    // Fall through to balanced-brace extraction
  }

  const startIdx = candidate.indexOf('{');
  const endIdx = candidate.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    const slice = candidate.slice(startIdx, endIdx + 1);
    const parsed = JSON.parse(slice);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }

  throw new Error('Could not parse structured JSON from live research response.');
}

function normalizeStringList(value: unknown, maxItems = 8, maxLen = 260): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((s) => s.length > 0)
    .slice(0, maxItems)
    .map((s) => s.slice(0, maxLen));
}

export function dedupeSanitizedSources(
  rawSources: unknown,
  fallbackSources: TrendSourceLink[] = []
): TrendSourceLink[] {
  const seen = new Set<string>();
  const out: TrendSourceLink[] = [];

  const pushSource = (title: string, url: string) => {
    const safe = sanitizeSourceUrl(url);
    if (!safe || seen.has(safe)) return;
    seen.add(safe);
    let label = title.trim().slice(0, 110);
    if (!label) {
      try {
        label = new URL(safe).hostname.replace(/^www\./, '');
      } catch {
        label = 'Source';
      }
    }
    out.push({ title: label, url: safe });
  };

  if (Array.isArray(rawSources)) {
    for (const item of rawSources) {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        pushSource(String(rec.title ?? ''), String(rec.url ?? ''));
      } else if (typeof item === 'string') {
        pushSource('', item);
      }
    }
  }

  if (out.length === 0) {
    for (const fb of fallbackSources.slice(0, 3)) {
      pushSource(fb.title, fb.url);
    }
  }

  return out.slice(0, 8);
}

const VALID_TREND_TYPES = new Set<TrendProductType>([
  'childrens-book',
  'coloring-book',
  'wall-art',
  'flashcards',
  'ebook-planner',
]);

export function normalizeTrendProductType(raw: unknown): TrendProductType {
  const s = String(raw ?? '').toLowerCase().trim();
  if (VALID_TREND_TYPES.has(s as TrendProductType)) {
    return s as TrendProductType;
  }
  if (s.includes('color') || s.includes('activity')) return 'coloring-book';
  if (s.includes('art') || s.includes('print') || s.includes('sticker')) return 'wall-art';
  if (s.includes('flash') || s.includes('worksheet')) return 'flashcards';
  if (s.includes('plan') || s.includes('ebook') || s.includes('guide') || s.includes('journal')) {
    return 'ebook-planner';
  }
  return 'childrens-book';
}

export function normalizeTrendOpportunity(
  raw: unknown,
  fallbackSources: TrendSourceLink[],
  index: number
): TrendOpportunity | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const title = String(obj.title ?? '').trim().slice(0, 140);
  if (!title) return null;

  const rawScore = Number(obj.opportunity_score);
  const opportunity_score = Number.isFinite(rawScore)
    ? Math.min(100, Math.max(1, Math.round(rawScore)))
    : 75;

  const rawDemand = String(obj.demand_level ?? 'Medium').trim();
  const demand_level: TrendOpportunity['demand_level'] =
    rawDemand === 'High' || rawDemand === 'Emerging' ? rawDemand : 'Medium';

  const rawComp = String(obj.competition_level ?? 'Medium').trim();
  const competition_level: TrendOpportunity['competition_level'] =
    rawComp === 'Low' || rawComp === 'High' ? rawComp : 'Medium';

  const salesObj = (obj.sales_evidence && typeof obj.sales_evidence === 'object'
    ? obj.sales_evidence
    : {}) as Record<string, unknown>;

  const observed_signals = normalizeStringList(salesObj.observed_signals, 6, 280);
  let estimated_velocity = String(salesObj.estimated_velocity ?? '').trim().slice(0, 260);
  if (!estimated_velocity) {
    estimated_velocity = 'Est. velocity not quantified from available public signals.';
  } else if (!/\b(est\.?|estimate|estimated)\b/i.test(estimated_velocity)) {
    estimated_velocity = `Est. ${estimated_velocity}`;
  }

  const rawConf = String(salesObj.confidence ?? 'Medium').trim();
  const confidence: 'High' | 'Medium' | 'Low' =
    rawConf === 'High' || rawConf === 'Low' ? rawConf : 'Medium';

  const bpObj = (obj.starter_blueprint && typeof obj.starter_blueprint === 'object'
    ? obj.starter_blueprint
    : {}) as Record<string, unknown>;

  const product_type = normalizeTrendProductType(obj.product_type);
  const rawPageCount = Number(bpObj.suggested_page_count);
  const suggested_page_count =
    Number.isFinite(rawPageCount) && rawPageCount >= 1 && rawPageCount <= 828
      ? Math.round(rawPageCount)
      : product_type === 'coloring-book'
        ? 40
        : product_type === 'childrens-book'
          ? 24
          : 16;

  const marketplaces = normalizeStringList(obj.marketplaces, 4, 40);

  return {
    id: `opp-${index + 1}-${sanitizeFolderSlug(title).slice(0, 20)}`,
    title,
    product_type,
    marketplaces: marketplaces.length > 0 ? marketplaces : ['Amazon KDP'],
    opportunity_score,
    demand_level,
    competition_level,
    price_range_usd: String(obj.price_range_usd ?? '$6.99 - $14.99').trim().slice(0, 60),
    sales_evidence: {
      observed_signals:
        observed_signals.length > 0
          ? observed_signals
          : ['Live web search surfaced active category listings; verify exact BSR directly on marketplace.'],
      estimated_velocity,
      confidence,
    },
    seasonality: String(obj.seasonality ?? 'Evergreen').trim().slice(0, 100),
    buyer_pain_points: normalizeStringList(obj.buyer_pain_points, 5, 240),
    winning_angle: String(obj.winning_angle ?? '').trim().slice(0, 320),
    starter_blueprint: {
      target_age_or_audience: String(bpObj.target_age_or_audience ?? 'General Audience')
        .trim()
        .slice(0, 80),
      suggested_trim_size: String(bpObj.suggested_trim_size ?? '8.5x8.5').trim().slice(0, 30),
      suggested_page_count,
      art_style_direction: String(bpObj.art_style_direction ?? 'Clean editorial illustration')
        .trim()
        .slice(0, 260),
      hook_concept: String(bpObj.hook_concept ?? title).trim().slice(0, 320),
      seed_keywords: normalizeStringList(bpObj.seed_keywords, 10, 60),
    },
    sources: dedupeSanitizedSources(obj.sources, fallbackSources),
    created_project_id: null,
  };
}

export function mapTrendProductTypeToCategory(productType: TrendProductType): ProductCategory {
  switch (productType) {
    case 'childrens-book':
      return 'childrens-book';
    case 'coloring-book':
      return 'coloring-book';
    case 'wall-art':
      return 'art-print';
    case 'flashcards':
    case 'ebook-planner':
    default:
      return 'journal';
  }
}

export function normalizeKdpTrimSize(
  suggested: string,
  productType: TrendProductType
): KdpTrimSize {
  const compact = suggested.toLowerCase().replace(/\s+/g, '').replace(/[×x]/g, 'x');
  if (compact.includes('8.5x8.5') || compact.includes('8x8')) return '8.5x8.5';
  if (compact.includes('8.5x11')) return '8.5x11';
  if (compact.includes('8x10')) return '8x10';
  if (compact.includes('6x9')) return '6x9';

  switch (productType) {
    case 'childrens-book':
      return '8.5x8.5';
    case 'coloring-book':
    case 'flashcards':
      return '8.5x11';
    case 'wall-art':
      return '8x10';
    case 'ebook-planner':
    default:
      return '6x9';
  }
}

export const STYLE_PRESET_OPTIONS = [
  {
    label: '3D Animated Storybook Cartoon',
    value:
      '3D Animated Storybook Cartoon — expressive charming character, soft warm lighting, Pixar-inspired children’s picture book illustration',
  },
  {
    label: '2D Classic Cartoon Character',
    value:
      '2D Classic Cartoon Character — bold clean ink outlines, vibrant playful colors, expressive storybook charm',
  },
  {
    label: 'Hand-Painted Gouache Picture Book',
    value:
      'Hand-painted gouache picture book illustration on warm cold-press watercolor paper, editorial storybook warmth',
  },
  {
    label: 'Bold & Easy Coloring Book Line Art',
    value:
      'Crisp black-and-white bold ink line art coloring page on pure white background, clean unshaded spaces ready for coloring',
  },
  {
    label: 'Vintage Archival Portrait & Botanical Print',
    value:
      'Vintage archival storybook print, delicate ink linework and muted watercolor washes suitable for framed wall art',
  },
] as const;

export function pickStylePresetForProduct(
  category: ProductCategory,
  hintText = ''
): string {
  const hint = hintText.toLowerCase();
  if (
    category === 'coloring-book' ||
    hint.includes('coloring') ||
    hint.includes('line art') ||
    hint.includes('black ink')
  ) {
    return STYLE_PRESET_OPTIONS[3].value;
  }
  if (
    category === 'art-print' ||
    hint.includes('botanical') ||
    hint.includes('wall art') ||
    hint.includes('vintage') ||
    hint.includes('archival')
  ) {
    return STYLE_PRESET_OPTIONS[4].value;
  }
  if (hint.includes('watercolor') || hint.includes('gouache') || hint.includes('pastel')) {
    return STYLE_PRESET_OPTIONS[2].value;
  }
  if (hint.includes('2d') || hint.includes('comic') || hint.includes('flat vector')) {
    return STYLE_PRESET_OPTIONS[1].value;
  }
  return STYLE_PRESET_OPTIONS[0].value;
}

export function buildPromptPackFromTrend(
  opportunity: TrendOpportunity,
  deepDive?: TrendDeepDive
): ProductPromptPack {
  const category = mapTrendProductTypeToCategory(opportunity.product_type);
  const trimSize = normalizeKdpTrimSize(
    opportunity.starter_blueprint.suggested_trim_size,
    opportunity.product_type
  );
  const audience = opportunity.starter_blueprint.target_age_or_audience || 'General Audience';
  const hook = opportunity.starter_blueprint.hook_concept || opportunity.title;
  const artDirection = opportunity.starter_blueprint.art_style_direction || 'Clean editorial illustration';
  const winningAngle = deepDive?.differentiation_angle || opportunity.winning_angle;
  const keywords = Array.from(
    new Set([
      ...opportunity.starter_blueprint.seed_keywords,
      ...(deepDive?.high_intent_keywords ?? []),
    ])
  ).slice(0, 10);
  const painPoints = [
    ...opportunity.buyer_pain_points,
    ...(deepDive?.recurring_buyer_complaints ?? []),
  ].slice(0, 4);

  const artStylePreset = pickStylePresetForProduct(category, artDirection);
  const now = new Date().toISOString();

  let manuscriptPrompt = '';
  let coverPrompt = '';
  let interiorPrompts: InteriorPromptItem[] = [];

  if (opportunity.product_type === 'coloring-book') {
    manuscriptPrompt = `Write the front matter and page guide for "${opportunity.title}" targeting ${audience}. Include a warm welcome page, marker bleed-through / color-test page instructions, and a 20-scene themed page index based on this hook: ${hook}. Winning angle: ${winningAngle}.`;
    coverPrompt = `Eye-catching full-color commercial book cover artwork for "${opportunity.title}". Show a joyful, cozy signature scene inspired by "${hook}". Art style: ${artDirection}. Leave clean open breathing room at the top third for the title typography. No garbled text.`;
    interiorPrompts = [
      {
        id: 'page-1',
        title: 'Page 1 — Signature Hero Scene',
        prompt: `Crisp black-and-white bold ink line art coloring page for "${opportunity.title}" (${audience}). Depict the signature opening scene from "${hook}" with thick clean outlines, uncluttered shapes, and pure white background suitable for ${trimSize}" printing.`,
      },
      {
        id: 'page-2',
        title: 'Page 2 — Cozy Everyday Moment',
        prompt: `Crisp black-and-white bold ink line art coloring page for "${opportunity.title}". Show an inviting, stress-free cozy detail scene matching "${artDirection}" with bold 3pt outlines and zero gray shading.`,
      },
      {
        id: 'page-3',
        title: 'Page 3 — Playful Spotlight Scene',
        prompt: `Crisp black-and-white bold ink line art coloring page for "${opportunity.title}". Feature charming focal objects and characters inspired by "${winningAngle}" with generous open coloring spaces on pure white paper.`,
      },
      {
        id: 'page-4',
        title: 'Page 4 — Seasonal / Gift Bonus Page',
        prompt: `Crisp black-and-white bold ink line art coloring page for "${opportunity.title}" celebrating its "${opportunity.seasonality}" appeal. Bold clean outlines, charming framing elements, ready for ${trimSize}" KDP printing.`,
      },
    ];
  } else if (opportunity.product_type === 'wall-art') {
    manuscriptPrompt = `Write the storefront buyer guide, printing & framing size chart (8x10, 11x14, 16x20), and collection story for "${opportunity.title}" targeting ${audience}. Hook: ${hook}. Address buyer needs: ${painPoints.join('; ') || 'crisp print resolution and cohesive gallery styling'}.`;
    coverPrompt = `Signature hero printable wall art piece for "${opportunity.title}". Concept: ${hook}. Style: ${artDirection}. Balanced museum-grade composition, archival texture, framed-print ready on ${trimSize}" ratio, zero text or watermarks.`;
    interiorPrompts = [
      {
        id: 'page-1',
        title: 'Print 1 — Primary Focal Composition',
        prompt: `Printable wall art piece #1 in the "${opportunity.title}" set. Central hero motif inspired by "${hook}". Style: ${artDirection}. Cohesive gallery palette, clean borders.`,
      },
      {
        id: 'page-2',
        title: 'Print 2 — Companion Study',
        prompt: `Matching companion wall art piece #2 for "${opportunity.title}" designed to hang beside Print 1. Style: ${artDirection}. Harmonious tones and breathing room for ${trimSize}" framing.`,
      },
      {
        id: 'page-3',
        title: 'Print 3 — Atmospheric Accent Piece',
        prompt: `Cohesive third gallery wall print for "${opportunity.title}" reinforcing "${winningAngle}". Style: ${artDirection}. Crisp archival detail, zero garbled text.`,
      },
      {
        id: 'page-4',
        title: 'Print 4 — Minimalist Collector Edition',
        prompt: `Minimalist collector print #4 completing the "${opportunity.title}" wall art bundle for ${audience}. Style: ${artDirection}.`,
      },
    ];
  } else if (opportunity.product_type === 'flashcards' || opportunity.product_type === 'ebook-planner') {
    manuscriptPrompt = `Write the complete structured content, parent/teacher or buyer instructions, and page-by-page copy for "${opportunity.title}" targeting ${audience}. Concept: ${hook}. Differentiation: ${winningAngle}. Solve these pain points: ${painPoints.join('; ') || 'clarity and immediate practical usability'}.`;
    coverPrompt = `Clean, modern, high-converting cover illustration for "${opportunity.title}" (${audience}). Visual concept: ${hook}. Art direction: ${artDirection}. Crisp inviting layout with open title space at the top.`;
    interiorPrompts = [
      {
        id: 'page-1',
        title: 'Page 1 — Core Theme Visual / Card Set A',
        prompt: `Clean, calm, print-friendly illustration for "${opportunity.title}" (${audience}). Visual theme from "${hook}". Art style: ${artDirection}. Clear focal subject on clean background for ${trimSize}" printing.`,
      },
      {
        id: 'page-2',
        title: 'Page 2 — Guided Practice / Card Set B',
        prompt: `Matching print-ready visual illustration #2 for "${opportunity.title}". Support "${winningAngle}" with approachable, clutter-free artwork in style: ${artDirection}.`,
      },
      {
        id: 'page-3',
        title: 'Page 3 — Everyday Application / Card Set C',
        prompt: `Cohesive visual illustration #3 for "${opportunity.title}" tailored to ${audience}. Keep colors harmonious and layout readable at ${trimSize}" size.`,
      },
      {
        id: 'page-4',
        title: 'Page 4 — Milestone / Reflection Page Visual',
        prompt: `Warm, encouraging closing illustration for "${opportunity.title}" celebrating progress and daily use. Art style: ${artDirection}.`,
      },
    ];
  } else {
    // Children's Picture Book
    manuscriptPrompt = `Write a heartwarming, read-aloud 8-spread children's picture book manuscript for "${opportunity.title}" targeting ${audience}. Core hook: ${hook}. Differentiation angle: ${winningAngle}. Format clearly as Spread 1 through Spread 8 with rhythmic text and short visual scene notes.`;
    coverPrompt = `Warm, irresistible children's picture book front cover illustration for "${opportunity.title}" (${audience}). Showcase the main character in the signature setting of "${hook}". Art style: ${artDirection}. Leave open sky or soft framing at the top for the book title, no garbled text.`;
    interiorPrompts = [
      {
        id: 'page-1',
        title: 'Spread 1 — Meet the Hero',
        prompt: `Storybook interior illustration introducing the main character of "${opportunity.title}" in a cozy opening setting (${audience}). Hook: ${hook}. Art style: ${artDirection}. Consistent character design, ${trimSize}" composition.`,
      },
      {
        id: 'page-2',
        title: 'Spread 2 — The Spark of Adventure',
        prompt: `Storybook interior illustration showing the exciting turning point in "${opportunity.title}" where the adventure begins. Art style: ${artDirection}. Expressive emotion, warm storytelling light.`,
      },
      {
        id: 'page-3',
        title: 'Spread 3 — Friendship & Discovery',
        prompt: `Heartwarming storybook interior illustration capturing the key moment of connection and wonder in "${opportunity.title}". Highlight "${winningAngle}". Art style: ${artDirection}.`,
      },
      {
        id: 'page-4',
        title: 'Spread 4 — Cozy Happy Ending',
        prompt: `Gentle, satisfying finale illustration for "${opportunity.title}" leaving ${audience} smiling at bedtime or storytime. Art style: ${artDirection}. Soft golden glow and cohesive series palette.`,
      },
    ];
  }

  const kdpMetadataPrompt = `Create a high-converting ${opportunity.marketplaces.join(' & ')} product listing for "${opportunity.title}" (${audience}, target price ${opportunity.price_range_usd}). Include: 3 strong subtitle options, a compelling scannable description that addresses these buyer pain points (${painPoints.join('; ') || 'quality and value'}), suggested categories, and 7 high-intent backend search keywords built around: ${keywords.join(', ') || opportunity.title}.`;

  return {
    sourceTrendTitle: opportunity.title,
    targetAudience: audience,
    conceptSummary: `${hook}${winningAngle ? ` — ${winningAngle}` : ''}`.slice(0, 600),
    artStylePreset,
    manuscriptPrompt,
    kdpMetadataPrompt,
    coverPrompt,
    interiorPrompts,
    updatedAt: now,
  };
}

export function buildPromptPackFromConcept(input: {
  title: string;
  subtitle?: string;
  category: ProductCategory;
  trimSize: KdpTrimSize;
  pageCount: number;
  concept: string;
  targetAudience?: string;
  artStylePreset?: string;
}): ProductPromptPack {
  const title = input.title.trim() || 'Untitled Digital Product';
  let rawConcept =
    input.concept.trim() ||
    input.subtitle?.trim() ||
    `A charming, commercial-quality ${input.category.replace('-', ' ')} titled "${title}"`;
  if (rawConcept.startsWith('[TREND RESEARCH BRIEF]')) {
    const hookMatch = rawConcept.match(/Hook Concept:\s*\n+([^\n]+)/i);
    const angleMatch = rawConcept.match(/Winning Differentiation Angle:\s*\n+([^\n]+)/i);
    if (hookMatch?.[1]) {
      rawConcept = angleMatch?.[1]
        ? `${hookMatch[1].trim()} — ${angleMatch[1].trim()}`
        : hookMatch[1].trim();
    } else {
      rawConcept =
        input.subtitle?.trim() ||
        `A charming, commercial-quality ${input.category.replace('-', ' ')} titled "${title}"`;
    }
  }
  const concept = rawConcept.replace(/[.!?]+$/, '').trim() || rawConcept;
  const audience =
    input.targetAudience?.trim() ||
    (input.category === 'childrens-book'
      ? 'Ages 3–7 & Parents'
      : input.category === 'coloring-book'
        ? 'Kids, Teens & Cozy Coloring Fans'
        : input.category === 'art-print'
          ? 'Home Decor & Digital Print Buyers'
          : 'Everyday Planners & Gift Buyers');
  const artStylePreset =
    input.artStylePreset?.trim() || pickStylePresetForProduct(input.category, concept);
  const now = new Date().toISOString();

  if (input.category === 'coloring-book') {
    return {
      targetAudience: audience,
      conceptSummary: concept,
      artStylePreset,
      manuscriptPrompt: `Write a friendly welcome page, coloring tips / marker blotter page note, and a numbered list of ${Math.min(Math.max(input.pageCount, 12), 40)} unique coloring page ideas for "${title}" (${audience}). Concept: ${concept}.`,
      kdpMetadataPrompt: `Write an Amazon KDP & Etsy listing for the coloring book "${title}" (${input.trimSize}", ${input.pageCount} pages, audience: ${audience}). Concept: ${concept}. Provide 3 subtitle ideas, bullet-point book description, BISAC categories, and 7 high-intent KDP backend keywords.`,
      coverPrompt: `Vibrant, inviting full-color book cover illustration for "${title}". Showcase the core theme: ${concept}. Crisp commercial layout with clean open space at the top for the book title. No garbled text.`,
      interiorPrompts: [
        {
          id: 'page-1',
          title: 'Page 1 — Opening Coloring Plate',
          prompt: `Crisp black-and-white bold ink line art coloring page for "${title}". Opening scene based on: ${concept}. Thick clean outlines, pure white background, no shading, ready for ${input.trimSize}" printing.`,
        },
        {
          id: 'page-2',
          title: 'Page 2 — Cozy Detail Scene',
          prompt: `Crisp black-and-white bold ink line art coloring page for "${title}". Feature charming close-up details and characters inspired by: ${concept}. Bold clean lines on pure white paper.`,
        },
        {
          id: 'page-3',
          title: 'Page 3 — Playful Adventure Scene',
          prompt: `Crisp black-and-white bold ink line art coloring page for "${title}". Show a joyful active moment from: ${concept}. Large friendly shapes, crisp black outlines, zero gray fill.`,
        },
        {
          id: 'page-4',
          title: 'Page 4 — Celebration Finale Page',
          prompt: `Crisp black-and-white bold ink line art coloring page for "${title}". A warm, happy closing scene celebrating: ${concept}. Clean margins for ${input.trimSize}" KDP printing.`,
        },
      ],
      updatedAt: now,
    };
  }

  if (input.category === 'art-print') {
    return {
      targetAudience: audience,
      conceptSummary: concept,
      artStylePreset,
      manuscriptPrompt: `Write a cohesive collection note and home-printing / framing care sheet for the printable art set "${title}" (${input.trimSize}"). Theme: ${concept}.`,
      kdpMetadataPrompt: `Write an Etsy & digital storefront listing for the printable wall art collection "${title}" (${input.trimSize}", audience: ${audience}). Concept: ${concept}. Include SEO title, scannable description, print size details, and 7 high-intent search tags.`,
      coverPrompt: `Flagship hero archival art print for "${title}". Theme: ${concept}. Balanced gallery-worthy composition, clean edges, zero text or watermarks.`,
      interiorPrompts: [
        {
          id: 'page-1',
          title: 'Print 1 — Hero Artwork',
          prompt: `High-resolution archival printable wall art #1 for "${title}". Core subject: ${concept}. Cohesive refined palette on clean background.`,
        },
        {
          id: 'page-2',
          title: 'Print 2 — Companion Composition',
          prompt: `Matching companion wall art print #2 for "${title}" designed to pair in a gallery set. Concept: ${concept}.`,
        },
        {
          id: 'page-3',
          title: 'Print 3 — Atmospheric Detail Study',
          prompt: `Cohesive wall art print #3 for "${title}" exploring a close-up botanical or scenic detail from: ${concept}.`,
        },
        {
          id: 'page-4',
          title: 'Print 4 — Minimalist Accent Print',
          prompt: `Minimalist complementary wall art print #4 completing the "${title}" ${input.trimSize}" gallery bundle.`,
        },
      ],
      updatedAt: now,
    };
  }

  if (input.category === 'journal') {
    return {
      targetAudience: audience,
      conceptSummary: concept,
      artStylePreset,
      manuscriptPrompt: `Write the introduction, section headers, and guided prompts/exercises for "${title}" (${input.pageCount} pages, audience: ${audience}). Concept: ${concept}.`,
      kdpMetadataPrompt: `Write an Amazon KDP & Etsy listing for "${title}" (${input.trimSize}", ${input.pageCount} pages, audience: ${audience}). Concept: ${concept}. Include 3 subtitle ideas, benefit-led description, categories, and 7 high-intent search keywords.`,
      coverPrompt: `Clean, elevated cover artwork for "${title}" (${audience}). Visual theme: ${concept}. Tasteful editorial composition with open upper framing for the title, no garbled text.`,
      interiorPrompts: [
        {
          id: 'page-1',
          title: 'Section Divider 1 — Welcome & Intention',
          prompt: `Clean editorial divider illustration for Section 1 of "${title}". Concept: ${concept}. Calm balanced framing for ${input.trimSize}" printing.`,
        },
        {
          id: 'page-2',
          title: 'Section Divider 2 — Daily Focus',
          prompt: `Clean editorial divider illustration for Section 2 of "${title}" reinforcing daily rhythm and clarity. Concept: ${concept}.`,
        },
        {
          id: 'page-3',
          title: 'Section Divider 3 — Reflection & Growth',
          prompt: `Warm, motivating editorial illustration for Section 3 of "${title}" tailored to ${audience}.`,
        },
      ],
      updatedAt: now,
    };
  }

  // Default: Children's Book
  return {
    targetAudience: audience,
    conceptSummary: concept,
    artStylePreset,
    manuscriptPrompt: `Write an engaging, read-aloud 8-spread children's picture book manuscript for "${title}" (${audience}). Story concept: ${concept}. Structure clearly as Spread 1 through Spread 8 with warm rhythmic prose and a short visual direction line for each spread.`,
    kdpMetadataPrompt: `Write an Amazon KDP book listing for the children's picture book "${title}" (${input.trimSize}", ${input.pageCount} pages, ${audience}). Concept: ${concept}. Include 3 subtitle options, parent-friendly back-cover blurb, 2 BISAC categories, and 7 high-intent KDP backend keywords.`,
    coverPrompt: `Enchanting children's picture book front cover illustration for "${title}". Showcase the main character in an iconic, joyful moment from: ${concept}. Warm storybook lighting, open framing at the top for the book title, no garbled text.`,
    interiorPrompts: [
      {
        id: 'page-1',
        title: 'Spread 1 — Opening Scene',
        prompt: `Children's picture book illustration for Spread 1 of "${title}". Introduce the main character and cozy world from: ${concept}. Warm welcoming composition, ${input.trimSize}" square framing.`,
      },
      {
        id: 'page-2',
        title: 'Spread 2 — The Big Discovery',
        prompt: `Children's picture book illustration for Spread 2 of "${title}". Show the exciting moment of curiosity and adventure from: ${concept}. Expressive character pose, vibrant storybook atmosphere.`,
      },
      {
        id: 'page-3',
        title: 'Spread 3 — Heart of the Story',
        prompt: `Children's picture book illustration for Spread 3 of "${title}". Capture a playful, heartfelt moment of friendship or problem-solving from: ${concept}. Cohesive color palette.`,
      },
      {
        id: 'page-4',
        title: 'Spread 4 — Cozy Happy Ending',
        prompt: `Children's picture book illustration for the finale of "${title}". Show a joyful, comforting closing scene wrapping up: ${concept}. Warm golden light, storybook charm.`,
      },
    ],
    updatedAt: now,
  };
}

export function buildPlanStepsFromPromptPack(
  product: Pick<Product, 'title' | 'trimSize' | 'includeBleed'>,
  pack: ProductPromptPack
): Array<{
  title: string;
  stepType: 'manuscript' | 'illustration' | 'export';
  prompt: string;
}> {
  const steps: Array<{
    title: string;
    stepType: 'manuscript' | 'illustration' | 'export';
    prompt: string;
  }> = [];

  if (pack.manuscriptPrompt.trim()) {
    steps.push({
      title: 'Story / Interior Manuscript Copy',
      stepType: 'manuscript',
      prompt: pack.manuscriptPrompt.trim(),
    });
  }

  if (pack.coverPrompt.trim()) {
    steps.push({
      title: 'Front Cover Artwork',
      stepType: 'illustration',
      prompt: pack.coverPrompt.trim(),
    });
  }

  for (const page of pack.interiorPrompts) {
    if (page.prompt.trim()) {
      steps.push({
        title: page.title.trim() || 'Interior Illustration',
        stepType: 'illustration',
        prompt: page.prompt.trim(),
      });
    }
  }

  steps.push({
    title: `Assemble ${product.trimSize}" Print-Ready PDF`,
    stepType: 'export',
    prompt: `Assemble "${product.title}" assets into a ${product.trimSize} in ${
      product.includeBleed ? 'full-bleed ' : ''
    }print-ready KDP PDF.`,
  });

  return steps;
}

export interface ProductReadinessSummary {
  hasConcept: boolean;
  hasPrompts: boolean;
  hasManuscript: boolean;
  hasCover: boolean;
  interiorCount: number;
  exportCount: number;
  completedMilestones: number;
  totalMilestones: number;
  recommendedStep: 1 | 2 | 3 | 4;
  nextActionLabel: string;
}

export function computeProductReadiness(
  product: Product,
  assets: StorageAsset[],
  generations: GenerationRecord[],
  exportsList: ExportArtifact[]
): ProductReadinessSummary {
  const productAssets = assets.filter(
    (a) => a.productId === product.id && a.kind !== 'reference'
  );
  const productGens = generations.filter((g) => g.productId === product.id);
  const productExports = exportsList.filter((e) => e.productId === product.id);

  const hasConcept = product.title.trim().length >= 2;
  const hasPrompts = Boolean(
    product.promptPack &&
      (product.promptPack.coverPrompt.trim() ||
        product.promptPack.manuscriptPrompt.trim() ||
        product.promptPack.interiorPrompts.length > 0)
  );
  const trimmedNotes = product.manuscriptNotes.trim();
  const isBriefOnly = trimmedNotes.startsWith('[TREND RESEARCH BRIEF]') && trimmedNotes.length < 1600;
  const hasManuscript =
    (!isBriefOnly && trimmedNotes.length > 260) ||
    productGens.some((g) => g.mode === 'manuscript' || g.mode === 'kdp-metadata');
  const hasCover = Boolean(
    product.coverAssetId || productAssets.some((a) => a.kind === 'cover')
  );
  const interiorCount = productAssets.length;
  const exportCount = productExports.length;

  const milestones = [
    hasConcept,
    hasPrompts,
    hasCover || interiorCount > 0 || hasManuscript,
    exportCount > 0,
  ];
  const completedMilestones = milestones.filter(Boolean).length;

  let recommendedStep: 1 | 2 | 3 | 4 = 1;
  let nextActionLabel = 'Generate Editable Prompts';
  if (!hasPrompts) {
    recommendedStep = 1;
    nextActionLabel = 'Auto-Fill Prompts';
  } else if (interiorCount === 0 && !hasManuscript) {
    recommendedStep = 2;
    nextActionLabel = 'Edit & Run Prompts';
  } else if (exportCount === 0) {
    recommendedStep = 3;
    nextActionLabel = 'Review & Export PDF';
  } else {
    recommendedStep = 4;
    nextActionLabel = 'Download Finished PDF';
  }

  return {
    hasConcept,
    hasPrompts,
    hasManuscript,
    hasCover,
    interiorCount,
    exportCount,
    completedMilestones,
    totalMilestones: 4,
    recommendedStep,
    nextActionLabel,
  };
}

export interface TrendProjectSeed {
  productDraft: {
    title: string;
    subtitle: string;
    category: ProductCategory;
    status: ProductStatus;
    trimSize: KdpTrimSize;
    pageCount: number;
    includeBleed: boolean;
    manuscriptNotes: string;
  };
  promptPack: ProductPromptPack;
  planName: string;
  planSteps: Array<{
    title: string;
    stepType: 'manuscript' | 'illustration' | 'export';
    prompt: string;
  }>;
}

/**
 * Converts a researched trend opportunity (and optional deep-dive) into a pre-filled
 * Studio Product draft, an editable ProductPromptPack, and a ready-to-queue Batch Plan.
 */
export function mapTrendOpportunityToProjectSeed(
  opportunity: TrendOpportunity,
  deepDive?: TrendDeepDive
): TrendProjectSeed {
  const category = mapTrendProductTypeToCategory(opportunity.product_type);
  const trimSize = normalizeKdpTrimSize(
    opportunity.starter_blueprint.suggested_trim_size,
    opportunity.product_type
  );
  const pageCount = Math.min(
    828,
    Math.max(1, Math.round(opportunity.starter_blueprint.suggested_page_count || 24))
  );
  const includeBleed = opportunity.product_type === 'childrens-book';

  const keywords = Array.from(
    new Set([
      ...opportunity.starter_blueprint.seed_keywords,
      ...(deepDive?.high_intent_keywords ?? []),
    ])
  ).slice(0, 12);

  const notesSections = [
    `[TREND RESEARCH BRIEF]`,
    `Niche Opportunity: ${opportunity.title}`,
    `Target Marketplaces: ${opportunity.marketplaces.join(', ')} (${opportunity.price_range_usd})`,
    `Audience: ${opportunity.starter_blueprint.target_age_or_audience} · Seasonality: ${opportunity.seasonality}`,
    ``,
    `Hook Concept:`,
    opportunity.starter_blueprint.hook_concept,
    ``,
    `Winning Differentiation Angle:`,
    deepDive?.differentiation_angle || opportunity.winning_angle,
    ``,
    `Art Style Direction:`,
    opportunity.starter_blueprint.art_style_direction,
    ``,
    `Buyer Pain Points to Solve:`,
    ...(opportunity.buyer_pain_points.length > 0
      ? opportunity.buyer_pain_points.map((p) => `- ${p}`)
      : ['- Deliver crisp print quality and clear, practical value.']),
    ...(deepDive?.recurring_buyer_complaints?.length
      ? ['', 'Review Complaints from Deep-Dive:', ...deepDive.recurring_buyer_complaints.map((c) => `- ${c}`)]
      : []),
    ``,
    `Seed Keywords: ${keywords.join(', ')}`,
  ];

  const subtitle = `${opportunity.starter_blueprint.target_age_or_audience} · ${opportunity.marketplaces[0] ?? 'Amazon KDP'} (${opportunity.price_range_usd})`.slice(
    0,
    160
  );

  const promptPack = buildPromptPackFromTrend(opportunity, deepDive);
  const planSteps = buildPlanStepsFromPromptPack(
    { title: opportunity.title.slice(0, 120), trimSize, includeBleed },
    promptPack
  );

  return {
    productDraft: {
      title: opportunity.title.slice(0, 120),
      subtitle,
      category,
      status: 'draft',
      trimSize,
      pageCount,
      includeBleed,
      manuscriptNotes: notesSections.join('\n').slice(0, 10000),
    },
    promptPack,
    planName: `${opportunity.title.slice(0, 62)} — Starter Batch`,
    planSteps,
  };
}

export function filterTrendOpportunities(
  opportunities: TrendOpportunity[],
  filters: {
    productType: TrendProductType | 'all';
    marketplace: string | 'all';
    sortBy: 'score' | 'competition';
  }
): TrendOpportunity[] {
  const compRank: Record<TrendOpportunity['competition_level'], number> = {
    Low: 0,
    Medium: 1,
    High: 2,
  };

  return opportunities
    .filter((opp) => {
      if (filters.productType !== 'all' && opp.product_type !== filters.productType) return false;
      if (
        filters.marketplace !== 'all' &&
        !opp.marketplaces.some((m) => m.toLowerCase().includes(filters.marketplace.toLowerCase()))
      ) {
        return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => {
      if (filters.sortBy === 'competition') {
        const diff = compRank[a.competition_level] - compRank[b.competition_level];
        if (diff !== 0) return diff;
      }
      return b.opportunity_score - a.opportunity_score;
    });
}

/**
 * Normalizes Unicode typography (smart quotes, em/en dashes, ellipses, bullets)
 * into clean WinAnsi-safe text so pdf-lib standard fonts never drop characters or fail.
 */
export function sanitizeTextForPdf(raw: string): string {
  return String(raw ?? '')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2014\u2015]/g, ' - ')
    .replace(/[\u2012\u2013\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25CF\u25AA]/g, '*')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Detects whether a caption string is actually an internal AI image prompt or trend brief
 * rather than clean story text meant to be printed inside a book.
 */
export function isLikelyPromptNotStory(text: string): boolean {
  const s = text.trim();
  if (!s) return true;
  if (s.startsWith('[TREND RESEARCH BRIEF]')) return true;
  const promptSignals = [
    /^children'?s picture book illustration/i,
    /^storybook interior illustration/i,
    /^crisp black-and-white bold ink/i,
    /^enchanting children'?s picture book front cover/i,
    /^printable wall art piece/i,
    /^reference photo for ai/i,
    /^high-resolution\b/i,
    /^source\s+trend\s*:/i,
    /^winning\s+angle\s*:/i,
    /^target\s+audience\s*:/i,
    /\bfull-bleed\s+illustration\b/i,
    /\bart style:\s/i,
    /\bno garbled text\b/i,
    /\bsuitable for .* printing\b/i,
    /\bcomposition,\s*\d+(\.\d+)?x\d+/i,
  ];
  return promptSignals.some((rx) => rx.test(s));
}

function cleanStorySegment(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      // Strip visual/illustration notes and metadata lines from printed story text
      if (/^(?:\*{0,2})(?:visual|illustration|art|scene)\s*(?:note|direction|prompt|description)?\s*:/i.test(line)) {
        return false;
      }
      if (/^\[(?:visual|illustration|art|scene)[^\]]*\]$/i.test(line)) {
        return false;
      }
      if (/^(?:title|subtitle|blurb|keywords|categories|bisac|target audience|source trend|winning angle)\s*:/i.test(line)) {
        return false;
      }
      return true;
    })
    .map((line) =>
      line
        .replace(/^#+\s*/, '')
        .replace(/^\*{1,2}([^*]+)\*{1,2}:\s*/, '')
        .replace(/^(?:text|story|copy|narration)\s*:\s*/i, '')
        .replace(/^[-*]\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/^["“]|["”]$/g, '')
        .trim()
    )
    .filter(Boolean);

  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parses a generated manuscript (Spread 1..N, Page 1..N, or multi-paragraph text)
 * into clean per-page story passages ready to typeset onto illustrated book pages.
 */
export function parseManuscriptIntoPageTexts(
  manuscriptNotes?: string | null,
  maxPages = 24
): string[] {
  const raw = String(manuscriptNotes ?? '').trim();
  if (!raw) return [];

  // Strip out [TREND RESEARCH BRIEF] and KDP listing metadata blocks if appended in manuscriptNotes
  let working = raw;
  const kdpSplitIdx = working.search(
    /(?:^|\n)(?:---\s*(?:KDP|Storefront|Listing|Metadata)|(?:#{1,4}\s*)?(?:\*{0,2})(?:KDP|Storefront)\s+(?:Listing|Metadata))/i
  );
  if (kdpSplitIdx > 0) {
    working = working.slice(0, kdpSplitIdx).trim();
  }
  if (working.startsWith('[TREND RESEARCH BRIEF]')) {
    const nextSection = working.search(/\n---\s|\n(?:#{1,3}\s*)?(?:\*{0,2})(?:Spread|Page|Scene)\s*1\b/i);
    if (nextSection === -1) return [];
    working = working.slice(nextSection).trim();
  }

  // 1. Primary strategy: split by explicit Spread / Page / Scene markers
  const markerRegex =
    /(?:^|\n)[ \t]*(?:#{1,4}[ \t]*)?(?:\*{0,2})(?:Spread|Page|Scene)[ \t]*\d+(?:[ \t]*[-–—][ \t]*[^\n:]*)?(?:\*{0,2})[ \t]*(?::[ \t]*|\r?\n)/gi;
  const matches = Array.from(working.matchAll(markerRegex));

  if (matches.length >= 1) {
    const segments: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = (matches[i].index ?? 0) + matches[i][0].length;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? working.length) : working.length;
      const cleaned = cleanStorySegment(working.slice(start, end));
      if (cleaned.length >= 6 && !isLikelyPromptNotStory(cleaned)) {
        segments.push(cleaned);
      }
    }
    if (segments.length > 0) {
      return segments.slice(0, maxPages);
    }
  }

  // 2. Fallback: split by blank lines into clean story paragraphs
  const paragraphs = working
    .split(/\n{2,}/)
    .map((p) => cleanStorySegment(p))
    .filter((p) => p.length >= 12 && !isLikelyPromptNotStory(p));

  return paragraphs.slice(0, maxPages);
}

const SCENE_CAMERA_DIRECTIVES = [
  'Establishing wide-angle opening shot — introduce the character in an inviting, sunlit setting with open sky/breathing room.',
  'Dynamic three-quarter action pose — show the character mid-motion exploring or discovering something exciting, different background from page 1.',
  'Warm medium close-up — expressive face and eyes reacting with wonder or joy to a new companion or discovery in a fresh environment.',
  'Playful low-angle adventure shot — rich foreground elements and lively depth, character interacting actively with the scene.',
  'Over-the-shoulder storytelling angle — looking toward a magical landmark or new vista so the setting feels expansive and distinct.',
  'Cozy golden-hour wide composition — heartwarming resolved moment with soft warm lighting and calm visual balance.',
  'Whimsical overhead / bird’s-eye storybook angle — charming winding path or cozy room layout giving fresh visual variety.',
  'Gentle twilight / bedtime finale framing — peaceful, comforting mood wrapping up the journey under soft starry light.',
];

/**
 * Produces a distinct visual framing & pose directive for each page so uploading ONE
 * reference photo yields genuinely varied, dynamic book pages instead of repeating the same pose.
 */
export function buildSceneVariationDirective(sceneIndex: number, totalScenes?: number): string {
  const safeIdx = Math.max(0, Math.floor(sceneIndex));
  const directive = SCENE_CAMERA_DIRECTIVES[safeIdx % SCENE_CAMERA_DIRECTIVES.length];
  const label = totalScenes && totalScenes > 1
    ? `Page ${safeIdx + 1} of ${totalScenes}`
    : `Page ${safeIdx + 1}`;
  return `${label} composition: ${directive}`;
}

