import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateKdpDimensionsPt,
  expandPlanToJobs,
  filterProducts,
  formatBytes,
  generateAppsScriptBridge,
  getNextRunnableJob,
  sanitizeFolderSlug,
  transitionJobStatus,
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
  assert.ok(script.includes("SPREADSHEET_ID: 'sheet_123'"));
  assert.ok(script.includes("WORKSPACE_API: 'https://folio.example.com'"));
});
