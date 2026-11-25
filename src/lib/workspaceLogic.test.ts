import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STYLE_PRESET_OPTIONS,
  buildPlanStepsFromPromptPack,
  buildPromptPackFromConcept,
  buildPromptPackFromTrend,
  buildSceneVariationDirective,
  calculateKdpDimensionsPt,
  computeProductReadiness,
  expandPlanToJobs,
  extractJsonObjectFromText,
  filterProducts,
  filterTrendOpportunities,
  formatBytes,
  generateAppsScriptBridge,
  getNextRunnableJob,
  isLikelyPromptNotStory,
  mapTrendOpportunityToProjectSeed,
  normalizeKdpTrimSize,
  normalizeTrendOpportunity,
  parseManuscriptIntoPageTexts,
  pickStylePresetForProduct,
  sanitizeFolderSlug,
  sanitizeSourceUrl,
  sanitizeTextForPdf,
  transitionJobStatus,
  validateAppsScriptWebAppUrl,
  validateProductInput,
  validateTokenName,
} from './workspaceLogic';
import { buildKdpPdfBuffer } from '../../server/pdfExport.js';
import type {
  BatchPlan,
  ExportArtifact,
  GenerationRecord,
  JobItem,
  Product,
  StorageAsset,
} from '../types/workspace';

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
  assert.equal(seed.promptPack.interiorPrompts.length, 4);
  assert.ok(seed.promptPack.coverPrompt.includes('Montessori Emotion Flashcards'));
  assert.ok(seed.promptPack.manuscriptPrompt.includes('Montessori Emotion Flashcards'));
  assert.ok(seed.promptPack.kdpMetadataPrompt.includes('montessori emotion cards'));
  assert.equal(seed.planSteps.length, 7);
  assert.equal(seed.planSteps[0].stepType, 'manuscript');
  assert.equal(seed.planSteps[1].stepType, 'illustration');
  assert.equal(seed.planSteps[seed.planSteps.length - 1].stepType, 'export');
  assert.equal(normalizeKdpTrimSize('8 x 10 printable', 'wall-art'), '8x10');

  const filtered = filterTrendOpportunities([opp], {
    productType: 'flashcards',
    marketplace: 'Etsy',
    sortBy: 'competition',
  });
  assert.equal(filtered.length, 1);
});

test('pickStylePresetForProduct selects appropriate style presets by category and hint', () => {
  assert.equal(pickStylePresetForProduct('coloring-book', ''), STYLE_PRESET_OPTIONS[3].value);
  assert.equal(pickStylePresetForProduct('art-print', ''), STYLE_PRESET_OPTIONS[4].value);
  assert.equal(pickStylePresetForProduct('childrens-book', 'soft watercolor wash'), STYLE_PRESET_OPTIONS[2].value);
  assert.equal(pickStylePresetForProduct('childrens-book', '2d comic hero'), STYLE_PRESET_OPTIONS[1].value);
  assert.equal(pickStylePresetForProduct('childrens-book', 'magical adventure'), STYLE_PRESET_OPTIONS[0].value);
});

test('buildPromptPackFromConcept and buildPlanStepsFromPromptPack generate editable packs for concepts', () => {
  const coloringPack = buildPromptPackFromConcept({
    title: 'Cozy Bakery Coloring',
    category: 'coloring-book',
    trimSize: '8.5x11',
    pageCount: 30,
    concept: 'Bold and easy croissants, teacups, and warm bakery storefronts',
  });
  assert.equal(coloringPack.artStylePreset, STYLE_PRESET_OPTIONS[3].value);
  assert.equal(coloringPack.interiorPrompts.length, 4);
  assert.ok(coloringPack.coverPrompt.includes('Cozy Bakery Coloring'));
  assert.ok(coloringPack.interiorPrompts[0].prompt.includes('black-and-white'));

  const steps = buildPlanStepsFromPromptPack(
    { title: 'Cozy Bakery Coloring', trimSize: '8.5x11', includeBleed: false },
    coloringPack
  );
  assert.equal(steps.length, 7);
  assert.equal(steps[0].title, 'Story / Interior Manuscript Copy');
  assert.equal(steps[1].title, 'Front Cover Artwork');
  assert.equal(steps[6].stepType, 'export');

  const trendOpp = normalizeTrendOpportunity(
    {
      title: 'Sleepy Woodland Owls Bedtime Book',
      product_type: 'childrens-book',
      marketplaces: ['Amazon KDP'],
      opportunity_score: 91,
      demand_level: 'High',
      competition_level: 'Low',
      price_range_usd: '$9.99 - $14.99',
      sales_evidence: {
        observed_signals: ['Top 200 bedtime book category'],
        estimated_velocity: 'Est. 300 units/mo',
        confidence: 'High',
      },
      seasonality: 'Evergreen',
      buyer_pain_points: ['Too long for toddlers'],
      winning_angle: 'Gentle rhythmic 8-spread read-aloud under 5 minutes',
      starter_blueprint: {
        target_age_or_audience: 'Ages 2-5',
        suggested_trim_size: '8.5x8.5',
        suggested_page_count: 24,
        art_style_direction: 'Warm gouache woodland palette',
        hook_concept: 'Little owls tucking in forest friends under a glowing moon',
        seed_keywords: ['bedtime picture book', 'woodland owl story'],
      },
      sources: [{ title: 'Amazon', url: 'https://www.amazon.com/dp/B0000001' }],
    },
    [],
    0
  )!;
  const bookPack = buildPromptPackFromTrend(trendOpp);
  assert.equal(bookPack.sourceTrendTitle, 'Sleepy Woodland Owls Bedtime Book');
  assert.equal(bookPack.artStylePreset, STYLE_PRESET_OPTIONS[2].value);
  assert.equal(bookPack.interiorPrompts.length, 4);
});

test('computeProductReadiness tracks milestones and next recommended workflow step', () => {
  const baseProduct: Product = {
    id: 'p-ready',
    seriesId: null,
    title: 'Sunny Meadow',
    subtitle: 'Bedtime Tale',
    category: 'childrens-book',
    status: 'draft',
    trimSize: '8.5x8.5',
    pageCount: 24,
    includeBleed: true,
    isbn: '979-8-0000-0001-1',
    coverAssetId: null,
    driveFolderId: null,
    sheetsRowSyncedAt: null,
    manuscriptNotes: '',
    promptPack: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  // Step 1: concept only, no prompt pack yet
  const step1 = computeProductReadiness(baseProduct, [], [], []);
  assert.equal(step1.completedMilestones, 1);
  assert.equal(step1.recommendedStep, 1);

  // Step 2: prompt pack added, no pages or manuscript yet
  const withPack: Product = {
    ...baseProduct,
    promptPack: buildPromptPackFromConcept({
      title: baseProduct.title,
      category: baseProduct.category,
      trimSize: baseProduct.trimSize,
      pageCount: baseProduct.pageCount,
      concept: 'A cheerful bunny exploring a sunny meadow',
    }),
  };
  const step2 = computeProductReadiness(withPack, [], [], []);
  assert.equal(step2.completedMilestones, 2);
  assert.equal(step2.recommendedStep, 2);

  // Step 3: artwork generated (reference photo ignored for interior count)
  const assets: StorageAsset[] = [
    {
      id: 'ref-1',
      folderId: 'folder-1',
      productId: 'p-ready',
      name: 'photo.jpg',
      kind: 'reference',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      url: '/uploads/ref.jpg',
      caption: 'Reference photo',
      pageOrder: 0,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'cov-1',
      folderId: 'folder-1',
      productId: 'p-ready',
      name: 'cover.png',
      kind: 'cover',
      mimeType: 'image/png',
      sizeBytes: 2048,
      url: '/uploads/cover.png',
      caption: 'Front cover',
      pageOrder: 1,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-01T00:00:00Z',
    },
  ];
  const gens: GenerationRecord[] = [
    {
      id: 'g-1',
      productId: 'p-ready',
      mode: 'manuscript',
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      prompt: 'Write story',
      outputText: 'Once upon a time...',
      createdAt: '2026-10-01T00:00:00Z',
    },
  ];
  const step3 = computeProductReadiness(withPack, assets, gens, []);
  assert.equal(step3.completedMilestones, 3);
  assert.equal(step3.interiorCount, 1);
  assert.equal(step3.hasCover, true);
  assert.equal(step3.hasManuscript, true);
  assert.equal(step3.recommendedStep, 3);

  // Step 4: exported
  const exportsList: ExportArtifact[] = [
    {
      id: 'exp-1',
      productId: 'p-ready',
      format: 'pdf',
      trimSize: '8.5x8.5',
      includeBleed: true,
      pageCount: 1,
      fileName: 'sunny-meadow.pdf',
      sizeBytes: 50000,
      downloadUrl: '/exports/sunny-meadow.pdf',
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-01T00:00:00Z',
    },
  ];
  const step4 = computeProductReadiness(withPack, assets, gens, exportsList);
  assert.equal(step4.completedMilestones, 4);
  assert.equal(step4.recommendedStep, 4);
});

test('sanitizeTextForPdf normalizes smart quotes, dashes, and strips unsupported emoji for WinAnsi PDF fonts', () => {
  const raw = '“Good morning,” said Zebo — wagging his tail… 🐶✨\nLet’s explore!';
  const clean = sanitizeTextForPdf(raw);
  assert.ok(clean.includes('"Good morning,"'));
  assert.ok(clean.includes(' - '));
  assert.ok(clean.includes('...'));
  assert.ok(clean.includes("Let's explore!"));
  assert.equal(/[^\x0A\x20-\xFF]/.test(clean), false);
});

test('isLikelyPromptNotStory detects raw AI prompts and trend briefs so they never print as book story text', () => {
  assert.equal(
    isLikelyPromptNotStory('High-resolution full-bleed illustration of a happy dog in a sunny park'),
    true
  );
  assert.equal(
    isLikelyPromptNotStory('Source Trend: Cozy Bedtime Owls\nWinning Angle: Short rhythmic pages'),
    true
  );
  assert.equal(
    isLikelyPromptNotStory('Zebo sniffed the bright yellow daisies and barked hello to a tiny blue butterfly.'),
    false
  );
});

test('parseManuscriptIntoPageTexts extracts clean read-aloud pages and strips visual notes & KDP metadata', () => {
  const manuscript = [
    'Spread 1:',
    'Zebo stretched his furry paws in the golden morning sun. Today felt like a day for a big adventure!',
    '[Visual: Wide angle of sunlit bedroom with a playful puppy]',
    '',
    'Spread 2:',
    'Out in the backyard meadow, Zebo spotted a fluttering blue butterfly dancing over the clovers.',
    'Illustration note: Low-angle tracking shot in lush grass.',
    '',
    'Spread 3:',
    'When the stars peeked out at twilight, Zebo curled up on his cozy blanket and dreamed of tomorrow.',
    '',
    'KDP Listing & Keywords:',
    'Subtitle: A Bedtime Story for Kids Ages 3-6',
    'Keywords: dog bedtime book, puppy picture book',
  ].join('\n');

  const pages = parseManuscriptIntoPageTexts(manuscript, 10);
  assert.equal(pages.length, 3);
  assert.ok(pages[0].includes('Zebo stretched his furry paws'));
  assert.equal(pages[0].includes('Visual:'), false);
  assert.ok(pages[1].includes('fluttering blue butterfly'));
  assert.equal(pages[1].includes('Illustration note:'), false);
  assert.ok(pages[2].includes('stars peeked out'));

  // Trend metadata brief alone should return empty array rather than printing trend notes on pages
  const trendBriefOnly = 'Source Trend: Cozy Bakery\nTarget Audience: Adults\nWinning Angle: Thick lines';
  assert.deepEqual(parseManuscriptIntoPageTexts(trendBriefOnly, 6), []);
});

test('buildSceneVariationDirective returns distinct framing directives across consecutive pages', () => {
  const d0 = buildSceneVariationDirective(0, 6);
  const d1 = buildSceneVariationDirective(1, 6);
  const d2 = buildSceneVariationDirective(2, 6);
  assert.notEqual(d0, d1);
  assert.notEqual(d1, d2);
  assert.ok(d0.includes('Page 1 of 6'));
  assert.ok(d2.includes('Page 3 of 6'));
});

test('buildKdpPdfBuffer compiles valid multi-page illustrated book PDFs across layouts and excludes reference photos', async () => {
  const sampleProduct: Product = {
    id: 'prod-pdf-test',
    seriesId: null,
    title: 'Zebo Finds a Rainbow',
    subtitle: 'A Backyard Picture Book',
    category: 'childrens-book',
    status: 'ready-for-kdp',
    trimSize: '8.5x8.5',
    pageCount: 24,
    includeBleed: true,
    isbn: '979-8-1234-5678-0',
    coverAssetId: 'a-cover',
    referenceAssetId: 'a-ref',
    driveFolderId: null,
    sheetsRowSyncedAt: null,
    manuscriptNotes:
      'Page 1: Zebo woke up early and pressed his nose to the cool window glass.\n\nPage 2: Raindrops sparkled like tiny diamonds on every green leaf outside.',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  // Valid 1x1 PNG data URL for embedded raster override
  const tinyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6z8AAAAASUVORK5CYII=';

  const sampleAssets: StorageAsset[] = [
    {
      id: 'a-ref',
      folderId: 'f1',
      productId: sampleProduct.id,
      name: 'zebo-photo.png',
      kind: 'reference',
      mimeType: 'image/png',
      sizeBytes: 68,
      url: '/api/storage/files/nonexistent-ref.png',
      caption: 'Uploaded reference photo',
      pageOrder: 1,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'a-cover',
      folderId: 'f1',
      productId: sampleProduct.id,
      name: 'cover.png',
      kind: 'cover',
      mimeType: 'image/png',
      sizeBytes: 68,
      url: '/api/storage/files/nonexistent-cover.png',
      caption: 'High-resolution cover illustration prompt',
      pageOrder: 2,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'a-p1',
      folderId: 'f1',
      productId: sampleProduct.id,
      name: 'page-1.png',
      kind: 'illustration',
      mimeType: 'image/png',
      sizeBytes: 68,
      url: '/api/storage/files/nonexistent-p1.png',
      caption: 'Prompt: Draw dog by window',
      storyText: 'Zebo pressed his wet nose against the cool morning window.',
      pageOrder: 3,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'a-p2',
      folderId: 'f1',
      productId: sampleProduct.id,
      name: 'page-2.png',
      kind: 'illustration',
      mimeType: 'image/png',
      sizeBytes: 68,
      url: '/api/storage/files/nonexistent-p2.png',
      caption: 'Prompt: Draw dog in rain garden',
      pageOrder: 4,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-01T00:00:00Z',
    },
  ];

  const rasterOverrides = {
    'a-cover': tinyPngDataUrl,
    'a-p1': tinyPngDataUrl,
    'a-p2': tinyPngDataUrl,
  };

  // Classic picture book layout: Title + Cover + 2 interior pages = 4 pages (reference photo excluded)
  const classic = await buildKdpPdfBuffer({
    product: sampleProduct,
    assets: sampleAssets,
    trimSize: '8.5x8.5',
    includeBleed: true,
    includeTitlePage: true,
    includeCaptions: true,
    pageLayout: 'below-image',
    includeCoverTitle: true,
    authorImprint: 'FolioPress Studio',
    rasterOverrides,
  });
  assert.equal(classic.pageCount, 4);
  assert.equal(Buffer.from(classic.pdfBytes.slice(0, 5)).toString('ascii'), '%PDF-');

  // Facing-page spread layout: Title + Cover + (2 * 2) facing spreads = 6 pages
  const facing = await buildKdpPdfBuffer({
    product: sampleProduct,
    assets: sampleAssets,
    trimSize: '8.5x8.5',
    includeBleed: true,
    includeTitlePage: true,
    includeCaptions: true,
    pageLayout: 'facing-page',
    includeCoverTitle: true,
    authorImprint: 'FolioPress Studio',
    rasterOverrides,
  });
  assert.equal(facing.pageCount, 6);
  assert.equal(Buffer.from(facing.pdfBytes.slice(0, 5)).toString('ascii'), '%PDF-');

  // Verify classic xref table compatibility (useObjectStreams: false -> zero /ObjStm, has xref & %%EOF)
  const latin = Buffer.from(classic.pdfBytes).toString('latin1');
  assert.equal(latin.includes('/ObjStm'), false);
  assert.equal(latin.includes('xref'), true);
  assert.equal(latin.trimEnd().endsWith('%%EOF'), true);
});

test('isValidPdfBytes and detectImageFormat guard against corrupt or HTML/JSON error downloads', async () => {
  const { isValidPdfBytes, isValidZipBytes, detectImageFormat } = await import('./kdpPdfBuilder.js');

  // Reject JSON 404 or HTML fallback pages pretending to be PDFs
  assert.equal(isValidPdfBytes(Buffer.from('{"error":"Export file not found."}')), false);
  assert.equal(isValidPdfBytes(Buffer.from('<!doctype html><html><body>413 Payload Too Large</body></html>')), false);
  assert.equal(isValidPdfBytes(Buffer.from('%PDF-1.7\ntruncated without eof')), false);

  // Accept well-formed PDF header + trailer
  const validMinimal = Buffer.from(
    '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n9\n%%EOF\n'
  );
  assert.equal(isValidPdfBytes(validMinimal), true);

  // ZIP magic validation
  assert.equal(isValidZipBytes(Buffer.from('{"error":"missing"}')), false);
  const zipHeader = Buffer.alloc(32);
  zipHeader[0] = 0x50; zipHeader[1] = 0x4b; zipHeader[2] = 0x03; zipHeader[3] = 0x04;
  assert.equal(isValidZipBytes(zipHeader), true);

  // Image magic-byte detection
  assert.equal(detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])), 'png');
  assert.equal(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])), 'jpg');
  assert.equal(detectImageFormat(Buffer.from('<html>not an image</html>')), null);
});



