import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import type {
  KdpTrimSize,
  PageTextLayout,
  Product,
  StorageAsset,
} from '../src/types/workspace.js';
import {
  buildKdpPdfDocument,
  detectImageFormat,
  type LoadedPdfImage,
} from '../src/lib/kdpPdfBuilder.js';
import { UPLOADS_DIR, resolveSafeChildPath } from './store.js';

const PUBLIC_IMAGES_DIR = path.resolve(process.cwd(), 'src', 'assets', 'images');

function readLocalAssetBuffer(asset: StorageAsset): { bytes: Buffer; mime: string } | null {
  if (asset.url.startsWith('/src/assets/images/')) {
    const filename = path.basename(asset.url);
    const safePath = resolveSafeChildPath(PUBLIC_IMAGES_DIR, filename);
    if (fs.existsSync(safePath)) {
      return { bytes: fs.readFileSync(safePath), mime: asset.mimeType };
    }
  }

  if (asset.url.startsWith('/api/storage/files/')) {
    const filename = path.basename(asset.url);
    const safePath = resolveSafeChildPath(UPLOADS_DIR, filename);
    if (fs.existsSync(safePath)) {
      return { bytes: fs.readFileSync(safePath), mime: asset.mimeType };
    }
  }

  return null;
}

function decodeRasterOverride(dataUrl: string): LoadedPdfImage | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  const detected = detectImageFormat(bytes);
  if (!detected) return null;
  return { bytes, format: detected };
}

export interface BuildPdfInput {
  product: Product;
  assets: StorageAsset[];
  trimSize: KdpTrimSize;
  includeBleed: boolean;
  includeTitlePage: boolean;
  includeCaptions: boolean;
  includeCoverTitle?: boolean;
  pageLayout?: PageTextLayout;
  authorImprint: string;
  rasterOverrides?: Record<string, string>; // assetId -> data:image/(png|jpeg);base64,...
}

export async function buildKdpPdfBuffer(
  input: BuildPdfInput
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  return buildKdpPdfDocument({
    product: input.product,
    assets: input.assets,
    trimSize: input.trimSize,
    includeBleed: input.includeBleed,
    includeTitlePage: input.includeTitlePage,
    includeCaptions: input.includeCaptions,
    includeCoverTitle: input.includeCoverTitle,
    pageLayout: input.pageLayout,
    authorImprint: input.authorImprint,
    loadImageBytes: async (asset): Promise<LoadedPdfImage | null> => {
      const overrideDataUrl = input.rasterOverrides?.[asset.id];
      if (overrideDataUrl) {
        const decoded = decodeRasterOverride(overrideDataUrl);
        if (decoded) return decoded;
      }

      const local = readLocalAssetBuffer(asset);
      if (!local) return null;
      const detected = detectImageFormat(local.bytes);
      if (!detected) return null;
      return { bytes: local.bytes, format: detected };
    },
  });
}

export async function buildAssetBundleZip(
  product: Product,
  assets: StorageAsset[]
): Promise<Buffer> {
  const zip = new JSZip();

  zip.file(
    'metadata.json',
    JSON.stringify(
      {
        title: product.title,
        subtitle: product.subtitle,
        category: product.category,
        trimSize: product.trimSize,
        includeBleed: product.includeBleed,
        pageCount: product.pageCount,
        isbn: product.isbn,
        exportedAt: new Date().toISOString(),
        assetCount: assets.length,
        pages: assets.map((a) => ({
          name: a.name,
          kind: a.kind,
          pageOrder: a.pageOrder,
          storyText: a.storyText ?? '',
          textPlacement: a.textPlacement ?? 'below-image',
        })),
      },
      null,
      2
    )
  );

  if (product.manuscriptNotes) {
    zip.file('manuscript.txt', product.manuscriptNotes);
  }

  const folder = zip.folder('assets');
  for (const asset of assets) {
    const local = readLocalAssetBuffer(asset);
    if (local && folder) {
      folder.file(asset.name, local.bytes);
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
