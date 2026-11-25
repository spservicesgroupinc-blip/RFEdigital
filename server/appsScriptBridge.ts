import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAppsScriptWebAppUrl } from '../src/lib/workspaceLogic';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const CODE_GS_CANDIDATES = [
  path.resolve(process.cwd(), 'code.gs'),
  path.resolve(MODULE_DIR, '..', 'code.gs'),
];

export function isAppsScriptConfigured(): boolean {
  const raw = process.env.APPS_SCRIPT_WEBAPP_URL?.trim() ?? '';
  return validateAppsScriptWebAppUrl(raw).valid;
}

export function getValidatedAppsScriptUrl(): string {
  const raw = process.env.APPS_SCRIPT_WEBAPP_URL?.trim() ?? '';
  const check = validateAppsScriptWebAppUrl(raw);
  if (!check.valid) {
    throw new Error(
      check.error ||
        'APPS_SCRIPT_WEBAPP_URL is not configured. Deploy code.gs as a Web App and add the URL in Settings > Secrets.'
    );
  }
  return raw;
}

export function readCodeGsSource(): string {
  for (const candidate of CODE_GS_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf-8');
    }
  }
  throw new Error('code.gs file not found in project root.');
}

export async function callAppsScriptPost<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const webAppUrl = getValidatedAppsScriptUrl();
  const sharedSecret = process.env.APPS_SCRIPT_SHARED_SECRET?.trim() || undefined;

  const res = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'follow',
    body: JSON.stringify({
      action,
      ...(sharedSecret ? { secret: sharedSecret } : {}),
      ...payload,
    }),
  });

  const text = await res.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Apps Script returned a non-JSON response (HTTP ${res.status}). Confirm the Web App deployment is set to "Who has access: Anyone".`
    );
  }

  if (!res.ok || parsed.ok === false) {
    throw new Error(
      typeof parsed.error === 'string'
        ? parsed.error
        : `Apps Script bridge error (HTTP ${res.status}).`
    );
  }

  return parsed as T;
}

export async function callAppsScriptHealth(): Promise<{
  ok: boolean;
  setup?: {
    spreadsheetId?: string;
    spreadsheetUrl?: string;
    driveRootId?: string;
    driveRootUrl?: string;
    initializedAt?: string;
    triggerInstalled?: boolean;
  };
  counts?: {
    products: number;
    series: number;
    assets: number;
    jobs: number;
  };
}> {
  const webAppUrl = getValidatedAppsScriptUrl();
  const sharedSecret = process.env.APPS_SCRIPT_SHARED_SECRET?.trim();
  const target = new URL(webAppUrl);
  target.searchParams.set('action', 'health');
  if (sharedSecret) {
    target.searchParams.set('secret', sharedSecret);
  }

  const res = await fetch(target.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  const text = await res.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Apps Script health check returned non-JSON (HTTP ${res.status}). Confirm deployment access is set to "Anyone".`
    );
  }

  if (!res.ok || parsed.ok === false) {
    throw new Error(
      typeof parsed.error === 'string'
        ? parsed.error
        : `Apps Script health check failed (HTTP ${res.status}).`
    );
  }

  return parsed as {
    ok: boolean;
    setup?: {
      spreadsheetId?: string;
      spreadsheetUrl?: string;
      driveRootId?: string;
      driveRootUrl?: string;
      initializedAt?: string;
      triggerInstalled?: boolean;
    };
    counts?: {
      products: number;
      series: number;
      assets: number;
      jobs: number;
    };
  };
}
