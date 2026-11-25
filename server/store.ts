import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ApiTokenRecord,
  BatchPlan,
  ExportArtifact,
  GenerationRecord,
  JobItem,
  Product,
  Series,
  StorageAsset,
  StorageFolder,
  WorkspaceSnapshot,
} from '../src/types/workspace';
import { sanitizeFolderSlug } from '../src/lib/workspaceLogic';
import { isAppsScriptConfigured } from './appsScriptBridge';

const ROOT_DIR = process.cwd();
export const DATA_DIR = path.resolve(ROOT_DIR, '.data');
export const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
export const EXPORTS_DIR = path.resolve(DATA_DIR, 'exports');
const DB_FILE = path.resolve(DATA_DIR, 'workspace.json');

interface StoredToken extends ApiTokenRecord {
  tokenHash: string;
}

interface PersistedWorkspace extends Omit<WorkspaceSnapshot, 'tokens'> {
  tokens: StoredToken[];
}

function ensureDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

export function resolveSafeChildPath(baseDir: string, filename: string): string {
  const safeBase = path.resolve(baseDir);
  const cleanName = path.basename(filename);
  const resolved = path.resolve(safeBase, cleanName);
  if (!resolved.startsWith(safeBase + path.sep)) {
    throw new Error('Invalid file path outside storage boundary.');
  }
  return resolved;
}

function buildSeedWorkspace(): PersistedWorkspace {
  const now = '2026-11-24T15:30:00.000Z';

  const series: Series[] = [
    {
      id: 'ser-lantern-bear',
      name: 'The Lantern Bear Chronicles',
      description:
        'Bedtime gouache picture books following Barnaby the young bear and his woodland neighbors across seasonal adventures.',
      targetAge: 'Ages 4–7',
      marketplace: 'Amazon KDP',
      createdAt: '2026-10-12T10:00:00.000Z',
    },
    {
      id: 'ser-archival-botanicals',
      name: 'Archival Field & Meadow Editions',
      description:
        'Botanical fine art prints and detailed cottage coloring books designed for print-on-demand and Etsy digital bundles.',
      targetAge: 'All Ages',
      marketplace: 'Etsy Digital',
      createdAt: '2026-10-20T14:15:00.000Z',
    },
  ];

  const products: Product[] = [
    {
      id: 'prod-lantern-bear-1',
      seriesId: 'ser-lantern-bear',
      title: 'The Lantern Bear and the Firefly Brook',
      subtitle: 'Book 1 in The Lantern Bear Chronicles',
      category: 'childrens-book',
      status: 'ready-for-kdp',
      trimSize: '8.5x8.5',
      pageCount: 24,
      includeBleed: true,
      isbn: '979-8-8914-2011-4',
      coverAssetId: 'asset-lantern-cover',
      driveFolderId: null,
      sheetsRowSyncedAt: null,
      manuscriptNotes:
        'Spread 1: When twilight brushed the tall pines blue, Barnaby lifted his little brass lantern.\nSpread 2: Down by the stepping stones, silver fireflies danced above paper boats.',
      createdAt: '2026-10-14T09:00:00.000Z',
      updatedAt: now,
    },
    {
      id: 'prod-cloud-atelier',
      seriesId: 'ser-lantern-bear',
      title: 'The Cloud Ship of Swallow Ridge',
      subtitle: 'Book 2 in The Lantern Bear Chronicles',
      category: 'childrens-book',
      status: 'in-production',
      trimSize: '8.5x8.5',
      pageCount: 28,
      includeBleed: true,
      isbn: '979-8-8914-2012-1',
      coverAssetId: 'asset-cloud-cover',
      driveFolderId: null,
      sheetsRowSyncedAt: null,
      manuscriptNotes:
        'Spread 1: High above the orchard hills, the stitched canvas balloon caught the morning breeze.',
      createdAt: '2026-10-28T11:20:00.000Z',
      updatedAt: now,
    },
    {
      id: 'prod-meadow-coloring',
      seriesId: 'ser-archival-botanicals',
      title: 'Enchanted Meadow Cottage Coloring Book',
      subtitle: '30 Single-Sided Botanical Line Art Plates',
      category: 'coloring-book',
      status: 'in-production',
      trimSize: '8.5x11',
      pageCount: 30,
      includeBleed: false,
      isbn: '979-8-8914-2044-2',
      coverAssetId: 'asset-meadow-plate',
      driveFolderId: null,
      sheetsRowSyncedAt: null,
      manuscriptNotes:
        'Single-sided 8.5x11 plates with generous 0.625 in framing margins for markers and colored pencils.',
      createdAt: '2026-11-04T16:40:00.000Z',
      updatedAt: now,
    },
    {
      id: 'prod-botanical-prints',
      seriesId: 'ser-archival-botanicals',
      title: 'Woodland Maidenhair Botanical Print Set',
      subtitle: 'Archival 8×10 Gallery Wall Art Collection',
      category: 'art-print',
      status: 'published',
      trimSize: '8x10',
      pageCount: 12,
      includeBleed: false,
      isbn: 'ETSY-BF-2026-01',
      coverAssetId: 'asset-fern-print',
      driveFolderId: null,
      sheetsRowSyncedAt: null,
      manuscriptNotes:
        'Includes 300 DPI printable PDF portfolio and framed print care instruction card.',
      createdAt: '2026-11-09T13:10:00.000Z',
      updatedAt: now,
    },
  ];

  const folders: StorageFolder[] = [
    {
      id: 'fld-lantern-bear',
      productId: 'prod-lantern-bear-1',
      name: 'the-lantern-bear-and-the-firefly-brook',
      path: '/FolioPress/the-lantern-bear-and-the-firefly-brook',
      driveFolderId: null,
      createdAt: '2026-10-14T09:00:00.000Z',
    },
    {
      id: 'fld-cloud-atelier',
      productId: 'prod-cloud-atelier',
      name: 'the-cloud-ship-of-swallow-ridge',
      path: '/FolioPress/the-cloud-ship-of-swallow-ridge',
      driveFolderId: null,
      createdAt: '2026-10-28T11:20:00.000Z',
    },
    {
      id: 'fld-meadow-coloring',
      productId: 'prod-meadow-coloring',
      name: 'enchanted-meadow-cottage-coloring-book',
      path: '/FolioPress/enchanted-meadow-cottage-coloring-book',
      driveFolderId: null,
      createdAt: '2026-11-04T16:40:00.000Z',
    },
    {
      id: 'fld-botanical-prints',
      productId: 'prod-botanical-prints',
      name: 'woodland-maidenhair-botanical-print-set',
      path: '/FolioPress/woodland-maidenhair-botanical-print-set',
      driveFolderId: null,
      createdAt: '2026-11-09T13:10:00.000Z',
    },
  ];

  const assets: StorageAsset[] = [
    {
      id: 'asset-lantern-cover',
      folderId: 'fld-lantern-bear',
      productId: 'prod-lantern-bear-1',
      name: '01-front-cover-lantern-bear.jpg',
      kind: 'cover',
      mimeType: 'image/jpeg',
      sizeBytes: 412800,
      url: '/src/assets/images/cover_lantern_bear_1795604336162.jpg',
      caption: 'When twilight brushed the tall pines blue, Barnaby lifted his warm brass lantern.',
      pageOrder: 1,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-15T10:00:00.000Z',
    },
    {
      id: 'asset-lantern-spread-1',
      folderId: 'fld-lantern-bear',
      productId: 'prod-lantern-bear-1',
      name: '02-spread-firefly-brook.jpg',
      kind: 'illustration',
      mimeType: 'image/jpeg',
      sizeBytes: 486200,
      url: '/src/assets/images/spread_lantern_river_1795604338150.jpg',
      caption: 'At the stepping-stone brook, silver fireflies guided paper boats beneath the crescent moon.',
      pageOrder: 2,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-16T11:30:00.000Z',
    },
    {
      id: 'asset-cloud-cover',
      folderId: 'fld-cloud-atelier',
      productId: 'prod-cloud-atelier',
      name: '01-cover-cloud-ship.jpg',
      kind: 'cover',
      mimeType: 'image/jpeg',
      sizeBytes: 398400,
      url: '/src/assets/images/cover_cloud_atelier_1795604338375.jpg',
      caption: 'High above Swallow Ridge, the wooden sky-boat sailed alongside folded paper swallows.',
      pageOrder: 1,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-10-29T09:45:00.000Z',
    },
    {
      id: 'asset-meadow-plate',
      folderId: 'fld-meadow-coloring',
      productId: 'prod-meadow-coloring',
      name: '01-plate-meadow-cottage.jpg',
      kind: 'illustration',
      mimeType: 'image/jpeg',
      sizeBytes: 356900,
      url: '/src/assets/images/cover_meadow_coloring_1795604339662.jpg',
      caption: 'Plate 01 — Thatched Meadow Cottage & Butterfly Archway',
      pageOrder: 1,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-11-05T14:00:00.000Z',
    },
    {
      id: 'asset-fern-print',
      folderId: 'fld-botanical-prints',
      productId: 'prod-botanical-prints',
      name: '01-print-maidenhair-fern.jpg',
      kind: 'cover',
      mimeType: 'image/jpeg',
      sizeBytes: 329100,
      url: '/src/assets/images/print_botanical_fern_1795604340121.jpg',
      caption: 'Plate I — Adiantum pedatum (Woodland Maidenhair Fern & Wild Chamomile)',
      pageOrder: 1,
      driveFileId: null,
      driveWebLink: null,
      createdAt: '2026-11-10T10:15:00.000Z',
    },
  ];

  const plans: BatchPlan[] = [
    {
      id: 'plan-lantern-book-2',
      productId: 'prod-cloud-atelier',
      seriesId: 'ser-lantern-bear',
      name: 'Cloud Ship — Interior Spread Batch',
      templateId: 'tpl-picture-book-24',
      trimSize: '8.5x8.5',
      steps: [
        {
          id: 'step-cs-1',
          order: 1,
          title: 'Draft 6-Spread Story Arc & Read-Aloud Copy',
          stepType: 'manuscript',
          prompt:
            'Write a soothing 6-spread children’s picture book text for "The Cloud Ship of Swallow Ridge" about an origami swallow guiding a wooden airship home before dusk.',
          queued: true,
        },
        {
          id: 'step-cs-2',
          order: 2,
          title: 'Illustration — Sunlit Cumulus Harbor',
          stepType: 'illustration',
          prompt:
            'Gouache storybook scene of a wooden cloud ship moored to a lighthouse tower on a misty mountain peak at golden hour.',
          queued: false,
        },
        {
          id: 'step-cs-3',
          order: 3,
          title: 'Assemble KDP 8.5×8.5 Full-Bleed Proof PDF',
          stepType: 'export',
          prompt: 'Compile Cloud Ship assets into an 8.5×8.5 in full-bleed KDP proof PDF.',
          queued: false,
        },
      ],
      createdAt: '2026-11-12T08:30:00.000Z',
      updatedAt: now,
    },
  ];

  const jobs: JobItem[] = [
    {
      id: 'job-seed-1',
      planId: 'plan-lantern-book-2',
      productId: 'prod-cloud-atelier',
      title: 'The Cloud Ship of Swallow Ridge — Draft 6-Spread Story Arc',
      stepType: 'manuscript',
      prompt:
        'Write a soothing 6-spread children’s picture book text for "The Cloud Ship of Swallow Ridge" about an origami swallow guiding a wooden airship home before dusk.',
      provider: 'gemini',
      status: 'completed',
      attempts: 1,
      maxAttempts: 3,
      resultAssetId: null,
      resultSummary: 'Generated 6 rhythmic story spreads (412 words) saved to product manuscript notes.',
      errorMessage: null,
      createdAt: '2026-11-23T09:10:00.000Z',
      updatedAt: '2026-11-23T09:10:18.000Z',
    },
    {
      id: 'job-seed-2',
      planId: null,
      productId: 'prod-meadow-coloring',
      title: 'Enchanted Meadow Cottage — KDP Listing Keywords & Back Cover Copy',
      stepType: 'manuscript',
      prompt:
        'Write Amazon KDP back-cover copy and 7 backend keyword phrases for Enchanted Meadow Cottage Coloring Book (8.5x11 single-sided botanical line art).',
      provider: 'gemini',
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      resultAssetId: null,
      resultSummary: null,
      errorMessage: null,
      createdAt: '2026-11-24T14:20:00.000Z',
      updatedAt: '2026-11-24T14:20:00.000Z',
    },
    {
      id: 'job-seed-3',
      planId: null,
      productId: 'prod-lantern-bear-1',
      title: 'The Lantern Bear — KDP Print Proof Assembly',
      stepType: 'export',
      prompt: 'Assemble 8.5×8.5 in full-bleed KDP interior PDF from ordered assets.',
      provider: 'gemini',
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      resultAssetId: null,
      resultSummary: null,
      errorMessage: null,
      createdAt: '2026-11-24T14:25:00.000Z',
      updatedAt: '2026-11-24T14:25:00.000Z',
    },
  ];

  const generations: GenerationRecord[] = [
    {
      id: 'gen-seed-1',
      productId: 'prod-lantern-bear-1',
      mode: 'kdp-metadata',
      provider: 'gemini',
      model: 'gemini-4-hydrogen',
      prompt: 'Draft Amazon KDP back-cover blurb and BISAC categories for The Lantern Bear and the Firefly Brook.',
      outputText:
        'When twilight settles over Whispering Pine Valley, Barnaby the young bear sets off along the mossy brook with his glowing brass lantern. Alongside a clever red fox and a fleet of folded paper boats, Barnaby discovers that even the smallest light can guide a friend home.\n\nRecommended KDP Categories:\n• Juvenile Fiction / Bedtime & Dreams\n• Juvenile Fiction / Animals / Bears\n• Juvenile Fiction / Nature & the Natural World',
      createdAt: '2026-11-20T16:00:00.000Z',
    },
  ];

  const exportsList: ExportArtifact[] = [];

  const tokens: StoredToken[] = [
    {
      id: 'tok-seed-apps-script',
      name: 'Google Apps Script Job Poller',
      prefix: 'fp_live_8c4e...',
      scope: 'apps-script-trigger',
      tokenHash: crypto.createHash('sha256').update('seed-placeholder-not-active').digest('hex'),
      createdAt: '2026-11-18T12:00:00.000Z',
      lastUsedAt: '2026-11-24T15:00:00.000Z',
    },
  ];

  return {
    settings: {
      studioName: 'FolioPress',
      authorImprint: 'Northwood Picture Press',
      connectedSpreadsheetId: '',
      connectedSpreadsheetUrl: '',
      connectedDriveRootId: '',
      openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      appsScriptConfigured: isAppsScriptConfigured(),
      appsScriptLastSyncAt: null,
    },
    series,
    products,
    folders,
    assets,
    generations,
    plans,
    jobs,
    exports: exportsList,
    tokens,
  };
}

class WorkspaceStore {
  private state: PersistedWorkspace;

  constructor() {
    ensureDirs();
    this.state = this.load();
  }

  private load(): PersistedWorkspace {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedWorkspace;
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.jobs)) {
          parsed.settings.openRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY?.trim());
          parsed.settings.geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
          parsed.settings.appsScriptConfigured = isAppsScriptConfigured();
          if (parsed.settings.appsScriptLastSyncAt === undefined) {
            parsed.settings.appsScriptLastSyncAt = null;
          }
          return parsed;
        }
      }
    } catch {
      // Fallback to fresh seed if local JSON is unreadable
    }
    const seeded = buildSeedWorkspace();
    this.save(seeded);
    return seeded;
  }

  public save(nextState?: PersistedWorkspace): void {
    if (nextState) this.state = nextState;
    ensureDirs();
    fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  public getSnapshot(): WorkspaceSnapshot {
    return {
      ...this.state,
      settings: {
        ...this.state.settings,
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        appsScriptConfigured: isAppsScriptConfigured(),
      },
      tokens: this.state.tokens.map(({ tokenHash: _hash, ...rest }) => rest),
    };
  }

  public getRaw(): PersistedWorkspace {
    return this.state;
  }

  public ensureProductFolder(product: Product): StorageFolder {
    const existing = this.state.folders.find((f) => f.productId === product.id);
    if (existing) return existing;
    const slug = sanitizeFolderSlug(product.title);
    const folder: StorageFolder = {
      id: `fld-${crypto.randomUUID().slice(0, 8)}`,
      productId: product.id,
      name: slug,
      path: `/FolioPress/${slug}`,
      driveFolderId: product.driveFolderId,
      createdAt: new Date().toISOString(),
    };
    this.state.folders.push(folder);
    this.save();
    return folder;
  }

  public createApiToken(
    name: string,
    scope: ApiTokenRecord['scope']
  ): { record: ApiTokenRecord; plainTextToken: string } {
    const rawSecret = `fp_live_${crypto.randomBytes(18).toString('hex')}`;
    const prefix = `${rawSecret.slice(0, 12)}...`;
    const tokenHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
    const stored: StoredToken = {
      id: `tok-${crypto.randomUUID().slice(0, 8)}`,
      name,
      prefix,
      scope,
      tokenHash,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    this.state.tokens.unshift(stored);
    this.save();
    const { tokenHash: _hash, ...record } = stored;
    return { record, plainTextToken: rawSecret };
  }

  public revokeApiToken(id: string): boolean {
    const before = this.state.tokens.length;
    this.state.tokens = this.state.tokens.filter((t) => t.id !== id);
    if (this.state.tokens.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  public verifyApiToken(bearerToken: string): boolean {
    const hash = crypto.createHash('sha256').update(bearerToken).digest('hex');
    const match = this.state.tokens.find((t) => t.tokenHash === hash);
    if (match) {
      match.lastUsedAt = new Date().toISOString();
      this.save();
      return true;
    }
    return false;
  }
}

export const workspaceStore = new WorkspaceStore();
