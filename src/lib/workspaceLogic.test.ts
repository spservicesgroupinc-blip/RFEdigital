import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateKdpDimensionsPt,
  expandPlanToJobs,
  extractJsonObjectFromText,
  filterProducts,
  filterTrendOpportunities,
  formatBytes,
  generateAppsScriptBridge,
  getNextRunnableJob,
  mapTrendOpportunityToProjectSeed,
  normalizeKdpTrimSize,
  normalizeTrendOpportunity,
  sanitizeFolderSlug,
  sanitizeSourceUrl,
  transitionJobStatus,
  validateAppsScriptWebAppUrl,
  validateProductInput,
  validateTokenName,
} from './workspaceLogic';
import type { BatchPlan, JobItem, Product } from '../types/workspace';

test('calculateKdpDimensionsPt computes exact KDP bleed and no-bleed geometry', () => {
  const noBleed = calculateKdpDimensionsPt('8.5x8.5', false);
  assert.equal(noBleed.finalWidthIn, 8.5);
  assert.equal(noBleed.finalHeightIn, 8.5);
  assert.equal(noBleed.widthPt, 612);
  assert.equal(noBleed.heightPt, 612);

  const withBleed = calculateKdpDimensionsPt('8.5x8.5', true);
  assert.equal(withBleed.finalWidthIn, 8.625);
  assert.equal(withBleed.finalHeightIn, 8.75);
  assert.equal(withBleed.widthPt, 621);
  assert.equal(withBleed.heightPt, 630);
});

test('sanitizeFolderSlug normalizes product titles into safe folder paths', () => {
  assert.equal(sanitizeFolderSlug('The Lantern Bear: Book #1!'), 'the-lantern-bear-book-1');
  assert.equal(sanitizeFolderSlug('   '), 'untitled-product');
  assert.equal(sanitizeFolderSlug('../../etc/passwd'), 'etc-passwd');
});

test('validateProductInput enforces title and KDP page count bounds', () => {
  const empty = validateProductInput({
    title: '   ',
    pageCount: 24,
    category: 'childrens-book',
    trimSize: '8.5x8.5',
  });
  assert.equal(empty.valid, false);
  assert.ok(empty.errors.title);

  const badPages = validateProductInput({
    title: 'Valid Book',
    pageCount: 0,
    category: 'childrens-book',
    trimSize: '8.5x8.5',
  });
  assert.equal(badPages.valid, false);
  assert.ok(badPages.errors.pageCount);

  const ok = validateProductInput({
    title: 'Moonlight Harbor',
    pageCount: 32,
    category: 'childrens-book',
    trimSize: '8.5x8.5',
  });
  assert.equal(ok.valid, true);
});

test('validateTokenName rejects empty or overly short labels', () => {
  assert.equal(validateTokenName('').valid, false);
  assert.equal(validateTokenName('ab').valid, false);
  assert.equal(validateTokenName('Apps Script Trigger').valid, true);
});

test('filterProducts filters by query, category, and status simultaneously', () => {
  const sample: Product[] = [
    {
      id: 'p1',
      seriesId: null,
      title: 'The Lantern Bear',
      subtitle: 'Twilight Forest Tale',
      category: 'childrens-book',
      status: 'ready-for-kdp',
      trimSize: '8.5x8.5',
      pageCount: 24,
      includeBleed: true,
      isbn: '979-8-8801-0001-1',
      coverAssetId: null,
      driveFolderId: null,
      sheetsRowSyncedAt: null,
      manuscriptNotes: '',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'p2',
      seriesId: null,
      title: 'Botanical Field Prints',
      subtitle: 'Archival Ferns',
      category: 'art-print',
      status: 'draft',
      trimSize: '8x10',
      pageCount: 12,
      includeBleed: false,
      isbn: '979-8-8801-0002-8',
      coverAssetId: null,
      driveFolderId: null,
      sheetsRowSyncedAt: null,
      manuscriptNotes: '',
      createdAt: '2026-10-02T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    },
  ];

  assert.equal(filterProducts(sample, 'lantern', 'all', 'all').length, 1);
  assert.equal(filterProducts(sample, '', 'art-print', 'draft').length, 1);
  assert.equal(filterProducts(sample, '', 'childrens-book', 'draft').length, 0);
});

test('expandPlanToJobs only queues unqueued steps in step order', () => {
  const plan: BatchPlan = {
    id: 'plan-1',
    productId: 'prod-1',
    seriesId: null,
    name: 'Book 1 Batch',
    templateId: 'tpl-picture-book-24',
    trimSize: '8.5x8.5',
    steps: [
      { id: 's2', order: 2, title: 'Spread 1', stepType: 'illustration', prompt: 'Bear', queued: false },
      { id: 's1', order: 1, title: 'Manuscript', stepType: 'manuscript', prompt: 'Story', queued: true },
      { id: 's3', order: 3, title: 'Export PDF', stepType: 'export', prompt: 'Assemble', queued: false },
    ],
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  const expanded = expandPlanToJobs(plan, 'The Lantern Bear');
  assert.equal(expanded.length, 2);
  assert.equal(expanded[0].title, 'The Lantern Bear — Spread 1');
  assert.equal(expanded[1].title, 'The Lantern Bear — Export PDF');
});

test('job queue transitions and FIFO selection behave deterministically', () => {
  const jobs: JobItem[] = [
    {
      id: 'j2',
      planId: null,
      productId: 'p1',
      title: 'Later Job',
      stepType: 'illustration',
      prompt: 'Prompt 2',
      provider: 'gemini',
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      resultAssetId: null,
      resultSummary: null,
      errorMessage: null,
      createdAt: '2026-10-02T10:00:00Z',
      updatedAt: '2026-10-02T10:00:00Z',
    },
    {
      id: 'j1',
      planId: null,
      productId: 'p1',
      title: 'Earlier Job',
      stepType: 'manuscript',
      prompt: 'Prompt 1',
      provider: 'gemini',
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      resultAssetId: null,
      resultSummary: null,
      errorMessage: null,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    },
  ];

  assert.equal(getNextRunnableJob(jobs)?.id, 'j1');

  const paused = transitionJobStatus(jobs[0], 'pause');
  assert.equal(paused.ok, true);
  if (paused.ok) assert.equal(paused.nextStatus, 'paused');

  const invalidRetry = transitionJobStatus(jobs[0], 'retry');
  assert.equal(invalidRetry.ok, false);
});

test('formatBytes and generateAppsScriptBridge format clean outputs', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  const script = generateAppsScriptBridge('sheet_123', 'https://folio.example.com/');
  assert.ok(script.includes('sheet_123'));
  assert.ok(script.includes('https://folio.example.com'));
});

test('validateAppsScriptWebAppUrl allows only HTTPS script.google.com macro URLs', () => {
  assert.equal(
    validateAppsScriptWebAppUrl('https://script.google.com/macros/s/AKfycb12345/exec').valid,
    true
  );
  assert.equal(validateAppsScriptWebAppUrl('').valid, false);
  assert.equal(
    validateAppsScriptWebAppUrl('http://script.google.com/macros/s/AKfycb12345/exec').valid,
    false
  );
  assert.equal(validateAppsScriptWebAppUrl('https://169.254.169.254/latest/meta-data').valid, false);
  assert.equal(validateAppsScriptWebAppUrl('https://evil.example.com/macros/s/abc/exec').valid, false);
  assert.equal(validateAppsScriptWebAppUrl('https://script.google.com/home').valid, false);
});

test('sanitizeSourceUrl allows only http/https URLs and blocks XSS protocols', () => {
  assert.equal(sanitizeSourceUrl('https://www.amazon.com/dp/B012345'), 'https://www.amazon.com/dp/B012345');
  assert.equal(sanitizeSourceUrl('http://etsy.com/listing/123'), 'http://etsy.com/listing/123');
  assert.equal(sanitizeSourceUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeSourceUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeSourceUrl('not-a-url'), null);
});

test('extractJsonObjectFromText parses fenced and prose-wrapped JSON payloads', () => {
  const fenced = 'Here are your findings:\n```json\n{"market_summary":"Steady Q4 demand","opportunities":[]}\n```';
  const parsed = extractJsonObjectFromText(fenced);
  assert.equal(parsed.market_summary, 'Steady Q4 demand');
  assert.ok(Array.isArray(parsed.opportunities));
});

test('normalizeTrendOpportunity enforces score bounds, estimate labeling, and safe fallback sources', () => {
  const fallback = [{ title: 'Amazon Best Sellers', url: 'https://www.amazon.com/best-sellers-books' }];
  const opp = normalizeTrendOpportunity(
    {
      title: 'Bold & Easy Cozy Bakery Coloring Book',
      product_type: 'coloring-book',
      marketplaces: ['Amazon KDP', 'Etsy'],
      opportunity_score: 142,
      demand_level: 'High',
      competition_level: 'Low',
      price_range_usd: '$7.99 - $12.99',
      sales_evidence: {
        observed_signals: ['Multiple top-500 KDP coloring listings with 300+ reviews'],
        estimated_velocity: '200-400 units/mo for top listings',
        confidence: 'High',
      },
      seasonality: 'Evergreen with Q4 gift spike',
      buyer_pain_points: ['Paper bleed-through with alcohol markers'],
      winning_angle: 'Include protective blotter page and bold 3pt outlines',
      starter_blueprint: {
        target_age_or_audience: 'Teens & Adults',
        suggested_trim_size: '8.5 x 8.5 in',
        suggested_page_count: 42,
        art_style_direction: 'Thick black ink lines, uncluttered cozy bakery interiors',
        hook_concept: '40 stress-free hygge pastry shop scenes designed for alcohol markers',
        seed_keywords: ['bold and easy coloring', 'cozy bakery coloring book'],
      },
      sources: [{ title: 'Bad Link', url: 'javascript:void(0)' }],
    },
    fallback,
    0
  );

  assert.ok(opp);
  assert.equal(opp.opportunity_score, 100);
  assert.match(opp.sales_evidence.estimated_velocity, /^Est\./);
  assert.equal(opp.sources.length, 1);
  assert.equal(opp.sources[0].url, 'https://www.amazon.com/best-sellers-books');
});

test('mapTrendOpportunityToProjectSeed converts a trend card into a pre-filled Studio product and batch plan', () => {
  const opp = normalizeTrendOpportunity(
    {
      title: 'Montessori Emotion Flashcards for Toddlers',
      product_type: 'flashcards',
      marketplaces: ['Etsy', 'Teachers Pay Teachers'],
      opportunity_score: 88,
      demand_level: 'High',
      competition_level: 'Low',
      price_range_usd: '$5.99 - $9.99',
      sales_evidence: {
        observed_signals: ['Etsy Bestseller badge on minimalist watercolor emotion cards'],
        estimated_velocity: 'Est. 120-250 digital downloads/mo',
        confidence: 'Medium',
      },
      seasonality: 'Evergreen + Back-to-School peak',
      buyer_pain_points: ['Cartoon faces feel overstimulating'],
      winning_angle: 'Calm pastel watercolor portraits with calm-down prompts on card backs',
      starter_blueprint: {
        target_age_or_audience: 'Ages 2-5 & Preschool Teachers',
        suggested_trim_size: '8.5x11',
        suggested_page_count: 18,
        art_style_direction: 'Gentle Montessori watercolor portraits on cream cards',
        hook_concept: '36 printable calm-corner emotion flashcards with parent scripts',
        seed_keywords: ['montessori emotion cards', 'calm down corner printable'],
      },
      sources: [{ title: 'Etsy Search', url: 'https://www.etsy.com/search?q=emotion+flashcards' }],
    },
    [],
    0
  )!;

  const seed = mapTrendOpportunityToProjectSeed(opp);
  assert.equal(seed.productDraft.category, 'journal');
  assert.equal(seed.productDraft.trimSize, '8.5x11');
  assert.equal(seed.productDraft.pageCount, 18);
  assert.ok(seed.productDraft.manuscriptNotes.includes('36 printable calm-corner emotion flashcards'));
  assert.equal(seed.planSteps.length, 4);
  assert.equal(normalizeKdpTrimSize('8 x 10 printable', 'wall-art'), '8x10');

  const filtered = filterTrendOpportunities([opp], {
    productType: 'flashcards',
    marketplace: 'Etsy',
    sortBy: 'competition',
  });
  assert.equal(filtered.length, 1);
});
