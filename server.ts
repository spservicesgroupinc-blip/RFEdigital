import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  EXPORTS_DIR,
  UPLOADS_DIR,
  resolveSafeChildPath,
  workspaceStore,
} from './server/store';
import {
  generatePublishingText,
  generateSeriesPlanSteps,
  generateStorybookIllustration,
} from './server/aiGenerator';
import { buildAssetBundleZip, buildKdpPdfBuffer } from './server/pdfExport';
import {
  callAppsScriptHealth,
  callAppsScriptPost,
  readCodeGsSource,
} from './server/appsScriptBridge';
import {
  expandPlanToJobs,
  getNextRunnableJob,
  sanitizeFolderSlug,
  transitionJobStatus,
  validateProductInput,
  validateTokenName,
  type JobAction,
} from './src/lib/workspaceLogic';
import type {
  ApiTokenRecord,
  BatchPlan,
  ExportArtifact,
  GenerationMode,
  GenerationProvider,
  JobItem,
  KdpTrimSize,
  Product,
  ProductCategory,
  ProductStatus,
  Series,
  StorageAsset,
} from './src/types/workspace';

const PORT = 3000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

function requireBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 10 ? token : null;
}

async function executeSingleJob(job: JobItem): Promise<JobItem> {
  const raw = workspaceStore.getRaw();
  const product = raw.products.find((p) => p.id === job.productId);
  if (!product) {
    job.status = 'failed';
    job.errorMessage = 'Target product no longer exists in Library.';
    job.updatedAt = new Date().toISOString();
    workspaceStore.save();
    return job;
  }

  job.status = 'running';
  job.attempts += 1;
  job.errorMessage = null;
  job.updatedAt = new Date().toISOString();
  workspaceStore.save();

  try {
    if (job.stepType === 'manuscript') {
      const generated = await generatePublishingText({
        prompt: job.prompt,
        mode: 'manuscript',
        provider: job.provider,
        productTitle: product.title,
        category: product.category,
      });

      product.manuscriptNotes = product.manuscriptNotes
        ? `${product.manuscriptNotes}\n\n--- ${job.title} ---\n${generated.text}`
        : generated.text;
      product.updatedAt = new Date().toISOString();

      raw.generations.unshift({
        id: `gen-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        mode: 'manuscript',
        provider: job.provider,
        model: generated.model,
        prompt: job.prompt,
        outputText: generated.text,
        createdAt: new Date().toISOString(),
      });

      job.status = 'completed';
      job.resultSummary = `Generated ${generated.text.split(/\s+/).length} words via ${generated.model}.`;
      job.updatedAt = new Date().toISOString();
      workspaceStore.save();
      return job;
    }

    if (job.stepType === 'illustration') {
      const generated = await generateStorybookIllustration({
        prompt: job.prompt,
        stylePreset: 'Editorial gouache storybook illustration',
        provider: job.provider,
        productTitle: product.title,
      });

      const folder = workspaceStore.ensureProductFolder(product);
      const fileName = `${sanitizeFolderSlug(job.title).slice(0, 40)}-${crypto
        .randomUUID()
        .slice(0, 6)}.svg`;
      const targetPath = resolveSafeChildPath(UPLOADS_DIR, fileName);
      const svgBuffer = Buffer.from(generated.svgMarkup, 'utf-8');
      fs.writeFileSync(targetPath, svgBuffer);

      const productAssets = raw.assets.filter((a) => a.productId === product.id);
      const asset: StorageAsset = {
        id: `asset-${crypto.randomUUID().slice(0, 8)}`,
        folderId: folder.id,
        productId: product.id,
        name: fileName,
        kind: 'illustration',
        mimeType: 'image/svg+xml',
        sizeBytes: svgBuffer.byteLength,
        url: `/api/storage/files/${fileName}`,
        caption: generated.caption,
        pageOrder: productAssets.length + 1,
        driveFileId: null,
        driveWebLink: null,
        createdAt: new Date().toISOString(),
      };

      raw.assets.push(asset);
      raw.generations.unshift({
        id: `gen-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        mode: 'illustration',
        provider: job.provider,
        model: generated.model,
        prompt: job.prompt,
        assetId: asset.id,
        createdAt: new Date().toISOString(),
      });

      job.status = 'completed';
      job.resultAssetId = asset.id;
      job.resultSummary = `Saved illustration "${fileName}" to ${folder.path}.`;
      job.updatedAt = new Date().toISOString();
      workspaceStore.save();
      return job;
    }

    if (job.stepType === 'export') {
      const productAssets = raw.assets
        .filter((a) => a.productId === product.id)
        .sort((a, b) => a.pageOrder - b.pageOrder);

      const { pdfBytes, pageCount } = await buildKdpPdfBuffer({
        product,
        assets: productAssets,
        trimSize: product.trimSize,
        includeBleed: product.includeBleed,
        includeTitlePage: true,
        includeCaptions: true,
        authorImprint: raw.settings.authorImprint,
      });

      const fileName = `${sanitizeFolderSlug(product.title)}-${product.trimSize}-${crypto
        .randomUUID()
        .slice(0, 6)}.pdf`;
      const outPath = resolveSafeChildPath(EXPORTS_DIR, fileName);
      fs.writeFileSync(outPath, Buffer.from(pdfBytes));

      const artifact: ExportArtifact = {
        id: `exp-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        format: 'pdf',
        fileName,
        trimSize: product.trimSize,
        includeBleed: product.includeBleed,
        pageCount,
        sizeBytes: pdfBytes.byteLength,
        downloadUrl: `/api/export/download/${fileName}`,
        driveFileId: null,
        driveWebLink: null,
        createdAt: new Date().toISOString(),
      };

      raw.exports.unshift(artifact);
      job.status = 'completed';
      job.resultSummary = `Built ${pageCount}-page KDP PDF (${fileName}).`;
      job.updatedAt = new Date().toISOString();
      workspaceStore.save();
      return job;
    }

    job.status = 'completed';
    job.resultSummary = 'Sync checkpoint verified.';
    job.updatedAt = new Date().toISOString();
    workspaceStore.save();
    return job;
  } catch (err) {
    job.status = 'failed';
    job.errorMessage = err instanceof Error ? err.message : 'Job execution error.';
    job.updatedAt = new Date().toISOString();
    workspaceStore.save();
    return job;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  // --- Workspace Snapshot ---
  app.get('/api/workspace', (_req, res) => {
    res.json(workspaceStore.getSnapshot());
  });

  // --- Module 1: Identity & API Tokens ---
  app.get('/api/identity/tokens', (_req, res) => {
    res.json({ tokens: workspaceStore.getSnapshot().tokens });
  });

  app.post('/api/identity/tokens', (req, res) => {
    const { name, scope } = req.body as {
      name?: string;
      scope?: ApiTokenRecord['scope'];
    };
    const check = validateTokenName(String(name ?? ''));
    if (!check.valid) {
      return res.status(400).json({ error: check.errors.name });
    }
    const validScope: ApiTokenRecord['scope'] =
      scope === 'read-only' || scope === 'read-write' || scope === 'apps-script-trigger'
        ? scope
        : 'apps-script-trigger';
    const created = workspaceStore.createApiToken(String(name).trim(), validScope);
    res.status(201).json(created);
  });

  app.delete('/api/identity/tokens/:id', (req, res) => {
    const removed = workspaceStore.revokeApiToken(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Token not found.' });
    res.json({ ok: true });
  });

  app.patch('/api/identity/settings', (req, res) => {
    const { authorImprint, connectedSpreadsheetId, connectedSpreadsheetUrl, connectedDriveRootId } =
      req.body as {
        authorImprint?: string;
        connectedSpreadsheetId?: string;
        connectedSpreadsheetUrl?: string;
        connectedDriveRootId?: string;
      };
    const raw = workspaceStore.getRaw();
    if (typeof authorImprint === 'string' && authorImprint.trim()) {
      raw.settings.authorImprint = authorImprint.trim().slice(0, 80);
    }
    if (typeof connectedSpreadsheetId === 'string') {
      raw.settings.connectedSpreadsheetId = connectedSpreadsheetId.trim().slice(0, 120);
    }
    if (typeof connectedSpreadsheetUrl === 'string') {
      const cleaned = connectedSpreadsheetUrl.trim();
      if (!cleaned || cleaned.startsWith('https://docs.google.com/spreadsheets/')) {
        raw.settings.connectedSpreadsheetUrl = cleaned;
      }
    }
    if (typeof connectedDriveRootId === 'string') {
      raw.settings.connectedDriveRootId = connectedDriveRootId.trim().slice(0, 120);
    }
    workspaceStore.save();
    res.json({ settings: workspaceStore.getSnapshot().settings });
  });

  // --- Module 2: Library CRUD (Series + Products) ---
  app.post('/api/library/series', (req, res) => {
    const { name, description, targetAge, marketplace } = req.body as Partial<Series>;
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Series name must be at least 2 characters.' });
    }
    const raw = workspaceStore.getRaw();
    const series: Series = {
      id: `ser-${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim().slice(0, 100),
      description: String(description ?? '').trim().slice(0, 400),
      targetAge: String(targetAge ?? 'All Ages').trim().slice(0, 40),
      marketplace:
        marketplace === 'Etsy Digital' || marketplace === 'IngramSpark'
          ? marketplace
          : 'Amazon KDP',
      createdAt: new Date().toISOString(),
    };
    raw.series.unshift(series);
    workspaceStore.save();
    res.status(201).json({ series });
  });

  app.post('/api/library/products', (req, res) => {
    const body = req.body as Partial<Product>;
    const title = String(body.title ?? '');
    const pageCount = Number(body.pageCount ?? 24);
    const category: ProductCategory =
      body.category === 'coloring-book' ||
      body.category === 'art-print' ||
      body.category === 'journal'
        ? body.category
        : 'childrens-book';
    const trimSize: KdpTrimSize =
      body.trimSize === '6x9' || body.trimSize === '8.5x11' || body.trimSize === '8x10'
        ? body.trimSize
        : '8.5x8.5';

    const validation = validateProductInput({ title, pageCount, category, trimSize });
    if (!validation.valid) {
      return res.status(400).json({ error: Object.values(validation.errors)[0], errors: validation.errors });
    }

    const now = new Date().toISOString();
    const product: Product = {
      id: `prod-${crypto.randomUUID().slice(0, 8)}`,
      seriesId: typeof body.seriesId === 'string' && body.seriesId ? body.seriesId : null,
      title: title.trim(),
      subtitle: String(body.subtitle ?? '').trim().slice(0, 160),
      category,
      status:
        body.status === 'in-production' ||
        body.status === 'ready-for-kdp' ||
        body.status === 'published'
          ? body.status
          : 'draft',
      trimSize,
      pageCount,
      includeBleed: Boolean(body.includeBleed ?? true),
      isbn: String(body.isbn ?? '').trim().slice(0, 40) || `979-8-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-0`,
      coverAssetId: null,
      driveFolderId: null,
      sheetsRowSyncedAt: null,
      manuscriptNotes: String(body.manuscriptNotes ?? '').trim().slice(0, 10000),
      createdAt: now,
      updatedAt: now,
    };

    const raw = workspaceStore.getRaw();
    raw.products.unshift(product);
    const folder = workspaceStore.ensureProductFolder(product);
    workspaceStore.save();
    res.status(201).json({ product, folder });
  });

  app.patch('/api/library/products/:id', (req, res) => {
    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const body = req.body as Partial<Product>;
    if (typeof body.title === 'string') {
      if (body.title.trim().length < 2) {
        return res.status(400).json({ error: 'Title must be at least 2 characters.' });
      }
      product.title = body.title.trim().slice(0, 120);
    }
    if (typeof body.subtitle === 'string') product.subtitle = body.subtitle.trim().slice(0, 160);
    if (body.status && ['draft', 'in-production', 'ready-for-kdp', 'published'].includes(body.status)) {
      product.status = body.status as ProductStatus;
    }
    if (body.trimSize && ['8.5x8.5', '6x9', '8.5x11', '8x10'].includes(body.trimSize)) {
      product.trimSize = body.trimSize;
    }
    if (typeof body.pageCount === 'number' && body.pageCount >= 1 && body.pageCount <= 828) {
      product.pageCount = body.pageCount;
    }
    if (typeof body.includeBleed === 'boolean') product.includeBleed = body.includeBleed;
    if (typeof body.isbn === 'string') product.isbn = body.isbn.trim().slice(0, 40);
    if (typeof body.manuscriptNotes === 'string') {
      product.manuscriptNotes = body.manuscriptNotes.slice(0, 10000);
    }
    if (body.seriesId !== undefined) {
      product.seriesId = typeof body.seriesId === 'string' && body.seriesId ? body.seriesId : null;
    }
    if (body.coverAssetId !== undefined) {
      product.coverAssetId = typeof body.coverAssetId === 'string' ? body.coverAssetId : null;
    }
    product.updatedAt = new Date().toISOString();
    workspaceStore.save();
    res.json({ product });
  });

  app.delete('/api/library/products/:id', (req, res) => {
    const raw = workspaceStore.getRaw();
    const exists = raw.products.some((p) => p.id === req.params.id);
    if (!exists) return res.status(404).json({ error: 'Product not found.' });
    raw.products = raw.products.filter((p) => p.id !== req.params.id);
    raw.folders = raw.folders.filter((f) => f.productId !== req.params.id);
    raw.assets = raw.assets.filter((a) => a.productId !== req.params.id);
    raw.plans = raw.plans.filter((p) => p.productId !== req.params.id);
    workspaceStore.save();
    res.json({ ok: true });
  });

  // --- Module 3: Storage (Product Folders & Confined File Uploads) ---
  app.post('/api/storage/upload', (req, res) => {
    const { productId, name, mimeType, dataUrl, kind, caption } = req.body as {
      productId?: string;
      name?: string;
      mimeType?: string;
      dataUrl?: string;
      kind?: StorageAsset['kind'];
      caption?: string;
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });

    const safeMime = mimeType && ALLOWED_MIME_EXT[mimeType] ? mimeType : null;
    if (!safeMime || !dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Upload a valid PNG, JPEG, WebP, or SVG image.' });
    }

    const base64Part = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const buffer = Buffer.from(base64Part, 'base64');
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_UPLOAD_BYTES) {
      return res.status(400).json({ error: 'Image must be non-empty and under 10 MB.' });
    }

    const ext = ALLOWED_MIME_EXT[safeMime];
    const cleanBase = sanitizeFolderSlug((name || 'asset').replace(/\.[^.]+$/, ''));
    const storedName = `${cleanBase}-${crypto.randomUUID().slice(0, 6)}${ext}`;
    const safePath = resolveSafeChildPath(UPLOADS_DIR, storedName);
    fs.writeFileSync(safePath, buffer);

    const folder = workspaceStore.ensureProductFolder(product);
    const existingCount = raw.assets.filter((a) => a.productId === product.id).length;

    const asset: StorageAsset = {
      id: `asset-${crypto.randomUUID().slice(0, 8)}`,
      folderId: folder.id,
      productId: product.id,
      name: storedName,
      kind:
        kind === 'cover' || kind === 'manuscript' || kind === 'export' ? kind : 'illustration',
      mimeType: safeMime,
      sizeBytes: buffer.byteLength,
      url: `/api/storage/files/${storedName}`,
      caption: String(caption ?? '').trim().slice(0, 240),
      pageOrder: existingCount + 1,
      driveFileId: null,
      driveWebLink: null,
      createdAt: new Date().toISOString(),
    };

    raw.assets.push(asset);
    if (asset.kind === 'cover' || !product.coverAssetId) {
      product.coverAssetId = asset.id;
    }
    workspaceStore.save();
    res.status(201).json({ asset });
  });

  app.get('/api/storage/files/:filename', (req, res) => {
    try {
      const safePath = resolveSafeChildPath(UPLOADS_DIR, req.params.filename);
      if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'File not found.' });
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(safePath);
    } catch {
      res.status(400).json({ error: 'Invalid file request.' });
    }
  });

  app.delete('/api/storage/assets/:id', (req, res) => {
    const raw = workspaceStore.getRaw();
    const asset = raw.assets.find((a) => a.id === req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found.' });

    if (asset.url.startsWith('/api/storage/files/')) {
      try {
        const safePath = resolveSafeChildPath(UPLOADS_DIR, path.basename(asset.url));
        if (fs.existsSync(safePath)) fs.unlinkSync(safePath);
      } catch {
        // Ignore cleanup mismatch
      }
    }

    raw.assets = raw.assets.filter((a) => a.id !== req.params.id);
    workspaceStore.save();
    res.json({ ok: true });
  });

  // --- Module 4: Generation (Server-side Gemini + OpenRouter) ---
  app.post('/api/generate/text', async (req, res) => {
    const { productId, prompt, mode, provider, saveToManuscript, openRouterModel } = req.body as {
      productId?: string;
      prompt?: string;
      mode?: GenerationMode;
      provider?: GenerationProvider;
      saveToManuscript?: boolean;
      openRouterModel?: string;
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      return res.status(400).json({ error: 'Enter a prompt of at least 5 characters.' });
    }

    try {
      const chosenMode: GenerationMode = mode === 'kdp-metadata' ? 'kdp-metadata' : 'manuscript';
      const chosenProvider: GenerationProvider = provider === 'openrouter' ? 'openrouter' : 'gemini';

      const result = await generatePublishingText({
        prompt: prompt.trim(),
        mode: chosenMode,
        provider: chosenProvider,
        productTitle: product.title,
        category: product.category,
        openRouterModel,
      });

      const record = {
        id: `gen-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        mode: chosenMode,
        provider: chosenProvider,
        model: result.model,
        prompt: prompt.trim(),
        outputText: result.text,
        createdAt: new Date().toISOString(),
      };
      raw.generations.unshift(record);

      if (saveToManuscript) {
        product.manuscriptNotes = product.manuscriptNotes
          ? `${product.manuscriptNotes}\n\n${result.text}`
          : result.text;
        product.updatedAt = new Date().toISOString();
      }
      workspaceStore.save();

      res.json({ record, product });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Text generation failed.',
      });
    }
  });

  app.post('/api/generate/illustration', async (req, res) => {
    const { productId, prompt, stylePreset, provider, kind } = req.body as {
      productId?: string;
      prompt?: string;
      stylePreset?: string;
      provider?: GenerationProvider;
      kind?: StorageAsset['kind'];
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      return res.status(400).json({ error: 'Enter an illustration prompt of at least 5 characters.' });
    }

    try {
      const chosenProvider: GenerationProvider = provider === 'openrouter' ? 'openrouter' : 'gemini';
      const generated = await generateStorybookIllustration({
        prompt: prompt.trim(),
        stylePreset: stylePreset?.trim() || 'Editorial gouache storybook illustration',
        provider: chosenProvider,
        productTitle: product.title,
      });

      const folder = workspaceStore.ensureProductFolder(product);
      const fileName = `${sanitizeFolderSlug(product.title).slice(0, 28)}-${crypto
        .randomUUID()
        .slice(0, 6)}.svg`;
      const targetPath = resolveSafeChildPath(UPLOADS_DIR, fileName);
      const svgBuffer = Buffer.from(generated.svgMarkup, 'utf-8');
      fs.writeFileSync(targetPath, svgBuffer);

      const existingCount = raw.assets.filter((a) => a.productId === product.id).length;
      const asset: StorageAsset = {
        id: `asset-${crypto.randomUUID().slice(0, 8)}`,
        folderId: folder.id,
        productId: product.id,
        name: fileName,
        kind: kind === 'cover' ? 'cover' : 'illustration',
        mimeType: 'image/svg+xml',
        sizeBytes: svgBuffer.byteLength,
        url: `/api/storage/files/${fileName}`,
        caption: generated.caption,
        pageOrder: existingCount + 1,
        driveFileId: null,
        driveWebLink: null,
        createdAt: new Date().toISOString(),
      };

      raw.assets.push(asset);
      if (asset.kind === 'cover' || !product.coverAssetId) {
        product.coverAssetId = asset.id;
      }

      const record = {
        id: `gen-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        mode: 'illustration' as const,
        provider: chosenProvider,
        model: generated.model,
        prompt: prompt.trim(),
        assetId: asset.id,
        createdAt: new Date().toISOString(),
      };
      raw.generations.unshift(record);
      workspaceStore.save();

      res.json({ record, asset });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Illustration generation failed.',
      });
    }
  });

  app.post('/api/generate/outline', async (req, res) => {
    const { productId, brief, stepCount } = req.body as {
      productId?: string;
      brief?: string;
      stepCount?: number;
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });
    if (!brief || typeof brief !== 'string' || brief.trim().length < 5) {
      return res.status(400).json({ error: 'Describe the outline brief (min 5 characters).' });
    }

    const series = raw.series.find((s) => s.id === product.seriesId);
    try {
      const result = await generateSeriesPlanSteps({
        seriesName: series?.name || 'Standalone Edition',
        productTitle: product.title,
        category: product.category,
        brief: brief.trim(),
        stepCount: Number(stepCount ?? 5),
      });
      res.json(result);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Outline generation failed.',
      });
    }
  });

  // --- Module 5: Planning (Batch Generation Plans) ---
  app.post('/api/plans', (req, res) => {
    const { productId, name, templateId, steps } = req.body as {
      productId?: string;
      name?: string;
      templateId?: string;
      steps?: Array<{ title: string; stepType: 'manuscript' | 'illustration' | 'export'; prompt: string }>;
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Plan name is required.' });
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'Add at least one production step.' });
    }

    const now = new Date().toISOString();
    const plan: BatchPlan = {
      id: `plan-${crypto.randomUUID().slice(0, 8)}`,
      productId: product.id,
      seriesId: product.seriesId,
      name: name.trim().slice(0, 100),
      templateId: String(templateId ?? 'custom'),
      trimSize: product.trimSize,
      steps: steps.map((s, idx) => ({
        id: `step-${crypto.randomUUID().slice(0, 8)}`,
        order: idx + 1,
        title: String(s.title ?? `Step ${idx + 1}`).trim().slice(0, 100),
        stepType:
          s.stepType === 'manuscript' || s.stepType === 'export' ? s.stepType : 'illustration',
        prompt: String(s.prompt ?? '').trim().slice(0, 800),
        queued: false,
      })),
      createdAt: now,
      updatedAt: now,
    };

    raw.plans.unshift(plan);
    workspaceStore.save();
    res.status(201).json({ plan });
  });

  app.post('/api/plans/:id/queue', (req, res) => {
    const raw = workspaceStore.getRaw();
    const plan = raw.plans.find((p) => p.id === req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });

    const product = raw.products.find((p) => p.id === plan.productId);
    const provider: GenerationProvider =
      req.body?.provider === 'openrouter' ? 'openrouter' : 'gemini';

    const payloads = expandPlanToJobs(plan, product?.title || 'Untitled', provider);
    if (payloads.length === 0) {
      return res.status(400).json({ error: 'All steps in this plan are already queued.' });
    }

    const now = new Date().toISOString();
    const createdJobs: JobItem[] = payloads.map((payload, idx) => ({
      ...payload,
      id: `job-${crypto.randomUUID().slice(0, 8)}`,
      createdAt: new Date(Date.now() + idx).toISOString(),
      updatedAt: now,
    }));

    plan.steps = plan.steps.map((s) => ({ ...s, queued: true }));
    plan.updatedAt = now;
    raw.jobs.unshift(...createdJobs);
    workspaceStore.save();

    res.status(201).json({ jobs: createdJobs, plan });
  });

  app.delete('/api/plans/:id', (req, res) => {
    const raw = workspaceStore.getRaw();
    raw.plans = raw.plans.filter((p) => p.id !== req.params.id);
    workspaceStore.save();
    res.json({ ok: true });
  });

  // --- Module 6: Background Jobs Queue ---
  app.get('/api/jobs', (_req, res) => {
    res.json({ jobs: workspaceStore.getSnapshot().jobs });
  });

  app.post('/api/jobs/run-next', async (req, res) => {
    // External Apps Script triggers send X-Apps-Script or Authorization: Bearer fp_live_...
    const hasAppsScriptHeader = Boolean(req.headers['x-apps-script']);
    const authHeader = req.headers.authorization;
    if (hasAppsScriptHeader || (authHeader && authHeader.startsWith('Bearer '))) {
      const token = requireBearerToken(req);
      if (!token || !workspaceStore.verifyApiToken(token)) {
        return res.status(401).json({ error: 'Unauthorized: invalid or revoked Workspace API token.' });
      }
    }

    const raw = workspaceStore.getRaw();
    const requestedId = typeof req.body?.jobId === 'string' ? req.body.jobId : null;
    const job = requestedId
      ? raw.jobs.find((j) => j.id === requestedId && j.status === 'queued')
      : getNextRunnableJob(raw.jobs);

    if (!job) {
      return res.json({ processed: false, message: 'No queued jobs waiting.' });
    }

    const updated = await executeSingleJob(job);
    res.json({ processed: true, job: updated });
  });

  app.post('/api/jobs/:id/action', (req, res) => {
    const raw = workspaceStore.getRaw();
    const job = raw.jobs.find((j) => j.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const action = req.body?.action as JobAction;
    const result = transitionJobStatus(job, action);
    if (!result.ok) {
      return res.status(400).json({ error: result.reason });
    }

    job.status = result.nextStatus;
    if (result.resetError) job.errorMessage = null;
    job.updatedAt = new Date().toISOString();
    workspaceStore.save();
    res.json({ job });
  });

  // --- Module 7: Export (pdf-lib KDP PDF + PNG Bundle ZIP) ---
  app.post('/api/export/pdf', async (req, res) => {
    const {
      productId,
      assetIds,
      trimSize,
      includeBleed,
      includeTitlePage,
      includeCaptions,
      rasterOverrides,
    } = req.body as {
      productId?: string;
      assetIds?: string[];
      trimSize?: KdpTrimSize;
      includeBleed?: boolean;
      includeTitlePage?: boolean;
      includeCaptions?: boolean;
      rasterOverrides?: Record<string, string>;
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });

    const orderedAssets =
      Array.isArray(assetIds) && assetIds.length > 0
        ? assetIds
            .map((id) => raw.assets.find((a) => a.id === id && a.productId === product.id))
            .filter((a): a is StorageAsset => Boolean(a))
        : raw.assets
            .filter((a) => a.productId === product.id)
            .sort((a, b) => a.pageOrder - b.pageOrder);

    const chosenTrim: KdpTrimSize =
      trimSize === '6x9' || trimSize === '8.5x11' || trimSize === '8x10' || trimSize === '8.5x8.5'
        ? trimSize
        : product.trimSize;

    try {
      const { pdfBytes, pageCount } = await buildKdpPdfBuffer({
        product,
        assets: orderedAssets,
        trimSize: chosenTrim,
        includeBleed: Boolean(includeBleed ?? product.includeBleed),
        includeTitlePage: Boolean(includeTitlePage ?? true),
        includeCaptions: Boolean(includeCaptions ?? true),
        authorImprint: raw.settings.authorImprint,
        rasterOverrides,
      });

      const fileName = `${sanitizeFolderSlug(product.title)}-${chosenTrim}-${crypto
        .randomUUID()
        .slice(0, 6)}.pdf`;
      const outPath = resolveSafeChildPath(EXPORTS_DIR, fileName);
      fs.writeFileSync(outPath, Buffer.from(pdfBytes));

      const artifact: ExportArtifact = {
        id: `exp-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        format: 'pdf',
        fileName,
        trimSize: chosenTrim,
        includeBleed: Boolean(includeBleed ?? product.includeBleed),
        pageCount,
        sizeBytes: pdfBytes.byteLength,
        downloadUrl: `/api/export/download/${fileName}`,
        driveFileId: null,
        driveWebLink: null,
        createdAt: new Date().toISOString(),
      };

      raw.exports.unshift(artifact);
      workspaceStore.save();
      res.status(201).json({ artifact });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'PDF assembly failed.',
      });
    }
  });

  app.post('/api/export/bundle', async (req, res) => {
    const { productId, assetIds } = req.body as { productId?: string; assetIds?: string[] };
    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });

    const orderedAssets =
      Array.isArray(assetIds) && assetIds.length > 0
        ? assetIds
            .map((id) => raw.assets.find((a) => a.id === id && a.productId === product.id))
            .filter((a): a is StorageAsset => Boolean(a))
        : raw.assets
            .filter((a) => a.productId === product.id)
            .sort((a, b) => a.pageOrder - b.pageOrder);

    try {
      const zipBuffer = await buildAssetBundleZip(product, orderedAssets);
      const fileName = `${sanitizeFolderSlug(product.title)}-bundle-${crypto
        .randomUUID()
        .slice(0, 6)}.zip`;
      const outPath = resolveSafeChildPath(EXPORTS_DIR, fileName);
      fs.writeFileSync(outPath, zipBuffer);

      const artifact: ExportArtifact = {
        id: `exp-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        format: 'png-bundle',
        fileName,
        trimSize: product.trimSize,
        includeBleed: product.includeBleed,
        pageCount: orderedAssets.length,
        sizeBytes: zipBuffer.byteLength,
        downloadUrl: `/api/export/download/${fileName}`,
        driveFileId: null,
        driveWebLink: null,
        createdAt: new Date().toISOString(),
      };

      raw.exports.unshift(artifact);
      workspaceStore.save();
      res.status(201).json({ artifact });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Bundle packaging failed.',
      });
    }
  });

  app.get('/api/export/download/:filename', (req, res) => {
    try {
      const safePath = resolveSafeChildPath(EXPORTS_DIR, req.params.filename);
      if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'Export file not found.' });
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(safePath)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(safePath);
    } catch {
      res.status(400).json({ error: 'Invalid export filename.' });
    }
  });

  // --- Google Apps Script Web App Bridge (Server-Side APPS_SCRIPT_WEBAPP_URL Secret) ---
  app.get('/api/bridge/code-gs', (_req, res) => {
    try {
      const source = readCodeGsSource();
      res.json({ filename: 'code.gs', source });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Unable to read code.gs.',
      });
    }
  });

  app.get('/api/bridge/status', async (_req, res) => {
    try {
      const health = await callAppsScriptHealth();
      const raw = workspaceStore.getRaw();
      if (health.setup?.spreadsheetId) {
        raw.settings.connectedSpreadsheetId = health.setup.spreadsheetId;
      }
      if (health.setup?.spreadsheetUrl) {
        raw.settings.connectedSpreadsheetUrl = health.setup.spreadsheetUrl;
      }
      if (health.setup?.driveRootId) {
        raw.settings.connectedDriveRootId = health.setup.driveRootId;
      }
      workspaceStore.save();
      res.json(health);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Apps Script health check failed.',
      });
    }
  });

  app.post('/api/bridge/setup', async (_req, res) => {
    try {
      const appUrl = process.env.APP_URL?.trim() || '';
      const setup = await callAppsScriptPost<{
        ok: boolean;
        spreadsheetId?: string;
        spreadsheetUrl?: string;
        driveRootId?: string;
        driveRootUrl?: string;
        triggerInstalled?: boolean;
        initializedAt?: string;
      }>('setup', appUrl ? { appUrl } : {});

      const raw = workspaceStore.getRaw();
      if (setup.spreadsheetId) raw.settings.connectedSpreadsheetId = setup.spreadsheetId;
      if (setup.spreadsheetUrl) raw.settings.connectedSpreadsheetUrl = setup.spreadsheetUrl;
      if (setup.driveRootId) raw.settings.connectedDriveRootId = setup.driveRootId;
      workspaceStore.save();

      res.json(setup);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Apps Script first-run setup failed.',
      });
    }
  });

  app.post('/api/bridge/sync', async (_req, res) => {
    try {
      const raw = workspaceStore.getRaw();
      const result = await callAppsScriptPost<{
        ok: boolean;
        syncedAt?: string;
        setup?: {
          spreadsheetId?: string;
          spreadsheetUrl?: string;
          driveRootId?: string;
        };
        rowsWritten?: Record<string, number>;
      }>('sync', {
        products: raw.products,
        series: raw.series,
        assets: raw.assets,
        jobs: raw.jobs,
      });

      const syncedAt = result.syncedAt || new Date().toISOString();
      raw.settings.appsScriptLastSyncAt = syncedAt;
      if (result.setup?.spreadsheetId) raw.settings.connectedSpreadsheetId = result.setup.spreadsheetId;
      if (result.setup?.spreadsheetUrl) raw.settings.connectedSpreadsheetUrl = result.setup.spreadsheetUrl;
      if (result.setup?.driveRootId) raw.settings.connectedDriveRootId = result.setup.driveRootId;
      raw.products = raw.products.map((p) => ({ ...p, sheetsRowSyncedAt: syncedAt }));
      workspaceStore.save();

      res.json({
        syncedAt,
        rowsWritten: result.rowsWritten ?? { products: raw.products.length, jobs: raw.jobs.length },
        spreadsheetUrl: raw.settings.connectedSpreadsheetUrl,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Apps Script sync failed.',
      });
    }
  });

  // --- Google Workspace Live API Proxies (Client Bearer OAuth Token Only) ---
  app.post('/api/google/sheets/bootstrap', async (req, res) => {
    const token = requireBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Sign in with Google to create a Library Spreadsheet.' });

    try {
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: 'FolioPress — Digital Product Library' },
          sheets: [
            { properties: { title: 'Products' } },
            { properties: { title: 'Series' } },
            { properties: { title: 'Jobs' } },
          ],
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        return res.status(createRes.status).json({ error: `Google Sheets error: ${err.slice(0, 220)}` });
      }

      const sheetData = (await createRes.json()) as {
        spreadsheetId: string;
        spreadsheetUrl: string;
      };

      const raw = workspaceStore.getRaw();
      raw.settings.connectedSpreadsheetId = sheetData.spreadsheetId;
      raw.settings.connectedSpreadsheetUrl = sheetData.spreadsheetUrl;
      workspaceStore.save();

      res.json({
        spreadsheetId: sheetData.spreadsheetId,
        spreadsheetUrl: sheetData.spreadsheetUrl,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Failed to create Google Sheet.',
      });
    }
  });

  app.post('/api/google/sheets/sync', async (req, res) => {
    const token = requireBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Sign in with Google to sync Google Sheets.' });

    const raw = workspaceStore.getRaw();
    const spreadsheetId =
      (typeof req.body?.spreadsheetId === 'string' && req.body.spreadsheetId.trim()) ||
      raw.settings.connectedSpreadsheetId;

    if (!spreadsheetId || !/^[a-zA-Z0-9_-]{10,120}$/.test(spreadsheetId)) {
      return res.status(400).json({ error: 'Connect or create a valid Google Spreadsheet ID first.' });
    }

    try {
      // Inspect spreadsheet tabs first (best practice: never assume hardcoded Sheet1)
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title,spreadsheetUrl`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!metaRes.ok) {
        const err = await metaRes.text();
        return res.status(metaRes.status).json({ error: `Could not open spreadsheet: ${err.slice(0, 200)}` });
      }
      const meta = (await metaRes.json()) as {
        spreadsheetUrl?: string;
        sheets?: Array<{ properties?: { title?: string } }>;
      };
      const tabNames = (meta.sheets ?? [])
        .map((s) => s.properties?.title)
        .filter((t): t is string => Boolean(t));

      const productsTab = tabNames.includes('Products') ? 'Products' : tabNames[0] || 'Products';
      const productRows = [
        ['id', 'title', 'subtitle', 'category', 'status', 'trimSize', 'pageCount', 'bleed', 'isbn', 'updatedAt'],
        ...raw.products.map((p) => [
          p.id,
          p.title,
          p.subtitle,
          p.category,
          p.status,
          p.trimSize,
          String(p.pageCount),
          p.includeBleed ? 'yes' : 'no',
          p.isbn,
          p.updatedAt,
        ]),
      ];

      const valueUpdates: Array<{ range: string; values: string[][] }> = [
        { range: `'${productsTab}'!A1:J${productRows.length}`, values: productRows },
      ];

      if (tabNames.includes('Jobs')) {
        const jobRows = [
          ['id', 'productId', 'title', 'stepType', 'status', 'attempts', 'updatedAt'],
          ...raw.jobs.map((j) => [
            j.id,
            j.productId,
            j.title,
            j.stepType,
            j.status,
            String(j.attempts),
            j.updatedAt,
          ]),
        ];
        valueUpdates.push({ range: `'Jobs'!A1:G${jobRows.length}`, values: jobRows });
      }

      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: valueUpdates,
          }),
        }
      );

      if (!updateRes.ok) {
        const err = await updateRes.text();
        return res.status(updateRes.status).json({ error: `Sheets sync error: ${err.slice(0, 220)}` });
      }

      const syncedAt = new Date().toISOString();
      raw.settings.connectedSpreadsheetId = spreadsheetId;
      if (meta.spreadsheetUrl) raw.settings.connectedSpreadsheetUrl = meta.spreadsheetUrl;
      raw.products = raw.products.map((p) => ({ ...p, sheetsRowSyncedAt: syncedAt }));
      workspaceStore.save();

      res.json({
        syncedAt,
        rowsWritten: raw.products.length,
        spreadsheetUrl: raw.settings.connectedSpreadsheetUrl,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Google Sheets sync failed.',
      });
    }
  });

  app.post('/api/google/drive/upload', async (req, res) => {
    const token = requireBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Sign in with Google to upload files to Google Drive.' });

    const { artifactId, assetId } = req.body as { artifactId?: string; assetId?: string };
    const raw = workspaceStore.getRaw();

    let fileBytes: Buffer | null = null;
    let fileName = '';
    let mimeType = 'application/octet-stream';
    let targetProductId = '';

    if (artifactId) {
      const artifact = raw.exports.find((e) => e.id === artifactId);
      if (!artifact) return res.status(404).json({ error: 'Export artifact not found.' });
      const safePath = resolveSafeChildPath(EXPORTS_DIR, artifact.fileName);
      if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'Export file missing on disk.' });
      fileBytes = fs.readFileSync(safePath);
      fileName = artifact.fileName;
      mimeType = artifact.format === 'pdf' ? 'application/pdf' : 'application/zip';
      targetProductId = artifact.productId;
    } else if (assetId) {
      const asset = raw.assets.find((a) => a.id === assetId);
      if (!asset) return res.status(404).json({ error: 'Asset not found.' });
      const baseDir = asset.url.startsWith('/src/assets/images/')
        ? path.resolve(process.cwd(), 'src', 'assets', 'images')
        : UPLOADS_DIR;
      const safePath = resolveSafeChildPath(baseDir, path.basename(asset.url));
      if (!fs.existsSync(safePath)) return res.status(404).json({ error: 'Asset file missing.' });
      fileBytes = fs.readFileSync(safePath);
      fileName = asset.name;
      mimeType = asset.mimeType;
      targetProductId = asset.productId;
    } else {
      return res.status(400).json({ error: 'Provide an artifactId or assetId to upload.' });
    }

    try {
      const product = raw.products.find((p) => p.id === targetProductId);
      let folderId = product?.driveFolderId || null;

      if (!folderId) {
        const folderRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `FolioPress — ${product?.title || 'Exports'}`,
            mimeType: 'application/vnd.google-apps.folder',
          }),
        });
        if (folderRes.ok) {
          const folderJson = (await folderRes.json()) as { id?: string };
          if (folderJson.id) {
            folderId = folderJson.id;
            if (product) product.driveFolderId = folderId;
            const localFolder = raw.folders.find((f) => f.productId === targetProductId);
            if (localFolder) localFolder.driveFolderId = folderId;
          }
        }
      }

      const boundary = `foliopress_${crypto.randomUUID().replace(/-/g, '')}`;
      const metadata = JSON.stringify({
        name: fileName,
        ...(folderId ? { parents: [folderId] } : {}),
      });
      const multipartBody = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
          'utf-8'
        ),
        fileBytes,
        Buffer.from(`\r\n--${boundary}--`, 'utf-8'),
      ]);

      const uploadRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      if (!uploadRes.ok) {
        const err = await uploadRes.text();
        return res.status(uploadRes.status).json({ error: `Drive upload failed: ${err.slice(0, 220)}` });
      }

      const uploaded = (await uploadRes.json()) as { id: string; webViewLink?: string };
      if (artifactId) {
        const art = raw.exports.find((e) => e.id === artifactId);
        if (art) {
          art.driveFileId = uploaded.id;
          art.driveWebLink = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
        }
      } else if (assetId) {
        const ass = raw.assets.find((a) => a.id === assetId);
        if (ass) {
          ass.driveFileId = uploaded.id;
          ass.driveWebLink = uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`;
        }
      }
      workspaceStore.save();

      res.json({
        driveFileId: uploaded.id,
        driveWebLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Google Drive upload failed.',
      });
    }
  });

  // --- Static / Vite Middleware ---
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FolioPress workspace listening on http://localhost:${PORT}`);
  });
}

startServer();
