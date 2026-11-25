import type {
  BatchPlan,
  JobItem,
  JobStatus,
  KdpTrimSize,
  PlanTemplate,
  Product,
  ProductCategory,
  ProductStatus,
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
 * Generates a clean Google Apps Script (Code.gs) bridge for time-driven job queue execution
 * and Google Sheets library persistence.
 */
export function generateAppsScriptBridge(spreadsheetId: string, workspaceUrl: string): string {
  const safeSheetId = spreadsheetId.trim() || 'YOUR_SPREADSHEET_ID';
  const safeUrl = workspaceUrl.trim().replace(/\/+$/, '') || 'https://your-workspace-domain.com';

  return `/**
 * FolioPress — Google Apps Script Library & Job Queue Bridge
 * Attach to your Library Spreadsheet and add a 5-minute time-driven trigger on runNextJobTick().
 */

const CONFIG = {
  SPREADSHEET_ID: '${safeSheetId}',
  WORKSPACE_API: '${safeUrl}',
  // Store your FolioPress API token under Project Settings > Script Properties as FOLIOPRESS_TOKEN
};

function getSheet_(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/**
 * Time-driven trigger: reads the next queued row in Jobs and calls the workspace worker endpoint.
 */
function runNextJobTick() {
  const token = PropertiesService.getScriptProperties().getProperty('FOLIOPRESS_TOKEN');
  if (!token) throw new Error('Missing FOLIOPRESS_TOKEN in Script Properties.');

  const jobsSheet = getSheet_('Jobs');
  const rows = jobsSheet.getDataRange().getValues();
  if (rows.length < 2) return;

  const headers = rows[0];
  const statusCol = headers.indexOf('status');
  const idCol = headers.indexOf('id');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][statusCol] === 'queued') {
      const jobId = rows[i][idCol];
      jobsSheet.getRange(i + 1, statusCol + 1).setValue('running');

      const res = UrlFetchApp.fetch(CONFIG.WORKSPACE_API + '/api/jobs/run-next', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify({ jobId }),
        muteHttpExceptions: true,
      });

      const ok = res.getResponseCode() >= 200 && res.getResponseCode() < 300;
      jobsSheet.getRange(i + 1, statusCol + 1).setValue(ok ? 'completed' : 'failed');
      break; // Process exactly one step per trigger tick
    }
  }
}
`;
}
