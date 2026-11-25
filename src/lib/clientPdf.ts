import type {
  ExportArtifact,
  KdpTrimSize,
  PageTextLayout,
  Product,
  StorageAsset,
} from '../types/workspace';

type LoadedPdfImage = {
  bytes: Uint8Array;
  format: 'png' | 'jpg';
};

function detectImageFormatLocal(bytes: Uint8Array): 'png' | 'jpg' | null {
  if (!bytes || bytes.length < 8) return null;
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
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg';
  }
  return null;
}

function isValidPdfBytesLocal(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 64) return false;
  if (
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46 ||
    bytes[4] !== 0x2d
  ) {
    return false;
  }
  const tailStart = Math.max(0, bytes.length - 1024);
  let tail = '';
  for (let i = tailStart; i < bytes.length; i++) {
    tail += String.fromCharCode(bytes[i]);
  }
  return tail.includes('%%EOF');
}

function isValidZipBytesLocal(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 22) return false;
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) || (bytes[2] === 0x05 && bytes[3] === 0x06))
  );
}

// In-memory cache of verified PDF Blobs built or fetched during this browser session.
// Eliminates Vercel 4.5MB response caps, cold-start /tmp 404s, and broken direct <a> downloads.
const verifiedBlobCache = new Map<string, Blob>();

export function cacheArtifactBlob(artifactId: string, blob: Blob): void {
  verifiedBlobCache.set(artifactId, blob);
}

export function getCachedArtifactBlob(artifactId: string): Blob | undefined {
  return verifiedBlobCache.get(artifactId);
}

/**
 * Loads an image URL in the browser and normalizes it to crisp high-resolution JPEG bytes (or PNG)
 * via offscreen canvas so WebP/SVG/huge PNGs embed reliably and keep book PDFs compact & fast.
 */
async function loadBrowserImageForPdf(url: string): Promise<LoadedPdfImage | null> {
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const rawBuf = new Uint8Array(await res.arrayBuffer());
    const nativeFormat = detectImageFormatLocal(rawBuf);

    // For already-compact JPEGs (< 900 KB), embed directly with zero re-encoding loss
    if (nativeFormat === 'jpg' && rawBuf.byteLength < 900_000) {
      return { bytes: rawBuf, format: 'jpg' };
    }

    // Normalize large PNGs, WebPs, or SVGs via canvas to high-quality 92% print JPEG (max 2200px)
    const blob = new Blob([rawBuf], {
      type: res.headers.get('content-type') || (nativeFormat === 'png' ? 'image/png' : 'image/jpeg'),
    });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image load failed'));
        el.src = objectUrl;
      });

      const maxDim = 2200;
      const srcW = img.naturalWidth || img.width || 1600;
      const srcH = img.naturalHeight || img.height || 1600;
      const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(srcW * scale));
      canvas.height = Math.max(1, Math.round(srcH * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return nativeFormat ? { bytes: rawBuf, format: nativeFormat } : null;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const jpegBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );
      if (!jpegBlob) {
        return nativeFormat ? { bytes: rawBuf, format: nativeFormat } : null;
      }
      const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
      if (detectImageFormatLocal(jpegBytes) === 'jpg') {
        return { bytes: jpegBytes, format: 'jpg' };
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
    }

    return nativeFormat ? { bytes: rawBuf, format: nativeFormat } : null;
  } catch {
    return null;
  }
}

export interface ClientPdfBuildOptions {
  product: Product;
  assets: StorageAsset[];
  trimSize: KdpTrimSize;
  includeBleed: boolean;
  includeTitlePage: boolean;
  includeCaptions: boolean;
  includeCoverTitle?: boolean;
  pageLayout?: PageTextLayout;
  authorImprint?: string;
}

/**
 * Builds a guaranteed-valid, universally compatible KDP PDF directly in the browser.
 * Lazy-loads pdf-lib on demand to keep initial app bundle fast, and is immune to Vercel
 * 4.5MB serverless payload limits and ephemeral /tmp cold starts.
 */
export async function buildClientKdpPdfBlob(
  options: ClientPdfBuildOptions
): Promise<{ blob: Blob; pageCount: number; sizeBytes: number }> {
  const { buildKdpPdfDocument } = await import('./kdpPdfBuilder');
  const { pdfBytes, pageCount } = await buildKdpPdfDocument({
    product: options.product,
    assets: options.assets,
    trimSize: options.trimSize,
    includeBleed: options.includeBleed,
    includeTitlePage: options.includeTitlePage,
    includeCaptions: options.includeCaptions,
    includeCoverTitle: options.includeCoverTitle,
    pageLayout: options.pageLayout,
    authorImprint: options.authorImprint || 'FolioPress Studio',
    loadImageBytes: (asset) => loadBrowserImageForPdf(asset.url),
  });

  if (!isValidPdfBytesLocal(pdfBytes)) {
    throw new Error('Generated PDF failed integrity verification.');
  }

  const copied = new Uint8Array(pdfBytes.byteLength);
  copied.set(pdfBytes);
  const blob = new Blob([copied.buffer], { type: 'application/pdf' });
  return { blob, pageCount, sizeBytes: copied.byteLength };
}

/**
 * Triggers a clean browser download from an already-verified Blob without risking
 * saving HTML/JSON error pages as corrupt `.pdf` files.
 */
export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = safeName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Delay revoke so mobile browsers and Safari finish reading the Blob stream
  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}

export interface ResolveArtifactBlobInput {
  artifact: ExportArtifact;
  product?: Product;
  assets?: StorageAsset[];
  authorImprint?: string;
  pageLayout?: PageTextLayout;
  includeTitlePage?: boolean;
  includeCoverTitle?: boolean;
}

/**
 * Resolves a verified PDF or ZIP Blob for download or in-app preview:
 * 1. Returns cached session Blob if present.
 * 2. Fetches from server & strictly checks `%PDF-` or `PK` magic bytes.
 * 3. If server fails (404 cold-start, 413 Vercel >4.5MB payload limit, or HTML response),
 *    automatically rebuilds a fresh verified PDF right in the browser!
 */
export async function resolveVerifiedArtifactBlob(
  input: ResolveArtifactBlobInput
): Promise<Blob> {
  const { artifact, product, assets } = input;
  const cached = verifiedBlobCache.get(artifact.id);
  if (cached) return cached;

  const isPdf = artifact.format === 'pdf' || artifact.fileName.toLowerCase().endsWith('.pdf');

  // Attempt server download first with strict binary validation
  if (artifact.downloadUrl) {
    try {
      const res = await fetch(artifact.downloadUrl, { credentials: 'same-origin' });
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        if (isPdf && isValidPdfBytesLocal(buf)) {
          const blob = new Blob([buf.buffer], { type: 'application/pdf' });
          verifiedBlobCache.set(artifact.id, blob);
          return blob;
        }
        if (!isPdf && isValidZipBytesLocal(buf)) {
          const blob = new Blob([buf.buffer], { type: 'application/zip' });
          verifiedBlobCache.set(artifact.id, blob);
          return blob;
        }
      }
    } catch {
      // Fall through to client-side PDF rebuild
    }
  }

  // Automatic client-side PDF recovery (solves Vercel 4.5MB limit & ephemeral /tmp 404s!)
  if (isPdf && product) {
    const productBookAssets = (assets ?? [])
      .filter((a) => a.productId === product.id && a.kind !== 'reference')
      .sort((a, b) => a.pageOrder - b.pageOrder);

    const rebuilt = await buildClientKdpPdfBlob({
      product,
      assets: productBookAssets,
      trimSize: artifact.trimSize,
      includeBleed: artifact.includeBleed,
      includeTitlePage: input.includeTitlePage ?? true,
      includeCaptions: (input.pageLayout ?? 'below-image') !== 'none',
      includeCoverTitle: input.includeCoverTitle ?? true,
      pageLayout:
        input.pageLayout ??
        (product.category === 'coloring-book' || product.category === 'art-print'
          ? 'none'
          : 'below-image'),
      authorImprint: input.authorImprint,
    });
    verifiedBlobCache.set(artifact.id, rebuilt.blob);
    return rebuilt.blob;
  }

  throw new Error(
    isPdf
      ? 'This PDF could not be retrieved from the server. Click Build KDP PDF to generate a fresh copy.'
      : 'This ZIP archive is no longer on the server. Click Package PNG Bundle (.zip) to rebuild it.'
  );
}
