import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type {
  KdpTrimSize,
  PageTextLayout,
  Product,
  StorageAsset,
} from '../src/types/workspace.js';
import {
  calculateKdpDimensionsPt,
  isLikelyPromptNotStory,
  parseManuscriptIntoPageTexts,
  sanitizeTextForPdf,
} from '../src/lib/workspaceLogic.js';
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

/**
 * Wraps text accurately using actual PDF font glyph metrics so story text never overflows KDP margins.
 */
function wrapTextToWidth(
  rawText: string,
  font: PDFFont,
  fontSize: number,
  maxWidthPt: number
): string[] {
  const safe = sanitizeTextForPdf(rawText);
  if (!safe) return [];

  const paragraphs = safe.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const lines: string[] = [];

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const words = paragraphs[pIdx].split(/\s+/).filter(Boolean);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidthPt) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    if (pIdx < paragraphs.length - 1) {
      lines.push(''); // Paragraph spacing marker
    }
  }

  return lines;
}

function drawImageContain(
  page: PDFPage,
  image: PDFImage,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): { drawX: number; drawY: number; drawW: number; drawH: number } {
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const drawX = boxX + (boxW - drawW) / 2;
  const drawY = boxY + (boxH - drawH) / 2;
  page.drawImage(image, { x: drawX, y: drawY, width: drawW, height: drawH });
  return { drawX, drawY, drawW, drawH };
}

function drawImageCover(
  page: PDFPage,
  image: PDFImage,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): void {
  const scale = Math.max(boxW / image.width, boxH / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const drawX = boxX + (boxW - drawW) / 2;
  const drawY = boxY + (boxH - drawH) / 2;
  page.drawImage(image, { x: drawX, y: drawY, width: drawW, height: drawH });
}

function drawPageNumber(
  page: PDFPage,
  pageNumber: number,
  widthPt: number,
  font: PDFFont,
  lightOnDark = false
): void {
  const pgLabel = String(pageNumber);
  const pgWidth = font.widthOfTextAtSize(pgLabel, 9.5);
  page.drawText(pgLabel, {
    x: (widthPt - pgWidth) / 2,
    y: 16,
    size: 9.5,
    font,
    color: lightOnDark ? rgb(0.95, 0.96, 0.98) : rgb(0.45, 0.51, 0.6),
  });
}

function drawCenteredLines(
  page: PDFPage,
  lines: string[],
  centerX: number,
  startY: number,
  font: PDFFont,
  fontSize: number,
  lineHeight: number,
  color: ReturnType<typeof rgb>
): void {
  let y = startY;
  for (const line of lines) {
    if (line === '') {
      y -= lineHeight * 0.55;
      continue;
    }
    const w = font.widthOfTextAtSize(line, fontSize);
    page.drawText(line, {
      x: centerX - w / 2,
      y,
      size: fontSize,
      font,
      color,
    });
    y -= lineHeight;
  }
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
  rasterOverrides?: Record<string, string>; // assetId -> data:image/png;base64,...
}

export async function buildKdpPdfBuffer(
  input: BuildPdfInput
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  const dims = calculateKdpDimensionsPt(input.trimSize, input.includeBleed);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(sanitizeTextForPdf(input.product.title));
  pdfDoc.setAuthor(sanitizeTextForPdf(input.authorImprint || 'FolioPress Studio'));
  pdfDoc.setSubject(`Amazon KDP Illustrated Book (${input.trimSize} in)`);
  pdfDoc.setCreator('FolioPress Digital Product Workspace');

  const serifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const serifRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const sansRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Exclude reference photos from book interior pages
  const bookAssets = input.assets.filter((a) => a.kind !== 'reference');

  // Auto-parse story passages from manuscriptNotes so illustrated pages get clean story text automatically
  const parsedStoryPassages = parseManuscriptIntoPageTexts(
    input.product.manuscriptNotes,
    Math.max(bookAssets.length + 2, 16)
  );

  const defaultLayout: PageTextLayout =
    input.pageLayout ??
    (input.includeCaptions
      ? input.product.category === 'coloring-book' || input.product.category === 'art-print'
        ? 'none'
        : 'below-image'
      : 'none');

  const includeCoverTitle = input.includeCoverTitle ?? true;

  let pageNumber = 0;

  // Optional KDP Title Page (interior page 1)
  if (input.includeTitlePage) {
    const titlePage = pdfDoc.addPage([dims.widthPt, dims.heightPt]);
    pageNumber += 1;

    titlePage.drawRectangle({
      x: 0,
      y: 0,
      width: dims.widthPt,
      height: dims.heightPt,
      color: rgb(0.992, 0.988, 0.978),
    });

    // Subtle editorial inner border frame
    const framePad = dims.marginPt * 0.72;
    titlePage.drawRectangle({
      x: framePad,
      y: framePad,
      width: dims.widthPt - framePad * 2,
      height: dims.heightPt - framePad * 2,
      borderColor: rgb(0.84, 0.86, 0.89),
      borderWidth: 0.75,
    });

    const maxTitleW = dims.widthPt - dims.marginPt * 2.4;
    const titleLines = wrapTextToWidth(input.product.title, serifBold, 30, maxTitleW);
    let cursorY = dims.heightPt * 0.64;

    drawCenteredLines(
      titlePage,
      titleLines,
      dims.widthPt / 2,
      cursorY,
      serifBold,
      30,
      38,
      rgb(0.07, 0.1, 0.17)
    );
    cursorY -= titleLines.length * 38 + 12;

    if (input.product.subtitle) {
      const subLines = wrapTextToWidth(input.product.subtitle, serifItalic, 15, maxTitleW);
      drawCenteredLines(
        titlePage,
        subLines,
        dims.widthPt / 2,
        cursorY,
        serifItalic,
        15,
        22,
        rgb(0.28, 0.34, 0.43)
      );
      cursorY -= subLines.length * 22 + 16;
    }

    // Small centered divider rule
    titlePage.drawRectangle({
      x: dims.widthPt / 2 - 36,
      y: cursorY,
      width: 72,
      height: 1.2,
      color: rgb(0.75, 0.79, 0.85),
    });

    const imprintText = sanitizeTextForPdf(input.authorImprint || 'FolioPress Studio');
    const imprintWidth = sansRegular.widthOfTextAtSize(imprintText, 10.5);
    titlePage.drawText(imprintText, {
      x: (dims.widthPt - imprintWidth) / 2,
      y: dims.marginPt + 30,
      size: 10.5,
      font: sansRegular,
      color: rgb(0.35, 0.42, 0.52),
    });

    const specLine = sanitizeTextForPdf(
      `Trim ${dims.trimWidthIn} x ${dims.trimHeightIn} in${
        input.includeBleed ? ' (Full Bleed)' : ' (No Bleed)'
      }  |  ISBN ${input.product.isbn || 'Pending'}`
    );
    const specWidth = sansRegular.widthOfTextAtSize(specLine, 8.5);
    titlePage.drawText(specLine, {
      x: (dims.widthPt - specWidth) / 2,
      y: dims.marginPt + 12,
      size: 8.5,
      font: sansRegular,
      color: rgb(0.55, 0.6, 0.68),
    });
  }

  let interiorStoryIndex = 0;

  for (const asset of bookAssets) {
    let embeddedImage: PDFImage | null = null;
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

    // 1. Front Cover Page: full-bleed illustration + clean title header banner if enabled
    if (asset.kind === 'cover') {
      const coverPage = pdfDoc.addPage([dims.widthPt, dims.heightPt]);
      pageNumber += 1;

      coverPage.drawRectangle({
        x: 0,
        y: 0,
        width: dims.widthPt,
        height: dims.heightPt,
        color: rgb(0.985, 0.98, 0.968),
      });

      if (embeddedImage) {
        drawImageCover(coverPage, embeddedImage, 0, 0, dims.widthPt, dims.heightPt);
      }

      if (includeCoverTitle && input.product.title.trim()) {
        const maxTitleW = dims.widthPt - dims.marginPt * 2.2;
        const titleLines = wrapTextToWidth(input.product.title, serifBold, 30, maxTitleW).slice(0, 3);
        const subLines = input.product.subtitle
          ? wrapTextToWidth(input.product.subtitle, serifItalic, 13.5, maxTitleW).slice(0, 2)
          : [];
        const bandPadY = 18;
        const bandHeight =
          bandPadY * 2 + titleLines.length * 36 + (subLines.length > 0 ? subLines.length * 18 + 6 : 0);
        const bandX = dims.marginPt * 0.75;
        const bandW = dims.widthPt - bandX * 2;
        const bandY = dims.heightPt - dims.marginPt * 0.85 - bandHeight;

        coverPage.drawRectangle({
          x: bandX,
          y: bandY,
          width: bandW,
          height: bandHeight,
          color: rgb(0.995, 0.99, 0.976),
          opacity: 0.9,
          borderColor: rgb(0.84, 0.81, 0.75),
          borderWidth: 0.9,
        });

        const topTextY = bandY + bandHeight - bandPadY - 24;
        drawCenteredLines(
          coverPage,
          titleLines,
          dims.widthPt / 2,
          topTextY,
          serifBold,
          30,
          36,
          rgb(0.07, 0.1, 0.17)
        );
        if (subLines.length > 0) {
          drawCenteredLines(
            coverPage,
            subLines,
            dims.widthPt / 2,
            topTextY - titleLines.length * 36 - 4,
            serifItalic,
            13.5,
            18,
            rgb(0.28, 0.34, 0.43)
          );
        }
      }

      continue;
    }

    // 2. Interior Illustrated Book Pages: resolve clean story text
    const effectiveLayout: PageTextLayout =
      !input.includeCaptions && !asset.storyText?.trim()
        ? 'none'
        : asset.textPlacement ?? defaultLayout;

    let storyText = (asset.storyText ?? '').trim();
    if (!storyText && effectiveLayout !== 'none') {
      const matchedPassage = parsedStoryPassages[interiorStoryIndex];
      if (matchedPassage) {
        storyText = matchedPassage;
      } else if (asset.caption && !isLikelyPromptNotStory(asset.caption)) {
        storyText = asset.caption.trim();
      }
    }
    interiorStoryIndex += 1;

    const cleanStory = sanitizeTextForPdf(storyText);
    const hasStoryText = effectiveLayout !== 'none' && cleanStory.length > 0;

    // Layout A: Facing-Page Spread (Left story page + Right full-bleed art page)
    if (hasStoryText && effectiveLayout === 'facing-page') {
      const textPage = pdfDoc.addPage([dims.widthPt, dims.heightPt]);
      pageNumber += 1;

      textPage.drawRectangle({
        x: 0,
        y: 0,
        width: dims.widthPt,
        height: dims.heightPt,
        color: rgb(0.995, 0.991, 0.982),
      });

      const textMaxW = dims.widthPt - dims.marginPt * 2.6;
      const fontSize = cleanStory.length > 280 ? 14.5 : 16.5;
      const lineH = fontSize * 1.5;
      const wrapped = wrapTextToWidth(cleanStory, serifRegular, fontSize, textMaxW);
      const totalH = wrapped.length * lineH;
      const startY = Math.min(
        dims.heightPt - dims.marginPt * 1.6,
        (dims.heightPt + totalH) / 2 - fontSize
      );

      // Subtle decorative top & bottom rule around storybook text
      const ruleW = 54;
      textPage.drawRectangle({
        x: (dims.widthPt - ruleW) / 2,
        y: startY + fontSize + 18,
        width: ruleW,
        height: 1,
        color: rgb(0.78, 0.81, 0.86),
      });

      drawCenteredLines(
        textPage,
        wrapped,
        dims.widthPt / 2,
        startY,
        serifRegular,
        fontSize,
        lineH,
        rgb(0.11, 0.15, 0.22)
      );
      drawPageNumber(textPage, pageNumber, dims.widthPt, sansRegular);

      // Right full-bleed illustration page
      const artPage = pdfDoc.addPage([dims.widthPt, dims.heightPt]);
      pageNumber += 1;
      artPage.drawRectangle({
        x: 0,
        y: 0,
        width: dims.widthPt,
        height: dims.heightPt,
        color: rgb(1, 1, 1),
      });
      if (embeddedImage) {
        if (input.includeBleed) {
          drawImageCover(artPage, embeddedImage, 0, 0, dims.widthPt, dims.heightPt);
        } else {
          drawImageContain(
            artPage,
            embeddedImage,
            dims.marginPt,
            dims.marginPt,
            dims.widthPt - dims.marginPt * 2,
            dims.heightPt - dims.marginPt * 2
          );
        }
      }
      drawPageNumber(artPage, pageNumber, dims.widthPt, sansRegular, Boolean(embeddedImage && input.includeBleed));
      continue;
    }

    // Single-page illustrated book layouts: below-image, overlay-bottom, overlay-top, or none
    const page = pdfDoc.addPage([dims.widthPt, dims.heightPt]);
    pageNumber += 1;

    page.drawRectangle({
      x: 0,
      y: 0,
      width: dims.widthPt,
      height: dims.heightPt,
      color: rgb(0.996, 0.994, 0.988),
    });

    if (hasStoryText && (effectiveLayout === 'overlay-bottom' || effectiveLayout === 'overlay-top')) {
      // Full-bleed artwork with frosted storybook text card in safe zone
      if (embeddedImage) {
        drawImageCover(page, embeddedImage, 0, 0, dims.widthPt, dims.heightPt);
      }

      const cardMarginX = dims.marginPt * 0.85;
      const cardW = dims.widthPt - cardMarginX * 2;
      const textPadX = 24;
      const textPadY = 18;
      const fontSize = cleanStory.length > 240 ? 12.5 : 14;
      const lineH = fontSize * 1.42;
      const wrapped = wrapTextToWidth(cleanStory, serifRegular, fontSize, cardW - textPadX * 2).slice(0, 7);
      const cardH = Math.max(66, wrapped.length * lineH + textPadY * 2);
      const cardY =
        effectiveLayout === 'overlay-top'
          ? dims.heightPt - dims.marginPt * 0.85 - cardH
          : dims.marginPt * 0.85 + 14;

      page.drawRectangle({
        x: cardMarginX,
        y: cardY,
        width: cardW,
        height: cardH,
        color: rgb(0.996, 0.992, 0.98),
        opacity: 0.91,
        borderColor: rgb(0.84, 0.82, 0.77),
        borderWidth: 0.8,
      });

      const textStartY = cardY + cardH - textPadY - fontSize + 2;
      drawCenteredLines(
        page,
        wrapped,
        dims.widthPt / 2,
        textStartY,
        serifRegular,
        fontSize,
        lineH,
        rgb(0.1, 0.14, 0.21)
      );
      drawPageNumber(page, pageNumber, dims.widthPt, sansRegular, Boolean(embeddedImage));
      continue;
    }

    if (hasStoryText && effectiveLayout === 'below-image') {
      // Classic Picture Book layout: crisp artwork above + dedicated warm cream story panel below
      const safeX = dims.marginPt;
      const availW = dims.widthPt - safeX * 2;
      const textFontSize = cleanStory.length > 260 ? 12.5 : 14;
      const lineH = textFontSize * 1.45;
      const wrapped = wrapTextToWidth(cleanStory, serifRegular, textFontSize, availW - 24).slice(0, 6);
      const textPanelH = Math.min(
        dims.heightPt * 0.34,
        Math.max(96, wrapped.length * lineH + 40)
      );
      const panelBottomY = Math.max(30, dims.marginPt * 0.65);

      // Dedicated warm ivory storybook text band
      page.drawRectangle({
        x: safeX,
        y: panelBottomY,
        width: availW,
        height: textPanelH,
        color: rgb(0.985, 0.978, 0.962),
        borderColor: rgb(0.88, 0.85, 0.8),
        borderWidth: 0.75,
      });

      // Artwork region cleanly positioned above the text band
      const artBottomY = panelBottomY + textPanelH + 14;
      const artTopY = dims.heightPt - dims.marginPt * 0.75;
      const artH = Math.max(120, artTopY - artBottomY);

      if (embeddedImage) {
        drawImageContain(page, embeddedImage, safeX, artBottomY, availW, artH);
      } else {
        page.drawRectangle({
          x: safeX,
          y: artBottomY,
          width: availW,
          height: artH,
          borderColor: rgb(0.82, 0.85, 0.9),
          borderWidth: 1,
          color: rgb(0.97, 0.98, 0.99),
        });
      }

      const textBlockH = wrapped.length * lineH;
      const startY = panelBottomY + (textPanelH + textBlockH) / 2 - textFontSize + 2;
      drawCenteredLines(
        page,
        wrapped,
        dims.widthPt / 2,
        startY,
        serifRegular,
        textFontSize,
        lineH,
        rgb(0.11, 0.15, 0.22)
      );
      drawPageNumber(page, pageNumber, dims.widthPt, sansRegular);
      continue;
    }

    // Layout: Artwork Only ('none') — clean full-page illustration/coloring plate/art print
    const availW = dims.widthPt - dims.marginPt * 2;
    const availH = dims.heightPt - dims.marginPt * 2 - 14;
    if (embeddedImage) {
      drawImageContain(page, embeddedImage, dims.marginPt, dims.marginPt + 14, availW, availH);
    } else {
      page.drawRectangle({
        x: dims.marginPt,
        y: dims.marginPt + 14,
        width: availW,
        height: availH,
        borderColor: rgb(0.82, 0.85, 0.9),
        borderWidth: 1,
        color: rgb(0.97, 0.98, 0.99),
      });
      const label = sanitizeTextForPdf(asset.name);
      const lw = sansRegular.widthOfTextAtSize(label, 12);
      page.drawText(label, {
        x: (dims.widthPt - lw) / 2,
        y: dims.marginPt + 14 + availH / 2,
        size: 12,
        font: sansRegular,
        color: rgb(0.35, 0.42, 0.52),
      });
    }

    drawPageNumber(page, pageNumber, dims.widthPt, sansRegular);
  }

  if (pageNumber === 0) {
    const emptyPage = pdfDoc.addPage([dims.widthPt, dims.heightPt]);
    pageNumber = 1;
    emptyPage.drawText(sanitizeTextForPdf(input.product.title), {
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
