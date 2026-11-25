import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  EXPORTS_DIR,
  GALLERY_DIR,
  IS_SERVERLESS,
  UPLOADS_DIR,
  resolveSafeChildPath,
  workspaceStore,
} from './store.js';
import {
  generateProductPromptPackWithAI,
  generatePublishingText,
  generateSeriesPlanSteps,
  generateStorybookIllustration,
} from './aiGenerator.js';
import {
  runLiveTrendDeepDive,
  runLiveTrendMarketScan,
} from './trendsResearch.js';
import { buildAssetBundleZip, buildKdpPdfBuffer } from './pdfExport.js';
import {
  callAppsScriptHealth,
  callAppsScriptPost,
  isAppsScriptConfigured,
  readCodeGsSource,
} from './appsScriptBridge.js';
import {
  buildPlanStepsFromPromptPack,
  buildPromptPackFromConcept,
  expandPlanToJobs,
  getNextRunnableJob,
  mapTrendOpportunityToProjectSeed,
  parseManuscriptIntoSpreads,
  sanitizeFolderSlug,
  syncInteriorPromptsFromManuscript,
  transitionJobStatus,
  validateProductInput,
  validateTokenName,
  type JobAction,
} from '../src/lib/workspaceLogic.js';
import type {
  ApiTokenRecord,
  BatchPlan,
  ExportArtifact,
  GalleryImage,
  GenerationMode,
  GenerationProvider,
  JobItem,
  KdpTrimSize,
  PageTextLayout,
  Product,
  ProductCategory,
  ProductPromptPack,
  ProductStatus,
  Series,
  StorageAsset,
  TrendDeepDive,
  TrendMarketplace,
  TrendOpportunity,
  TrendProductType,
  TrendTimeHorizon,
} from '../src/types/workspace.js';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const REFERENCE_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
};

function parseAndValidatePhotoDataUrl(
  dataUrl: string,
  mimeHint?: string
): { buffer: Buffer; mimeType: string; ext: string } {
  const trimmed = dataUrl.trim();
  const dataUriMatch = trimmed.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  let mimeType = (mimeHint || '').toLowerCase();
  let base64Part = '';

  if (dataUriMatch) {
    mimeType = dataUriMatch[1].toLowerCase();
    base64Part = dataUriMatch[2].replace(/\s+/g, '');
  } else if (mimeType && REFERENCE_MIME_EXT[mimeType]) {
    base64Part = (trimmed.includes(',') ? trimmed.split(',')[1] : trimmed).replace(/\s+/g, '');
  } else {
    throw new Error('Upload a valid PNG, JPEG, or WebP reference photo.');
  }

  const ext = REFERENCE_MIME_EXT[mimeType];
  if (!ext) {
    throw new Error('Reference photo must be a PNG, JPEG, or WebP image.');
  }

  const buffer = Buffer.from(base64Part, 'base64');
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Reference photo must be non-empty and under 10 MB.');
  }

  const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
  return { buffer, mimeType: normalizedMime, ext };
}

function sanitizePromptPack(raw: unknown): ProductPromptPack | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const rawInteriors = Array.isArray(obj.interiorPrompts) ? obj.interiorPrompts : [];
  const interiorPrompts = rawInteriors
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .slice(0, 16)
    .map((item, idx) => ({
      id: String(item.id ?? `page-${idx + 1}`).trim().slice(0, 48) || `page-${idx + 1}`,
      title: String(item.title ?? `Page ${idx + 1}`).trim().slice(0, 100),
      prompt: String(item.prompt ?? '').trim().slice(0, 1500),
      storyText:
        typeof item.storyText === 'string' && item.storyText.trim()
          ? item.storyText.trim().slice(0, 1600)
          : undefined,
      generatedAssetId:
        typeof item.generatedAssetId === 'string' && item.generatedAssetId.trim()
          ? item.generatedAssetId.trim().slice(0, 64)
          : null,
    }));

  return {
    sourceTrendTitle:
      typeof obj.sourceTrendTitle === 'string' && obj.sourceTrendTitle.trim()
        ? obj.sourceTrendTitle.trim().slice(0, 160)
        : undefined,
    targetAudience: String(obj.targetAudience ?? 'General Audience').trim().slice(0, 120),
    conceptSummary: String(obj.conceptSummary ?? '').trim().slice(0, 1200),
    artStylePreset: String(obj.artStylePreset ?? '').trim().slice(0, 260),
    manuscriptPrompt: String(obj.manuscriptPrompt ?? '').trim().slice(0, 2000),
    kdpMetadataPrompt: String(obj.kdpMetadataPrompt ?? '').trim().slice(0, 2000),
    coverPrompt: String(obj.coverPrompt ?? '').trim().slice(0, 2000),
    interiorPrompts,
    updatedAt: new Date().toISOString(),
  };
}

const VALID_PAGE_TEXT_LAYOUTS: PageTextLayout[] = [
  'below-image',
  'overlay-bottom',
  'overlay-top',
  'facing-page',
  'none',
];

function isValidPageTextLayout(val: unknown): val is PageTextLayout {
  return typeof val === 'string' && VALID_PAGE_TEXT_LAYOUTS.includes(val as PageTextLayout);
}

function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string') {
      return raw
        .split(',')
        .map((t) => t.trim().slice(0, 32))
        .filter(Boolean)
        .slice(0, 12);
    }
    return [];
  }
  return raw
    .map((t) => String(t ?? '').trim().slice(0, 32))
    .filter(Boolean)
    .slice(0, 12);
}

async function backupGalleryImageToAppsScript(
  image: GalleryImage,
  base64Data: string
): Promise<void> {
  if (!isAppsScriptConfigured()) return;
  try {
    const res = await callAppsScriptPost<{
      ok: boolean;
      image?: {
        driveFileId?: string;
        driveWebLink?: string;
        driveDownloadUrl?: string;
      };
    }>('uploadGalleryImage', {
      id: image.id,
      name: image.name,
      label: image.label,
      tags: image.tags,
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      base64Data,
      createdAt: image.createdAt,
    });
    if (res.image?.driveFileId) {
      image.driveFileId = res.image.driveFileId;
      image.driveWebLink = res.image.driveWebLink ?? null;
      image.driveDownloadUrl = res.image.driveDownloadUrl ?? null;
      workspaceStore.save();
    }
  } catch (err) {
    console.warn(
      '[FolioPress Gallery] Apps Script backup skipped:',
      err instanceof Error ? err.message : err
    );
  }
}

function saveGalleryImageLocal(input: {
  name?: string;
  label?: string;
  tags?: unknown;
  mimeType?: string;
  dataUrl: string;
}): { image: GalleryImage; base64Data: string } {
  const { buffer, mimeType, ext } = parseAndValidatePhotoDataUrl(input.dataUrl, input.mimeType);
  const cleanOriginal = (input.name || 'photo').replace(/\.[^.]+$/, '').trim();
  const cleanBase = sanitizeFolderSlug(cleanOriginal || 'photo').slice(0, 36);
  const storedName = `gal-${cleanBase}-${crypto.randomUUID().slice(0, 6)}${ext}`;
  const safePath = resolveSafeChildPath(GALLERY_DIR, storedName);
  fs.writeFileSync(safePath, buffer);

  const label =
    typeof input.label === 'string' && input.label.trim()
      ? input.label.trim().slice(0, 100)
      : cleanOriginal.slice(0, 100) || storedName;

  const image: GalleryImage = {
    id: `gal-${crypto.randomUUID().slice(0, 8)}`,
    name: storedName,
    label,
    tags: sanitizeTags(input.tags),
    mimeType,
    sizeBytes: buffer.byteLength,
    url: `/api/gallery/files/${storedName}`,
    driveFileId: null,
    driveWebLink: null,
    driveDownloadUrl: null,
    createdAt: new Date().toISOString(),
  };

  const raw = workspaceStore.getRaw();
  raw.galleryImages.unshift(image);
  return { image, base64Data: buffer.toString('base64') };
}

async function readGalleryImageAsDataUrl(image: GalleryImage | undefined): Promise<string | undefined> {
  if (!image) return undefined;
  const normalizedMime = image.mimeType.toLowerCase();
  if (!REFERENCE_MIME_EXT[normalizedMime]) return undefined;

  try {
    const filename = path.basename(image.url);
    const safePath = resolveSafeChildPath(GALLERY_DIR, filename);
    if (fs.existsSync(safePath)) {
      const buf = fs.readFileSync(safePath);
      if (buf.byteLength > 0 && buf.byteLength <= MAX_UPLOAD_BYTES) {
        return `data:${normalizedMime};base64,${buf.toString('base64')}`;
      }
    }

    // Serverless cold-start fallback: recover binary from Google Drive via Apps Script
    if (image.driveFileId && isAppsScriptConfigured()) {
      const fetched = await callAppsScriptPost<{
        ok: boolean;
        mimeType?: string;
        base64Data?: string;
      }>('getGalleryImage', { driveFileId: image.driveFileId });

      if (fetched.base64Data) {
        const buf = Buffer.from(fetched.base64Data, 'base64');
        if (buf.byteLength > 0 && buf.byteLength <= MAX_UPLOAD_BYTES) {
          try {
            fs.writeFileSync(safePath, buf);
          } catch {
            // Non-fatal cache write error
          }
          const mime = (fetched.mimeType || normalizedMime).toLowerCase();
          return `data:${mime === 'image/jpg' ? 'image/jpeg' : mime};base64,${fetched.base64Data}`;
        }
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function saveReferencePhotoAsset(
  product: Product,
  photo: { name?: string; mimeType?: string; dataUrl: string; caption?: string; saveToGallery?: boolean }
): StorageAsset {
  const { buffer, mimeType, ext } = parseAndValidatePhotoDataUrl(photo.dataUrl, photo.mimeType);
  const cleanBase = sanitizeFolderSlug((photo.name || 'reference-photo').replace(/\.[^.]+$/, '')).slice(0, 32);
  const storedName = `ref-${cleanBase}-${crypto.randomUUID().slice(0, 6)}${ext}`;
  const safePath = resolveSafeChildPath(UPLOADS_DIR, storedName);
  fs.writeFileSync(safePath, buffer);

  const raw = workspaceStore.getRaw();
  const folder = workspaceStore.ensureProductFolder(product);
  const existingCount = raw.assets.filter((a) => a.productId === product.id).length;

  const asset: StorageAsset = {
    id: `asset-${crypto.randomUUID().slice(0, 8)}`,
    folderId: folder.id,
    productId: product.id,
    name: storedName,
    kind: 'reference',
    mimeType,
    sizeBytes: buffer.byteLength,
    url: `/api/storage/files/${storedName}`,
    caption: String(photo.caption ?? 'Uploaded reference photo for AI cartoon & illustration generation')
      .trim()
      .slice(0, 240),
    pageOrder: existingCount + 1,
    driveFileId: null,
    driveWebLink: null,
    createdAt: new Date().toISOString(),
  };

  raw.assets.push(asset);
  product.referenceAssetId = asset.id;

  // Also store in the central Image Gallery so the user can reuse this photo across any book
  if (photo.saveToGallery !== false) {
    const labelGuess = (photo.name || `${product.title} Photo`).replace(/\.[^.]+$/, '').trim();
    const alreadyExists = raw.galleryImages.some(
      (g) => g.sizeBytes === buffer.byteLength && g.label.toLowerCase() === labelGuess.toLowerCase()
    );
    if (!alreadyExists) {
      const { image, base64Data } = saveGalleryImageLocal({
        name: photo.name || `${product.title}-photo`,
        label: labelGuess,
        tags: [product.title.slice(0, 28)],
        mimeType,
        dataUrl: photo.dataUrl,
      });
      void backupGalleryImageToAppsScript(image, base64Data);
    }
  }

  return asset;
}

function readAssetAsDataUrl(asset: StorageAsset | undefined): string | undefined {
  if (!asset || !asset.url.startsWith('/api/storage/files/')) return undefined;
  const normalizedMime = asset.mimeType.toLowerCase();
  if (!REFERENCE_MIME_EXT[normalizedMime]) return undefined;
  try {
    const safePath = resolveSafeChildPath(UPLOADS_DIR, path.basename(asset.url));
    if (!fs.existsSync(safePath)) return undefined;
    const buf = fs.readFileSync(safePath);
    if (buf.byteLength === 0 || buf.byteLength > MAX_UPLOAD_BYTES) return undefined;
    return `data:${normalizedMime};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

interface GeneratedIllustrationResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  caption: string;
  model: string;
}

/** Persist a generated illustration as a StorageAsset and append a generation record.
 *  Shared by the single-illustration and full-book generation endpoints. */
function persistIllustrationAsset(
  raw: ReturnType<typeof workspaceStore.getRaw>,
  product: Product,
  generated: GeneratedIllustrationResult,
  opts: {
    prompt: string;
    provider: GenerationProvider;
    isCover: boolean;
    storyText?: string;
    textPlacement?: PageTextLayout;
    replaceAssetId?: string;
  }
): StorageAsset {
  const folder = workspaceStore.ensureProductFolder(product);
  const fileName = `${sanitizeFolderSlug(product.title).slice(0, 28)}-${crypto
    .randomUUID()
    .slice(0, 6)}${generated.extension}`;
  const targetPath = resolveSafeChildPath(UPLOADS_DIR, fileName);
  fs.writeFileSync(targetPath, generated.buffer);

  const existingTarget =
    typeof opts.replaceAssetId === 'string' && opts.replaceAssetId.trim()
      ? raw.assets.find((a) => a.id === opts.replaceAssetId!.trim() && a.productId === product.id)
      : undefined;

  let asset: StorageAsset;
  if (existingTarget) {
    existingTarget.name = fileName;
    existingTarget.mimeType = generated.mimeType;
    existingTarget.sizeBytes = generated.buffer.byteLength;
    existingTarget.url = `/api/storage/files/${fileName}`;
    existingTarget.caption = generated.caption;
    if (opts.storyText) existingTarget.storyText = opts.storyText;
    if (isValidPageTextLayout(opts.textPlacement)) existingTarget.textPlacement = opts.textPlacement;
    existingTarget.driveFileId = null;
    existingTarget.driveWebLink = null;
    asset = existingTarget;
  } else {
    const existingCount = raw.assets.filter((a) => a.productId === product.id).length;
    asset = {
      id: `asset-${crypto.randomUUID().slice(0, 8)}`,
      folderId: folder.id,
      productId: product.id,
      name: fileName,
      kind: opts.isCover ? 'cover' : 'illustration',
      mimeType: generated.mimeType,
      sizeBytes: generated.buffer.byteLength,
      url: `/api/storage/files/${fileName}`,
      caption: generated.caption,
      storyText: opts.storyText || undefined,
      textPlacement: isValidPageTextLayout(opts.textPlacement) ? opts.textPlacement : undefined,
      pageOrder: existingCount + 1,
      driveFileId: null,
      driveWebLink: null,
      createdAt: new Date().toISOString(),
    };
    raw.assets.push(asset);
    if (asset.kind === 'cover' || !product.coverAssetId) {
      product.coverAssetId = asset.id;
    }
  }

  raw.generations.unshift({
    id: `gen-${crypto.randomUUID().slice(0, 8)}`,
    productId: product.id,
    mode: 'illustration' as const,
    provider: opts.provider,
    model: generated.model,
    prompt: opts.prompt.trim(),
    assetId: asset.id,
    createdAt: new Date().toISOString(),
  });

  return asset;
}

function requireBearerToken(req: express.Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 10 ? token : null;
}

function verifyCronSecret(token: string): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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
      const refAsset = product.referenceAssetId
        ? raw.assets.find((a) => a.id === product.referenceAssetId)
        : undefined;
      const referenceImageDataUrl = readAssetAsDataUrl(refAsset);
      const effectiveProvider: GenerationProvider =
        job.provider === 'openrouter'
          ? 'openrouter'
          : process.env.OPENROUTER_API_KEY?.trim()
            ? 'openrouter'
            : 'gemini';

      const existingIllustrations = raw.assets.filter(
        (a) => a.productId === product.id && a.kind !== 'reference'
      );
      const isCoverJob = /cover/i.test(job.title) && !product.coverAssetId;
      const sceneIdx = existingIllustrations.filter((a) => a.kind !== 'cover').length;

      const manuscriptSpreads = parseManuscriptIntoSpreads(product.manuscriptNotes, 24);
      const matchedSpread = !isCoverJob ? manuscriptSpreads[sceneIdx] : undefined;
      const autoStoryText = matchedSpread?.storyText ?? '';

      const generated = await generateStorybookIllustration({
        prompt: job.prompt,
        stylePreset:
          product.promptPack?.artStylePreset ||
          '3D Animated Storybook Cartoon — charming expressive character, rich lighting, polished children’s book art',
        provider: effectiveProvider,
        productTitle: product.title,
        referenceImageDataUrl,
        sceneIndex: isCoverJob ? undefined : sceneIdx,
        totalScenes: Math.max(4, manuscriptSpreads.length || product.promptPack?.interiorPrompts.length || 4),
        isCover: isCoverJob,
        storyText: autoStoryText || undefined,
        visualNote: matchedSpread?.visualNote || undefined,
      });

      const folder = workspaceStore.ensureProductFolder(product);
      const fileName = `${sanitizeFolderSlug(job.title).slice(0, 40)}-${crypto
        .randomUUID()
        .slice(0, 6)}${generated.extension}`;
      const targetPath = resolveSafeChildPath(UPLOADS_DIR, fileName);
      fs.writeFileSync(targetPath, generated.buffer);

      const productAssets = raw.assets.filter((a) => a.productId === product.id);
      const asset: StorageAsset = {
        id: `asset-${crypto.randomUUID().slice(0, 8)}`,
        folderId: folder.id,
        productId: product.id,
        name: fileName,
        kind: isCoverJob ? 'cover' : 'illustration',
        mimeType: generated.mimeType,
        sizeBytes: generated.buffer.byteLength,
        url: `/api/storage/files/${fileName}`,
        caption: generated.caption,
        storyText: autoStoryText || undefined,
        pageOrder: productAssets.length + 1,
        driveFileId: null,
        driveWebLink: null,
        createdAt: new Date().toISOString(),
      };

      raw.assets.push(asset);
      if (asset.kind === 'cover' || !product.coverAssetId) {
        product.coverAssetId = asset.id;
      }
      raw.generations.unshift({
        id: `gen-${crypto.randomUUID().slice(0, 8)}`,
        productId: product.id,
        mode: 'illustration',
        provider: effectiveProvider,
        model: generated.model,
        prompt: job.prompt,
        assetId: asset.id,
        createdAt: new Date().toISOString(),
      });

      job.status = 'completed';
      job.resultAssetId = asset.id;
      job.resultSummary = `Saved illustration "${fileName}" via ${generated.model}.`;
      job.updatedAt = new Date().toISOString();
      workspaceStore.save();
      return job;
    }

    if (job.stepType === 'export') {
      const productAssets = raw.assets
        .filter((a) => a.productId === product.id && a.kind !== 'reference')
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

export function createApiApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '16mb' }));

  // --- Health Check (Vercel & uptime monitoring) ---
  app.get('/api/health', (_req, res) => {
    const { settings } = workspaceStore.getSnapshot();
    res.json({
      ok: true,
      runtime: IS_SERVERLESS ? 'vercel-serverless' : 'node-server',
      openRouterConfigured: settings.openRouterConfigured,
      geminiConfigured: settings.geminiConfigured,
      appsScriptConfigured: settings.appsScriptConfigured,
    });
  });

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
    const body = req.body as Partial<Product> & {
      referencePhoto?: { name?: string; mimeType?: string; dataUrl?: string };
    };
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

    if (body.referencePhoto?.dataUrl) {
      try {
        parseAndValidatePhotoDataUrl(body.referencePhoto.dataUrl, body.referencePhoto.mimeType);
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : 'Invalid reference photo upload.',
        });
      }
    }

    const now = new Date().toISOString();
    const cleanedNotes = String(body.manuscriptNotes ?? '').trim().slice(0, 10000);
    const providedPack = sanitizePromptPack(body.promptPack);
    const initialPack =
      providedPack ??
      buildPromptPackFromConcept({
        title: title.trim(),
        subtitle: String(body.subtitle ?? '').trim().slice(0, 160),
        category,
        trimSize,
        pageCount,
        concept: cleanedNotes || String(body.subtitle ?? '').trim() || title.trim(),
      });

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
      referenceAssetId: null,
      driveFolderId: null,
      sheetsRowSyncedAt: null,
      manuscriptNotes: cleanedNotes,
      promptPack: initialPack,
      createdAt: now,
      updatedAt: now,
    };

    const raw = workspaceStore.getRaw();
    raw.products.unshift(product);
    const folder = workspaceStore.ensureProductFolder(product);

    let referenceAsset: StorageAsset | null = null;
    if (body.referencePhoto?.dataUrl) {
      referenceAsset = saveReferencePhotoAsset(product, {
        name: body.referencePhoto.name,
        mimeType: body.referencePhoto.mimeType,
        dataUrl: body.referencePhoto.dataUrl,
      });
    }

    workspaceStore.save();
    res.status(201).json({ product, folder, referenceAsset });
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
    if (body.referenceAssetId !== undefined) {
      product.referenceAssetId =
        typeof body.referenceAssetId === 'string' ? body.referenceAssetId : null;
    }
    if (body.category && ['childrens-book', 'coloring-book', 'art-print', 'journal'].includes(body.category)) {
      product.category = body.category;
    }
    if (body.promptPack !== undefined) {
      product.promptPack = body.promptPack === null ? null : sanitizePromptPack(body.promptPack);
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
        kind === 'cover' || kind === 'manuscript' || kind === 'export' || kind === 'reference'
          ? kind
          : 'illustration',
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
    if (asset.kind === 'reference') {
      product.referenceAssetId = asset.id;
      if (REFERENCE_MIME_EXT[safeMime]) {
        const labelGuess = (name || `${product.title} Photo`).replace(/\.[^.]+$/, '').trim();
        const dup = raw.galleryImages.some(
          (g) => g.sizeBytes === buffer.byteLength && g.label.toLowerCase() === labelGuess.toLowerCase()
        );
        if (!dup) {
          const { image, base64Data } = saveGalleryImageLocal({
            name: name || storedName,
            label: labelGuess,
            tags: [product.title.slice(0, 28)],
            mimeType: safeMime,
            dataUrl,
          });
          void backupGalleryImageToAppsScript(image, base64Data);
        }
      }
    } else if (asset.kind === 'cover' || !product.coverAssetId) {
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

  app.patch('/api/storage/assets/:id', (req, res) => {
    const raw = workspaceStore.getRaw();
    const asset = raw.assets.find((a) => a.id === req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found.' });

    const { storyText, textPlacement, caption, pageOrder, kind } = req.body as {
      storyText?: string;
      textPlacement?: PageTextLayout | '';
      caption?: string;
      pageOrder?: number;
      kind?: StorageAsset['kind'];
    };

    if (typeof storyText === 'string') {
      asset.storyText = storyText.trim().slice(0, 1600);
    }
    if (textPlacement === '') {
      asset.textPlacement = undefined;
    } else if (isValidPageTextLayout(textPlacement)) {
      asset.textPlacement = textPlacement;
    }
    if (typeof caption === 'string') {
      asset.caption = caption.trim().slice(0, 240);
    }
    if (typeof pageOrder === 'number' && Number.isFinite(pageOrder) && pageOrder >= 1 && pageOrder <= 999) {
      asset.pageOrder = Math.round(pageOrder);
    }
    if (
      kind === 'cover' ||
      kind === 'illustration' ||
      kind === 'manuscript' ||
      kind === 'export' ||
      kind === 'reference'
    ) {
      asset.kind = kind;
    }

    workspaceStore.save();
    res.json({ asset });
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

  // --- Uploaded Image Gallery (Reusable Reference Photos + Apps Script Drive Sync) ---
  app.get('/api/gallery', (_req, res) => {
    res.json({ galleryImages: workspaceStore.getSnapshot().galleryImages });
  });

  app.post('/api/gallery/upload', async (req, res) => {
    const { name, label, tags, mimeType, dataUrl } = req.body as {
      name?: string;
      label?: string;
      tags?: unknown;
      mimeType?: string;
      dataUrl?: string;
    };

    if (!dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Upload a valid PNG, JPEG, or WebP image.' });
    }

    try {
      const { image, base64Data } = saveGalleryImageLocal({
        name,
        label,
        tags,
        mimeType,
        dataUrl,
      });
      workspaceStore.save();

      // Backup to Google Drive & Image_Gallery sheet via Apps Script if configured
      await backupGalleryImageToAppsScript(image, base64Data);

      res.status(201).json({ image });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Invalid gallery image upload.',
      });
    }
  });

  app.get('/api/gallery/files/:filename', async (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const safePath = resolveSafeChildPath(GALLERY_DIR, filename);
      if (fs.existsSync(safePath)) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.sendFile(safePath);
      }

      // Cold-start recovery from Google Drive via Apps Script
      const raw = workspaceStore.getRaw();
      const record = raw.galleryImages.find((g) => path.basename(g.url) === filename);
      if (record?.driveFileId && isAppsScriptConfigured()) {
        const fetched = await callAppsScriptPost<{
          ok: boolean;
          mimeType?: string;
          base64Data?: string;
        }>('getGalleryImage', { driveFileId: record.driveFileId });

        if (fetched.base64Data) {
          const buf = Buffer.from(fetched.base64Data, 'base64');
          try {
            fs.writeFileSync(safePath, buf);
          } catch {
            // Ignore cache write error
          }
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Type', fetched.mimeType || record.mimeType || 'image/png');
          return res.send(buf);
        }
      }

      return res.status(404).json({ error: 'Gallery image not found.' });
    } catch {
      return res.status(400).json({ error: 'Invalid gallery filename.' });
    }
  });

  app.patch('/api/gallery/:id', (req, res) => {
    const raw = workspaceStore.getRaw();
    const image = raw.galleryImages.find((g) => g.id === req.params.id);
    if (!image) return res.status(404).json({ error: 'Gallery image not found.' });

    const { label, tags } = req.body as { label?: string; tags?: unknown };
    if (typeof label === 'string' && label.trim()) {
      image.label = label.trim().slice(0, 100);
    }
    if (tags !== undefined) {
      image.tags = sanitizeTags(tags);
    }
    workspaceStore.save();
    res.json({ image });
  });

  app.delete('/api/gallery/:id', async (req, res) => {
    const raw = workspaceStore.getRaw();
    const image = raw.galleryImages.find((g) => g.id === req.params.id);
    if (!image) return res.status(404).json({ error: 'Gallery image not found.' });

    try {
      const safePath = resolveSafeChildPath(GALLERY_DIR, path.basename(image.url));
      if (fs.existsSync(safePath)) fs.unlinkSync(safePath);
    } catch {
      // Ignore cleanup mismatch
    }

    if (image.driveFileId && isAppsScriptConfigured()) {
      try {
        await callAppsScriptPost('deleteGalleryImage', {
          id: image.id,
          driveFileId: image.driveFileId,
        });
      } catch {
        // Non-blocking remote delete failure
      }
    }

    raw.galleryImages = raw.galleryImages.filter((g) => g.id !== req.params.id);
    workspaceStore.save();
    res.json({ ok: true });
  });

  app.post('/api/gallery/sync', async (_req, res) => {
    if (!isAppsScriptConfigured()) {
      return res.status(400).json({
        error: 'Configure APPS_SCRIPT_WEBAPP_URL in Settings & Sync before syncing the gallery.',
      });
    }

    try {
      const raw = workspaceStore.getRaw();
      let uploaded = 0;

      // 1. Push any local gallery images that do not yet have a Drive file ID
      for (const img of raw.galleryImages) {
        if (!img.driveFileId) {
          const safePath = resolveSafeChildPath(GALLERY_DIR, path.basename(img.url));
          if (fs.existsSync(safePath)) {
            const base64Data = fs.readFileSync(safePath).toString('base64');
            await backupGalleryImageToAppsScript(img, base64Data);
            if (img.driveFileId) uploaded += 1;
          }
        }
      }

      // 2. Pull any remote Image_Gallery records stored in Google Sheets / Drive
      const remote = await callAppsScriptPost<{
        ok: boolean;
        images?: Array<{
          id?: string;
          name?: string;
          label?: string;
          tags?: string[];
          mimeType?: string;
          sizeBytes?: number;
          driveFileId?: string;
          driveWebLink?: string;
          driveDownloadUrl?: string;
          createdAt?: string;
        }>;
      }>('listGalleryImages', {});

      let pulled = 0;
      for (const item of remote.images ?? []) {
        if (!item.id || !item.driveFileId) continue;
        const exists = raw.galleryImages.some(
          (g) => g.id === item.id || (item.driveFileId && g.driveFileId === item.driveFileId)
        );
        if (!exists) {
          const ext = REFERENCE_MIME_EXT[(item.mimeType || 'image/png').toLowerCase()] || '.png';
          const storedName = item.name && !item.name.includes('/')
            ? item.name
            : `gal-${sanitizeFolderSlug(item.label || item.id).slice(0, 32)}${ext}`;
          raw.galleryImages.push({
            id: item.id,
            name: storedName,
            label: item.label || storedName,
            tags: sanitizeTags(item.tags),
            mimeType: item.mimeType || 'image/png',
            sizeBytes: Number(item.sizeBytes || 0),
            url: `/api/gallery/files/${storedName}`,
            driveFileId: item.driveFileId,
            driveWebLink: item.driveWebLink || null,
            driveDownloadUrl: item.driveDownloadUrl || null,
            createdAt: item.createdAt || new Date().toISOString(),
          });
          pulled += 1;
        }
      }

      workspaceStore.save();
      res.json({
        ok: true,
        uploaded,
        pulled,
        total: raw.galleryImages.length,
        galleryImages: raw.galleryImages,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Apps Script gallery sync failed.',
      });
    }
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
        if (chosenMode === 'kdp-metadata') {
          product.manuscriptNotes = product.manuscriptNotes
            ? `${product.manuscriptNotes}\n\n--- KDP Listing & Metadata ---\n${result.text}`
            : `--- KDP Listing & Metadata ---\n${result.text}`;
        } else {
          // Keep any leading [TREND RESEARCH BRIEF] separated with --- so spread parser extracts the fresh story cleanly
          const existing = (product.manuscriptNotes ?? '').trim();
          if (existing.startsWith('[TREND RESEARCH BRIEF]')) {
            const splitIdx = existing.search(/\n---\s/);
            const briefOnly = splitIdx > 0 ? existing.slice(0, splitIdx).trim() : existing;
            product.manuscriptNotes = `${briefOnly}\n\n---\n\n${result.text}`;
          } else {
            product.manuscriptNotes = result.text;
          }

          // Automatically align the product's interior illustration prompts to the freshly generated story spreads!
          const syncedInteriors = syncInteriorPromptsFromManuscript({
            manuscriptNotes: product.manuscriptNotes,
            productTitle: product.title,
            artStylePreset: product.promptPack?.artStylePreset,
            existingPrompts: product.promptPack?.interiorPrompts,
            maxPages: 12,
          });
          if (syncedInteriors.length > 0 && product.promptPack) {
            product.promptPack = {
              ...product.promptPack,
              interiorPrompts: syncedInteriors,
              updatedAt: new Date().toISOString(),
            };
          }
        }
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
    req.setTimeout(60_000);
    res.setTimeout(60_000);

    const {
      productId,
      prompt,
      stylePreset,
      provider,
      kind,
      openRouterModel,
      referenceImageDataUrl,
      referenceAssetId,
      galleryImageId,
      saveReferenceToProduct,
      referenceFileName,
      sceneIndex,
      totalScenes,
      storyText,
      textPlacement,
      replaceAssetId,
    } = req.body as {
      productId?: string;
      prompt?: string;
      stylePreset?: string;
      provider?: GenerationProvider;
      kind?: StorageAsset['kind'];
      openRouterModel?: string;
      referenceImageDataUrl?: string;
      referenceAssetId?: string;
      galleryImageId?: string;
      saveReferenceToProduct?: boolean;
      referenceFileName?: string;
      sceneIndex?: number;
      totalScenes?: number;
      storyText?: string;
      textPlacement?: PageTextLayout;
      replaceAssetId?: string;
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      return res.status(400).json({ error: 'Enter an illustration prompt of at least 5 characters.' });
    }

    let resolvedReferenceDataUrl: string | undefined;
    if (typeof referenceImageDataUrl === 'string' && referenceImageDataUrl.trim()) {
      try {
        const parsed = parseAndValidatePhotoDataUrl(referenceImageDataUrl);
        resolvedReferenceDataUrl = `data:${parsed.mimeType};base64,${parsed.buffer.toString('base64')}`;
        if (saveReferenceToProduct) {
          saveReferencePhotoAsset(product, {
            name: referenceFileName || `${product.title}-reference`,
            mimeType: parsed.mimeType,
            dataUrl: resolvedReferenceDataUrl,
          });
        }
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : 'Invalid reference photo upload.',
        });
      }
    } else if (typeof galleryImageId === 'string' && galleryImageId.trim()) {
      const galImg = raw.galleryImages.find((g) => g.id === galleryImageId.trim());
      resolvedReferenceDataUrl = await readGalleryImageAsDataUrl(galImg);
    } else if (typeof referenceAssetId === 'string' && referenceAssetId.trim()) {
      const refAsset = raw.assets.find(
        (a) => a.id === referenceAssetId && a.productId === product.id
      );
      resolvedReferenceDataUrl = readAssetAsDataUrl(refAsset);
    }

    try {
      const chosenProvider: GenerationProvider =
        provider === 'openrouter'
          ? 'openrouter'
          : provider === 'gemini'
            ? 'gemini'
            : process.env.OPENROUTER_API_KEY?.trim()
              ? 'openrouter'
              : 'gemini';

      const isCover = kind === 'cover';
      const existingInteriorCount = raw.assets.filter(
        (a) => a.productId === product.id && a.kind !== 'reference' && a.kind !== 'cover'
      ).length;
      const resolvedSceneIndex =
        typeof sceneIndex === 'number' && Number.isFinite(sceneIndex) && sceneIndex >= 0
          ? Math.floor(sceneIndex)
          : isCover
            ? undefined
            : existingInteriorCount;
      const manuscriptSpreads = parseManuscriptIntoSpreads(product.manuscriptNotes, 24);
      const resolvedTotalScenes =
        typeof totalScenes === 'number' && Number.isFinite(totalScenes) && totalScenes >= 1
          ? Math.floor(totalScenes)
          : Math.max(4, manuscriptSpreads.length || product.promptPack?.interiorPrompts.length || 4);

      // CRITICAL: Resolve storyText & author visualNote BEFORE generating the illustration
      // so the AI image model depicts the exact scene, setting, props, and action from the story!
      const matchIdx = resolvedSceneIndex ?? existingInteriorCount;
      const matchedSpread = !isCover ? manuscriptSpreads[matchIdx] : undefined;
      let resolvedStoryText = typeof storyText === 'string' ? storyText.trim().slice(0, 1600) : '';
      if (!resolvedStoryText && !isCover && matchedSpread?.storyText) {
        resolvedStoryText = matchedSpread.storyText;
      }
      const resolvedVisualNote = !isCover ? matchedSpread?.visualNote ?? '' : '';

      const generated = await generateStorybookIllustration({
        prompt: prompt.trim(),
        stylePreset:
          stylePreset?.trim() ||
          '3D Animated Storybook Cartoon — charming expressive character, rich lighting, polished children’s book art',
        provider: chosenProvider,
        productTitle: product.title,
        referenceImageDataUrl: resolvedReferenceDataUrl,
        openRouterModel: typeof openRouterModel === 'string' ? openRouterModel.trim() : undefined,
        sceneIndex: resolvedSceneIndex,
        totalScenes: resolvedTotalScenes,
        isCover,
        storyText: resolvedStoryText || undefined,
        visualNote: resolvedVisualNote || undefined,
      });

      const asset = persistIllustrationAsset(raw, product, generated, {
        prompt,
        provider: chosenProvider,
        isCover,
        storyText: resolvedStoryText || undefined,
        textPlacement,
        replaceAssetId,
      });
      workspaceStore.save();

      const record = raw.generations[0];
      res.json({ record, asset, product });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Illustration generation failed.',
      });
    }
  });

  // One-click "Generate Book": manuscript -> synced interior prompts -> cover ->
  // each interior illustration -> assembled KDP PDF. Partial results are saved
  // after every step so a mid-run failure leaves a recoverable product.
  app.post('/api/generate/product', async (req, res) => {
    req.setTimeout(5 * 60_000);
    res.setTimeout(5 * 60_000);

    const { productId, provider, openRouterModel } = req.body as {
      productId?: string;
      provider?: GenerationProvider;
      openRouterModel?: string;
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });

    const chosenProvider: GenerationProvider =
      provider === 'openrouter'
        ? 'openrouter'
        : provider === 'gemini'
          ? 'gemini'
          : process.env.OPENROUTER_API_KEY?.trim()
            ? 'openrouter'
            : 'gemini';

    const stylePreset =
      product.promptPack?.artStylePreset?.trim() ||
      '3D Animated Storybook Cartoon — charming expressive character, rich lighting, polished children’s book art';

    try {
      // 1) Manuscript + auto-sync interior prompts to the story
      if (product.promptPack?.manuscriptPrompt) {
        const textResult = await generatePublishingText({
          prompt: product.promptPack.manuscriptPrompt.trim(),
          mode: 'manuscript',
          provider: chosenProvider,
          productTitle: product.title,
          category: product.category,
          openRouterModel: typeof openRouterModel === 'string' ? openRouterModel.trim() : undefined,
        });

        const existing = (product.manuscriptNotes ?? '').trim();
        if (existing.startsWith('[TREND RESEARCH BRIEF]')) {
          const splitIdx = existing.search(/\n---\s/);
          const briefOnly = splitIdx > 0 ? existing.slice(0, splitIdx).trim() : existing;
          product.manuscriptNotes = `${briefOnly}\n\n---\n\n${textResult.text}`;
        } else {
          product.manuscriptNotes = textResult.text;
        }

        const syncedInteriors = syncInteriorPromptsFromManuscript({
          manuscriptNotes: product.manuscriptNotes,
          productTitle: product.title,
          artStylePreset: product.promptPack.artStylePreset,
          existingPrompts: product.promptPack.interiorPrompts,
          maxPages: 12,
        });
        if (syncedInteriors.length > 0) {
          product.promptPack = {
            ...product.promptPack,
            interiorPrompts: syncedInteriors,
            updatedAt: new Date().toISOString(),
          };
        }
        product.updatedAt = new Date().toISOString();
        workspaceStore.save();
      }

      const manuscriptSpreads = parseManuscriptIntoSpreads(product.manuscriptNotes, 24);

      // 2) Cover
      if (product.promptPack?.coverPrompt) {
        const cover = await generateStorybookIllustration({
          prompt: product.promptPack.coverPrompt.trim(),
          stylePreset,
          provider: chosenProvider,
          productTitle: product.title,
          openRouterModel: typeof openRouterModel === 'string' ? openRouterModel.trim() : undefined,
          isCover: true,
        });
        persistIllustrationAsset(raw, product, cover, {
          prompt: product.promptPack.coverPrompt,
          provider: chosenProvider,
          isCover: true,
        });
        workspaceStore.save();
      }

      // 3) Interior illustrations, matched to the synced prompts + story spreads
      const interiorPrompts = product.promptPack?.interiorPrompts ?? [];
      const sceneCount = Math.max(interiorPrompts.length, 4);
      for (let i = 0; i < interiorPrompts.length; i++) {
        const prompt = interiorPrompts[i].prompt?.trim() || interiorPrompts[i].title.trim();
        if (!prompt) continue;
        const spread = manuscriptSpreads[i];
        const illustration = await generateStorybookIllustration({
          prompt,
          stylePreset,
          provider: chosenProvider,
          productTitle: product.title,
          openRouterModel: typeof openRouterModel === 'string' ? openRouterModel.trim() : undefined,
          sceneIndex: i,
          totalScenes: sceneCount,
          isCover: false,
          storyText: spread?.storyText || undefined,
          visualNote: spread?.visualNote || undefined,
        });
        persistIllustrationAsset(raw, product, illustration, {
          prompt,
          provider: chosenProvider,
          isCover: false,
          storyText: spread?.storyText || undefined,
        });
        workspaceStore.save();
      }

      // 4) Assemble and save the KDP PDF
      const orderedAssets = raw.assets
        .filter((a) => a.productId === product.id && a.kind !== 'reference')
        .sort((a, b) => a.pageOrder - b.pageOrder);

      const { pdfBytes, pageCount } = await buildKdpPdfBuffer({
        product,
        assets: orderedAssets,
        trimSize: product.trimSize,
        includeBleed: Boolean(product.includeBleed),
        includeTitlePage: true,
        includeCaptions: true,
        includeCoverTitle: true,
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
        includeBleed: Boolean(product.includeBleed),
        pageCount,
        sizeBytes: pdfBytes.byteLength,
        downloadUrl: `/api/export/download/${fileName}`,
        driveFileId: null,
        driveWebLink: null,
        createdAt: new Date().toISOString(),
      };
      raw.exports.unshift(artifact);
      product.updatedAt = new Date().toISOString();
      workspaceStore.save();

      res.status(201).json({ artifact, product });
    } catch (err) {
      workspaceStore.save();
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Full book generation failed.',
      });
    }
  });

  app.post('/api/generate/outline', async (req, res) => {
    const { productId, productTitle, category, brief, stepCount } = req.body as {
      productId?: string;
      productTitle?: string;
      category?: ProductCategory;
      brief?: string;
      stepCount?: number;
    };

    const raw = workspaceStore.getRaw();
    const product = productId ? raw.products.find((p) => p.id === productId) : undefined;
    if (!brief || typeof brief !== 'string' || brief.trim().length < 5) {
      return res.status(400).json({ error: 'Describe the outline brief (min 5 characters).' });
    }

    const resolvedTitle =
      product?.title ||
      (typeof productTitle === 'string' && productTitle.trim().length >= 2
        ? productTitle.trim().slice(0, 120)
        : 'New Digital Product');
    const resolvedCategory: ProductCategory =
      product?.category ??
      (category === 'coloring-book' || category === 'art-print' || category === 'journal'
        ? category
        : 'childrens-book');
    const series = product?.seriesId ? raw.series.find((s) => s.id === product.seriesId) : undefined;

    try {
      const result = await generateSeriesPlanSteps({
        seriesName: series?.name || 'Standalone Edition',
        productTitle: resolvedTitle,
        category: resolvedCategory,
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

  // --- Module 8: Current Trends Research (Live Web Search + Deep Dive + 1-Click Project Seed) ---
  app.post('/api/ai/trends', async (req, res) => {
    // Allow up to 60 seconds for multi-query live web search
    req.setTimeout(60_000);
    res.setTimeout(60_000);

    // Optional token protection when called externally with Bearer API token or X-Apps-Script
    const hasAppsScriptHeader = Boolean(req.headers['x-apps-script']);
    const authHeader = req.headers.authorization;
    if (hasAppsScriptHeader || (authHeader && authHeader.startsWith('Bearer '))) {
      const token = requireBearerToken(req);
      if (!token || !workspaceStore.verifyApiToken(token)) {
        return res.status(401).json({ error: 'Unauthorized: invalid or revoked Workspace API token.' });
      }
    }

    const body = req.body as {
      mode?: 'scan' | 'deep_dive';
      marketplaces?: unknown;
      productTypes?: unknown;
      timeHorizon?: unknown;
      customTopic?: unknown;
      provider?: GenerationProvider;
      openRouterModel?: string;
      scanId?: string;
      opportunityId?: string;
      opportunity?: TrendOpportunity;
    };

    const mode = body.mode === 'deep_dive' ? 'deep_dive' : 'scan';
    const provider: GenerationProvider =
      body.provider === 'openrouter'
        ? 'openrouter'
        : body.provider === 'gemini'
          ? 'gemini'
          : process.env.OPENROUTER_API_KEY?.trim()
            ? 'openrouter'
            : 'gemini';

    try {
      if (mode === 'scan') {
        const validMarketplaces: TrendMarketplace[] = [
          'Amazon KDP',
          'Etsy',
          'Teachers Pay Teachers',
          'Gumroad',
        ];
        const validProductTypes: TrendProductType[] = [
          'childrens-book',
          'coloring-book',
          'wall-art',
          'flashcards',
          'ebook-planner',
        ];

        const marketplaces = Array.isArray(body.marketplaces)
          ? body.marketplaces.filter((m): m is TrendMarketplace =>
              validMarketplaces.includes(m as TrendMarketplace)
            )
          : [];
        const productTypes = Array.isArray(body.productTypes)
          ? body.productTypes.filter((t): t is TrendProductType =>
              validProductTypes.includes(t as TrendProductType)
            )
          : [];

        if (marketplaces.length === 0) {
          return res.status(400).json({ error: 'Select at least one marketplace to research.' });
        }
        if (productTypes.length === 0) {
          return res.status(400).json({ error: 'Select at least one product type to scan.' });
        }

        const timeHorizon: TrendTimeHorizon =
          body.timeHorizon === 'upcoming_seasonal' ? 'upcoming_seasonal' : 'selling_now';
        const customTopic =
          typeof body.customTopic === 'string' ? body.customTopic.trim().slice(0, 160) : '';

        const scan = await runLiveTrendMarketScan({
          marketplaces,
          productTypes,
          timeHorizon,
          customTopic,
          provider,
          openRouterModel: typeof body.openRouterModel === 'string' ? body.openRouterModel : undefined,
        });

        const raw = workspaceStore.getRaw();
        raw.trendScans.unshift(scan);
        if (raw.trendScans.length > 15) {
          raw.trendScans = raw.trendScans.slice(0, 15);
        }
        workspaceStore.save();

        return res.json({
          scan,
          researched_at: scan.researched_at,
          market_summary: scan.market_summary,
          opportunities: scan.opportunities,
        });
      }

      // mode === 'deep_dive'
      const raw = workspaceStore.getRaw();
      let targetOpportunity = body.opportunity;
      let storedOpportunity: TrendOpportunity | undefined;

      if (body.scanId && body.opportunityId) {
        const storedScan = raw.trendScans.find((s) => s.id === body.scanId);
        storedOpportunity = storedScan?.opportunities.find((o) => o.id === body.opportunityId);
        if (!targetOpportunity && storedOpportunity) {
          targetOpportunity = storedOpportunity;
        }
      }

      if (!targetOpportunity || !targetOpportunity.title) {
        return res.status(400).json({ error: 'Select a valid trend opportunity to deep-dive.' });
      }

      const deepDive = await runLiveTrendDeepDive({
        opportunity: targetOpportunity,
        provider,
        openRouterModel: typeof body.openRouterModel === 'string' ? body.openRouterModel : undefined,
      });

      if (storedOpportunity) {
        storedOpportunity.deep_dive = deepDive;
        workspaceStore.save();
      }

      return res.json({ deepDive });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Live trends research request failed.',
      });
    }
  });

  app.delete('/api/ai/trends/:scanId', (req, res) => {
    const raw = workspaceStore.getRaw();
    const before = raw.trendScans.length;
    raw.trendScans = raw.trendScans.filter((s) => s.id !== req.params.scanId);
    if (raw.trendScans.length === before) {
      return res.status(404).json({ error: 'Trend scan not found.' });
    }
    workspaceStore.save();
    res.json({ ok: true });
  });

  app.post('/api/ai/prompt-pack', async (req, res) => {
    const { productId, concept, targetAudience, artStylePreset, useAi } = req.body as {
      productId?: string;
      concept?: string;
      targetAudience?: string;
      artStylePreset?: string;
      useAi?: boolean;
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) {
      return res.status(404).json({ error: 'Select a valid product first.' });
    }

    const resolvedConcept =
      (typeof concept === 'string' && concept.trim()) ||
      product.promptPack?.conceptSummary ||
      product.manuscriptNotes ||
      product.subtitle ||
      product.title;

    const fallbackPack = buildPromptPackFromConcept({
      title: product.title,
      subtitle: product.subtitle,
      category: product.category,
      trimSize: product.trimSize,
      pageCount: product.pageCount,
      concept: resolvedConcept,
      targetAudience: typeof targetAudience === 'string' ? targetAudience : product.promptPack?.targetAudience,
      artStylePreset: typeof artStylePreset === 'string' ? artStylePreset : product.promptPack?.artStylePreset,
    });

    const result =
      useAi === false
        ? { promptPack: fallbackPack, usedAi: false, model: 'template' }
        : await generateProductPromptPackWithAI({
            title: product.title,
            category: product.category,
            trimSize: product.trimSize,
            pageCount: product.pageCount,
            concept: resolvedConcept,
            targetAudience: fallbackPack.targetAudience,
            artStylePreset: fallbackPack.artStylePreset,
            fallbackPack,
          });

    product.promptPack = result.promptPack;
    product.updatedAt = new Date().toISOString();
    workspaceStore.save();

    res.json({
      product,
      promptPack: result.promptPack,
      usedAi: result.usedAi,
      model: result.model,
    });
  });

  app.post('/api/ai/trends/create-project', async (req, res) => {
    const { opportunity, deepDive, scanId, opportunityId } = req.body as {
      opportunity?: TrendOpportunity;
      deepDive?: TrendDeepDive;
      scanId?: string;
      opportunityId?: string;
    };

    if (!opportunity || !opportunity.title || !opportunity.starter_blueprint) {
      return res.status(400).json({ error: 'Provide a valid trend opportunity to convert.' });
    }

    const resolvedDeepDive = deepDive ?? opportunity.deep_dive;
    const seed = mapTrendOpportunityToProjectSeed(opportunity, resolvedDeepDive);

    // Enrich the editable prompt pack with live AI when configured (graceful instant fallback if unavailable)
    const aiPackResult = await generateProductPromptPackWithAI({
      title: seed.productDraft.title,
      category: seed.productDraft.category,
      trimSize: seed.productDraft.trimSize,
      pageCount: seed.productDraft.pageCount,
      concept: seed.promptPack.conceptSummary,
      targetAudience: seed.promptPack.targetAudience,
      artStylePreset: seed.promptPack.artStylePreset,
      fallbackPack: seed.promptPack,
      marketContext: seed.productDraft.manuscriptNotes,
    });

    const finalPromptPack = aiPackResult.promptPack;
    const finalPlanSteps = buildPlanStepsFromPromptPack(
      {
        title: seed.productDraft.title,
        trimSize: seed.productDraft.trimSize,
        includeBleed: seed.productDraft.includeBleed,
      },
      finalPromptPack
    );

    const now = new Date().toISOString();
    const product: Product = {
      id: `prod-${crypto.randomUUID().slice(0, 8)}`,
      seriesId: null,
      title: seed.productDraft.title,
      subtitle: seed.productDraft.subtitle,
      category: seed.productDraft.category,
      status: seed.productDraft.status,
      trimSize: seed.productDraft.trimSize,
      pageCount: seed.productDraft.pageCount,
      includeBleed: seed.productDraft.includeBleed,
      isbn: `979-8-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-0`,
      coverAssetId: null,
      referenceAssetId: null,
      driveFolderId: null,
      sheetsRowSyncedAt: null,
      manuscriptNotes: seed.productDraft.manuscriptNotes,
      promptPack: finalPromptPack,
      createdAt: now,
      updatedAt: now,
    };

    const raw = workspaceStore.getRaw();
    raw.products.unshift(product);
    const folder = workspaceStore.ensureProductFolder(product);

    const plan: BatchPlan = {
      id: `plan-${crypto.randomUUID().slice(0, 8)}`,
      productId: product.id,
      seriesId: null,
      name: seed.planName,
      templateId: 'trend-blueprint',
      trimSize: product.trimSize,
      steps: finalPlanSteps.map((s, idx) => ({
        id: `step-${crypto.randomUUID().slice(0, 8)}`,
        order: idx + 1,
        title: s.title,
        stepType: s.stepType,
        prompt: s.prompt,
        queued: false,
      })),
      createdAt: now,
      updatedAt: now,
    };
    raw.plans.unshift(plan);

    if (scanId && opportunityId) {
      const scan = raw.trendScans.find((s) => s.id === scanId);
      const target = scan?.opportunities.find((o) => o.id === opportunityId);
      if (target) {
        target.created_project_id = product.id;
      }
    }

    workspaceStore.save();
    res.status(201).json({
      product,
      folder,
      plan,
      usedAi: aiPackResult.usedAi,
    });
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
      req.body?.provider === 'openrouter'
        ? 'openrouter'
        : req.body?.provider === 'gemini'
          ? 'gemini'
          : process.env.OPENROUTER_API_KEY?.trim()
            ? 'openrouter'
            : 'gemini';

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

  app.patch('/api/plans/:id', (req, res) => {
    const raw = workspaceStore.getRaw();
    const plan = raw.plans.find((p) => p.id === req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });

    const { name, steps } = req.body as {
      name?: string;
      steps?: Array<{
        id?: string;
        title: string;
        stepType: 'manuscript' | 'illustration' | 'export';
        prompt: string;
        queued?: boolean;
      }>;
    };

    if (typeof name === 'string' && name.trim().length >= 2) {
      plan.name = name.trim().slice(0, 100);
    }
    if (Array.isArray(steps) && steps.length > 0) {
      plan.steps = steps.map((s, idx) => ({
        id: typeof s.id === 'string' && s.id.trim() ? s.id : `step-${crypto.randomUUID().slice(0, 8)}`,
        order: idx + 1,
        title: String(s.title ?? `Step ${idx + 1}`).trim().slice(0, 100),
        stepType:
          s.stepType === 'manuscript' || s.stepType === 'export' ? s.stepType : 'illustration',
        prompt: String(s.prompt ?? '').trim().slice(0, 1200),
        queued: Boolean(s.queued),
      }));
    }
    plan.updatedAt = new Date().toISOString();
    workspaceStore.save();
    res.json({ plan });
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

  const handleRunNextJob = async (req: express.Request, res: express.Response) => {
    // External triggers (Apps Script or Vercel Cron) send X-Apps-Script or Authorization: Bearer <token>
    const isCronGet = req.method === 'GET';
    const hasAppsScriptHeader = Boolean(req.headers['x-apps-script']);
    const authHeader = req.headers.authorization;
    if (isCronGet || hasAppsScriptHeader || (authHeader && authHeader.startsWith('Bearer '))) {
      const token = requireBearerToken(req);
      const isValidToken = Boolean(
        token && (workspaceStore.verifyApiToken(token) || verifyCronSecret(token))
      );
      if (!isValidToken) {
        return res
          .status(401)
          .json({ error: 'Unauthorized: invalid or missing Workspace API / Cron token.' });
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
  };

  app.post('/api/jobs/run-next', handleRunNextJob);
  app.get('/api/jobs/run-next', handleRunNextJob);

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
      pageLayout,
      includeCoverTitle,
      rasterOverrides,
    } = req.body as {
      productId?: string;
      assetIds?: string[];
      trimSize?: KdpTrimSize;
      includeBleed?: boolean;
      includeTitlePage?: boolean;
      includeCaptions?: boolean;
      pageLayout?: PageTextLayout;
      includeCoverTitle?: boolean;
      rasterOverrides?: Record<string, string>;
    };

    const raw = workspaceStore.getRaw();
    const product = raw.products.find((p) => p.id === productId);
    if (!product) return res.status(400).json({ error: 'Select a valid product.' });

    const orderedAssets =
      Array.isArray(assetIds) && assetIds.length > 0
        ? assetIds
            .map((id) => raw.assets.find((a) => a.id === id && a.productId === product.id && a.kind !== 'reference'))
            .filter((a): a is StorageAsset => Boolean(a))
        : raw.assets
            .filter((a) => a.productId === product.id && a.kind !== 'reference')
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
        pageLayout: isValidPageTextLayout(pageLayout) ? pageLayout : undefined,
        includeCoverTitle: includeCoverTitle !== false,
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
            .filter((a) => a.productId === product.id && a.kind !== 'reference')
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

  app.get('/api/export/download/:filename', async (req, res) => {
    try {
      const safePath = resolveSafeChildPath(EXPORTS_DIR, req.params.filename);
      const baseName = path.basename(safePath);
      const isPdf = baseName.toLowerCase().endsWith('.pdf');
      const isZip = baseName.toLowerCase().endsWith('.zip');
      let fileBytes: Buffer | null = fs.existsSync(safePath) ? fs.readFileSync(safePath) : null;

      // Serverless cold-start recovery: rebuild on demand if /tmp file is missing
      if (!fileBytes) {
        const raw = workspaceStore.getRaw();
        const artifact = raw.exports.find((e) => e.fileName === baseName);
        if (artifact) {
          const product = raw.products.find((p) => p.id === artifact.productId);
          if (product) {
            const orderedAssets = raw.assets
              .filter((a) => a.productId === product.id && a.kind !== 'reference')
              .sort((a, b) => a.pageOrder - b.pageOrder);
            if (isPdf) {
              const { pdfBytes } = await buildKdpPdfBuffer({
                product,
                assets: orderedAssets,
                trimSize: artifact.trimSize,
                includeBleed: artifact.includeBleed,
                includeTitlePage: true,
                includeCaptions: product.category !== 'coloring-book' && product.category !== 'art-print',
                includeCoverTitle: true,
                authorImprint: raw.settings.authorImprint,
              });
              fileBytes = Buffer.from(pdfBytes);
              fs.writeFileSync(safePath, fileBytes);
            } else if (isZip) {
              fileBytes = await buildAssetBundleZip(product, orderedAssets);
              fs.writeFileSync(safePath, fileBytes);
            }
          }
        }
      }

      if (!fileBytes || fileBytes.length === 0) {
        return res.status(404).json({ error: 'Export file not found.' });
      }

      res.setHeader(
        'Content-Type',
        isPdf ? 'application/pdf' : isZip ? 'application/zip' : 'application/octet-stream'
      );
      res.setHeader('Content-Length', String(fileBytes.byteLength));
      res.setHeader('Content-Disposition', `attachment; filename="${baseName.replace(/"/g, '')}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).end(fileBytes);
    } catch {
      return res.status(400).json({ error: 'Invalid export filename.' });
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
        galleryImages: raw.galleryImages,
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

  // Structured JSON error handler for Express / Vercel serverless runtime
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const message = err instanceof Error ? err.message : 'Internal server error.';
      console.error('[FolioPress API Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      }
    }
  );

  return app;
}
