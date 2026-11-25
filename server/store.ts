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
  TrendScanResult,
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

function buildEmptyWorkspace(): PersistedWorkspace {
  return {
    settings: {
      studioName: 'FolioPress',
      authorImprint: 'FolioPress Studio',
      connectedSpreadsheetId: '',
      connectedSpreadsheetUrl: '',
      connectedDriveRootId: '',
      openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      appsScriptConfigured: isAppsScriptConfigured(),
      appsScriptLastSyncAt: null,
    },
    series: [] as Series[],
    products: [] as Product[],
    folders: [] as StorageFolder[],
    assets: [] as StorageAsset[],
    generations: [] as GenerationRecord[],
    plans: [] as BatchPlan[],
    jobs: [] as JobItem[],
    exports: [] as ExportArtifact[],
    tokens: [] as StoredToken[],
    trendScans: [] as TrendScanResult[],
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
          if (!Array.isArray(parsed.trendScans)) {
            parsed.trendScans = [];
          }
          return parsed;
        }
      }
    } catch {
      // Fallback to clean empty workspace if local JSON is unreadable
    }
    const empty = buildEmptyWorkspace();
    this.save(empty);
    return empty;
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
