import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type {
  KdpTrimSize,
  PageTextLayout,
  Product,
  StorageAsset,
} from '../types/workspace.js';
import {
  calculateKdpDimensionsPt,
  isLikelyPromptNotStory,
  parseManuscriptIntoPageTexts,
  sanitizeTextForPdf,
} from './workspaceLogic.js';

export type LoadedPdfImage = {
  bytes: Uint8Array;
  format: 'png' | 'jpg';
};

/**
 * Inspects leading magic bytes so we never feed mislabeled JPEG/WebP/HTML bytes into embedPng/embedJpg.
 */
export function detectImageFormat(bytes: Uint8Array): 'png' | 'jpg' | null {
  if (!bytes || bytes.length < 8) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  return null;
}

/**
 * Verifies that a byte buffer is a genuine PDF binary (%PDF- header and %%EOF trailer),
 * ensuring JSON errors, HTML pages, or truncated responses are never treated as valid PDFs.
 */
export function isValidPdfBytes(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 64) return false;
  // Header: "%PDF-"
  if (
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46 ||
    bytes[4] !== 0x2d
  ) {
    return false;
  }
  // Trailer: check last 1024 bytes for "%%EOF"
  const tailStart = Math.max(0, bytes.length - 1024);
  let tail = '';
  for (let i = tailStart; i < bytes.length; i++) {
    tail += String.fromCharCode(bytes[i]);
  }
  return tail.includes('%%EOF');
}

/**
 * Verifies that a byte buffer is a genuine ZIP archive (PK\x03\x04 or PK\x05\x06).
 */
export function isValidZipBytes(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 22) return false;
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06))
  );
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
      lines.push('');
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

export interface SharedBuildPdfInput {
  product: Product;
  assets: StorageAsset[];
  trimSize: KdpTrimSize;
  includeBleed: boolean;
  includeTitlePage: boolean;
  includeCaptions: boolean;
  includeCoverTitle?: boolean;
  pageLayout?: PageTextLayout;
  authorImprint: string;
  loadImageBytes: (asset: StorageAsset) => Promise<LoadedPdfImage | null>;
}

/**
 * Shared KDP Illustrated Book PDF compiler used by both the Express backend and the browser client.
 * Saves with `useObjectStreams: false` for universal compatibility across iOS, Android, Chrome,
 * macOS Preview, Adobe Acrobat, and Amazon KDP preflight validators.
 */
export async function buildKdpPdfDocument(
  input: SharedBuildPdfInput
): Promise<{ pdfBytes: Uint8Array; pageCount: number }> {
  const dims = calculateKdpDimensionsPt(input.trimSize, input.includeBleed);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(sanitizeTextForPdf(input.product.title) || 'Untitled Book');
  pdfDoc.setAuthor(sanitizeTextForPdf(input.authorImprint || 'FolioPress Studio'));
  pdfDoc.setSubject(`Amazon KDP Illustrated Book (${input.trimSize} in)`);
  pdfDoc.setCreator('FolioPress Digital Product Workspace');
  pdfDoc.setProducer('FolioPress KDP Composer');

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
      const loaded = await input.loadImageBytes(asset);
      if (loaded && loaded.bytes.length > 0) {
        const realFormat = detectImageFormat(loaded.bytes);
        if (realFormat === 'png') {
          embeddedImage = await pdfDoc.embedPng(loaded.bytes);
        } else if (realFormat === 'jpg') {
          embeddedImage = await pdfDoc.embedJpg(loaded.bytes);
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

      page.drawRectangle({
        x: safeX,
        y: panelBottomY,
        width: availW,
        height: textPanelH,
        color: rgb(0.985, 0.978, 0.962),
        borderColor: rgb(0.88, 0.85, 0.8),
        borderWidth: 0.75,
      });

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

    // Layout: Artwork Only ('none')
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
    emptyPage.drawText(sanitizeTextForPdf(input.product.title) || 'Untitled Book', {
      x: dims.marginPt,
      y: dims.heightPt - dims.marginPt - 32,
      size: 22,
      font: serifBold,
      color: rgb(0.06, 0.09, 0.16),
    });
  }

  // Save with useObjectStreams: false so every PDF viewer (Android, iOS, Chrome, Preview, Acrobat, KDP)
  // opens the file cleanly without compressed-xref compatibility errors.
  const pdfBytes = await pdfDoc.save({
    useObjectStreams: false,
    addDefaultPage: false,
  });
  return { pdfBytes, pageCount: pageNumber };
}
