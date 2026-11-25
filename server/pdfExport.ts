import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { KdpTrimSize, Product, StorageAsset } from '../src/types/workspace.js';
import { calculateKdpDimensionsPt } from '../src/lib/workspaceLogic.js';
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

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface BuildPdfInput {
  product: Product;
  assets: StorageAsset[];
  trimSize: KdpTrimSize;
  includeBleed: boolean;
  includeTitlePage: boolean;
  includeCaptions: boolean;
  authorImprint: string;
  rasterOverrides?: Record<string, string>; // assetId -> data:image/png;base64,...
}

export async function buildKdpPdfBuffer(
  input: BuildPdfInput
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  const dims = calculateKdpDimensionsPt(input.trimSize, input.includeBleed);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(input.product.title);
  pdfDoc.setAuthor(input.authorImprint);
  pdfDoc.setSubject(`Amazon KDP Interior (${input.trimSize} in)`);
  pdfDoc.setCreator('FolioPress Digital Product Workspace');

  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const serifRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const sansRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let pageNumber = 0;

  if (input.includeTitlePage) {
    const titlePage = pdfDoc.addPage([dims.widthPt, dims.heightPt]);
    pageNumber += 1;

    titlePage.drawRectangle({
      x: 0,
      y: 0,
      width: dims.widthPt,
      height: dims.heightPt,
      color: rgb(0.99, 0.99, 0.985),
    });

    const titleLines = wrapLines(input.product.title, 26);
    let cursorY = dims.heightPt * 0.64;

    for (const line of titleLines) {
      const textWidth = serifBold.widthOfTextAtSize(line, 28);
      titlePage.drawText(line, {
        x: Math.max(dims.marginPt, (dims.widthPt - textWidth) / 2),
        y: cursorY,
        size: 28,
        font: serifBold,
        color: rgb(0.06, 0.09, 0.16),
      });
      cursorY -= 36;
    }

    if (input.product.subtitle) {
      const subLines = wrapLines(input.product.subtitle, 46);
      cursorY -= 8;
      for (const line of subLines) {
        const w = serifRegular.widthOfTextAtSize(line, 14);
        titlePage.drawText(line, {
          x: Math.max(dims.marginPt, (dims.widthPt - w) / 2),
          y: cursorY,
          size: 14,
          font: serifRegular,
          color: rgb(0.28, 0.34, 0.43),
        });
        cursorY -= 20;
      }
    }

    const imprintText = input.authorImprint || 'FolioPress Studio';
    const imprintWidth = sansRegular.widthOfTextAtSize(imprintText, 10);
    titlePage.drawText(imprintText, {
      x: (dims.widthPt - imprintWidth) / 2,
      y: dims.marginPt + 24,
      size: 10,
      font: sansRegular,
      color: rgb(0.39, 0.45, 0.55),
    });

    const specLine = `Trim ${dims.trimWidthIn} x ${dims.trimHeightIn} in${
      input.includeBleed ? ' (Full Bleed)' : ' (No Bleed)'
    }  |  ISBN ${input.product.isbn || 'Pending'}`;
    const specWidth = sansRegular.widthOfTextAtSize(specLine, 8.5);
    titlePage.drawText(specLine, {
      x: (dims.widthPt - specWidth) / 2,
      y: dims.marginPt + 8,
      size: 8.5,
      font: sansRegular,
      color: rgb(0.55, 0.6, 0.68),
    });
  }

  for (const asset of input.assets) {
    const page = pdfDoc.addPage([dims.widthPt, dims.heightPt]);
    pageNumber += 1;

    page.drawRectangle({
      x: 0,
      y: 0,
      width: dims.widthPt,
      height: dims.heightPt,
      color: rgb(1, 1, 1),
    });

    const captionReserve = input.includeCaptions && asset.caption ? 76 : 24;
    const availW = dims.widthPt - dims.marginPt * 2;
    const availH = dims.heightPt - dims.marginPt * 2 - captionReserve;

    let embeddedImage = null;
    try {
      const overrideDataUrl = input.rasterOverrides?.[asset.id];
      if (overrideDataUrl && overrideDataUrl.startsWith('data:image/png;base64,')) {
        const pngBytes = Buffer.from(
          overrideDataUrl.replace('data:image/png;base64,', ''),
          'base64'
        );
        embeddedImage = await pdfDoc.embedPng(pngBytes);
      } else {
        const local = readLocalAssetBuffer(asset);
        if (local) {
          if (local.mime === 'image/png' || asset.name.toLowerCase().endsWith('.png')) {
            embeddedImage = await pdfDoc.embedPng(local.bytes);
          } else if (
            local.mime === 'image/jpeg' ||
            asset.name.toLowerCase().endsWith('.jpg') ||
            asset.name.toLowerCase().endsWith('.jpeg')
          ) {
            embeddedImage = await pdfDoc.embedJpg(local.bytes);
          }
        }
      }
    } catch {
      embeddedImage = null;
    }

    if (embeddedImage) {
      const scale = Math.min(availW / embeddedImage.width, availH / embeddedImage.height);
      const drawW = embeddedImage.width * scale;
      const drawH = embeddedImage.height * scale;
      const x = (dims.widthPt - drawW) / 2;
      const y = dims.marginPt + captionReserve + (availH - drawH) / 2;

      page.drawImage(embeddedImage, {
        x,
        y,
        width: drawW,
        height: drawH,
      });
    } else {
      // Clean editorial plate fallback when an SVG wasn't rasterized client-side
      page.drawRectangle({
        x: dims.marginPt,
        y: dims.marginPt + captionReserve,
        width: availW,
        height: availH,
        borderColor: rgb(0.82, 0.85, 0.9),
        borderWidth: 1,
        color: rgb(0.97, 0.98, 0.99),
      });
      const label = asset.name;
      const lw = sansRegular.widthOfTextAtSize(label, 12);
      page.drawText(label, {
        x: (dims.widthPt - lw) / 2,
        y: dims.marginPt + captionReserve + availH / 2,
        size: 12,
        font: sansRegular,
        color: rgb(0.35, 0.42, 0.52),
      });
    }

    if (input.includeCaptions && asset.caption) {
      const lines = wrapLines(asset.caption, 62).slice(0, 3);
      let cy = dims.marginPt + 48;
      for (const line of lines) {
        const w = serifRegular.widthOfTextAtSize(line, 12.5);
        page.drawText(line, {
          x: Math.max(dims.marginPt, (dims.widthPt - w) / 2),
          y: cy,
          size: 12.5,
          font: serifRegular,
          color: rgb(0.12, 0.16, 0.23),
        });
        cy -= 17;
      }
    }

    const pgLabel = String(pageNumber);
    const pgWidth = sansRegular.widthOfTextAtSize(pgLabel, 9);
    page.drawText(pgLabel, {
      x: (dims.widthPt - pgWidth) / 2,
      y: 18,
      size: 9,
      font: sansRegular,
      color: rgb(0.5, 0.56, 0.64),
    });
  }

  if (pageNumber === 0) {
    const emptyPage = pdfDoc.addPage([dims.widthPt, dims.heightPt]);
    pageNumber = 1;
    emptyPage.drawText(input.product.title, {
      x: dims.marginPt,
      y: dims.heightPt - dims.marginPt - 32,
      size: 22,
      font: serifBold,
      color: rgb(0.06, 0.09, 0.16),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, pageCount: pageNumber };
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
