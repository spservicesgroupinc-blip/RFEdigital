import type {
  BatchPlan,
  JobItem,
  JobStatus,
  KdpTrimSize,
  PlanTemplate,
  Product,
  ProductCategory,
  ProductStatus,
  TrendDeepDive,
  TrendOpportunity,
  TrendProductType,
  TrendSourceLink,
} from '../types/workspace';

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
  planName: string;
  planSteps: Array<{
    title: string;
    stepType: 'manuscript' | 'illustration' | 'export';
    prompt: string;
  }>;
}

/**
 * Converts a researched trend opportunity (and optional deep-dive) into a pre-filled
 * Studio Product draft and a ready-to-queue Batch Generation Plan.
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

  const planSteps: TrendProjectSeed['planSteps'] = [
    {
      title: 'Listing Copy, Outline & Keyword Pack',
      stepType: 'manuscript',
      prompt: `Draft the core outline, marketplace listing description, and content structure for "${opportunity.title}" targeting ${opportunity.starter_blueprint.target_age_or_audience}. Hook: ${opportunity.starter_blueprint.hook_concept}. Winning angle: ${deepDive?.differentiation_angle || opportunity.winning_angle}. Incorporate keywords: ${keywords.slice(0, 7).join(', ')}.`,
    },
    {
      title: 'Cover / Hero Visual Concept',
      stepType: 'illustration',
      prompt: `Create the hero cover artwork for "${opportunity.title}" (${opportunity.product_type}). Hook concept: ${opportunity.starter_blueprint.hook_concept}. Art direction: ${opportunity.starter_blueprint.art_style_direction}.`,
    },
    {
      title: 'Signature Interior Plate / Spread 01',
      stepType: 'illustration',
      prompt: `Create the flagship interior page or spread for "${opportunity.title}" tailored for ${opportunity.starter_blueprint.target_age_or_audience}. Art direction: ${opportunity.starter_blueprint.art_style_direction}. Ensure clean composition suitable for ${trimSize} printing.`,
    },
    {
      title: `Assemble ${trimSize}" Print-Ready PDF`,
      stepType: 'export',
      prompt: `Assemble ordered product assets into a ${trimSize} in ${includeBleed ? 'full-bleed ' : ''}print-ready PDF for ${opportunity.marketplaces.join(' & ')}.`,
    },
  ];

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
