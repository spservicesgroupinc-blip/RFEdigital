import { useState } from 'react';
import { Code2, Copy, Download, ExternalLink, KeyRound, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ApiTokenRecord, WorkspaceSettings } from '../types/workspace';
import { validateTokenName } from '../lib/workspaceLogic';
import { workspaceApi } from '../lib/api';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ConfirmDialog } from './ConfirmDialog';

interface IdentityViewProps {
  googleUser: User | null;
  googleConnected: boolean;
  signingIn: boolean;
  settings: WorkspaceSettings;
  tokens: ApiTokenRecord[];
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle: () => Promise<void>;
  onCreateToken: (payload: {
    name: string;
    scope: ApiTokenRecord['scope'];
  }) => Promise<{ record: ApiTokenRecord; plainTextToken: string }>;
  onRevokeToken: (id: string) => Promise<void>;
  onUpdateSettings: (payload: Partial<WorkspaceSettings>) => Promise<void>;
  onBootstrapGoogleSheet: () => Promise<void>;
  onRunBridgeSetup: () => Promise<void>;
  onSyncViaBridge: () => Promise<void>;
}

const CAPABILITY_MAP = [
  { id: '01', name: 'Identity', responsibility: 'Google accounts, session tokens, scoped API keys', depends: '—' },
  { id: '02', name: 'Library', responsibility: 'Books, series, KDP metadata synced with Google Sheets', depends: 'Identity' },
  { id: '03', name: 'Storage', responsibility: 'Product-scoped Drive folders, uploads, download links', depends: 'Identity, Library' },
  { id: '04', name: 'Generation', responsibility: 'Server-side AI prompts for copy & illustrations', depends: 'Library, Storage' },
  { id: '05', name: 'Export', responsibility: 'pdf-lib KDP PDF assembly & PNG ZIP bundles', depends: 'Generation, Storage' },
  { id: '06', name: 'Planning', responsibility: 'Series outlines, templates, batch generation plans', depends: 'Library, Generation' },
  { id: '07', name: 'Jobs', responsibility: 'Background queue, status polling, Apps Script ticks', depends: 'Library, Generation, Storage' },
];

export function IdentityView({
  googleUser,
  googleConnected,
  signingIn,
  settings,
  tokens,
  onSignInGoogle,
  onSignOutGoogle,
  onCreateToken,
  onRevokeToken,
  onUpdateSettings,
  onBootstrapGoogleSheet,
  onRunBridgeSetup,
  onSyncViaBridge,
}: IdentityViewProps) {
  const [tokenName, setTokenName] = useState('');
  const [tokenScope, setTokenScope] = useState<ApiTokenRecord['scope']>('apps-script-trigger');
  const [tokenError, setTokenError] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [authorImprint, setAuthorImprint] = useState(settings.authorImprint);
  const [spreadsheetId, setSpreadsheetId] = useState(settings.connectedSpreadsheetId);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [confirmBootstrap, setConfirmBootstrap] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);

  const [copiedCodeGs, setCopiedCodeGs] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [confirmBridgeSync, setConfirmBridgeSync] = useState(false);

  const handleCopyCodeGs = async () => {
    const res = await workspaceApi.getCodeGs();
    navigator.clipboard?.writeText(res.source).catch(() => {});
    setCopiedCodeGs(true);
    setTimeout(() => setCopiedCodeGs(false), 1800);
  };

  const handleDownloadCodeGs = async () => {
    const res = await workspaceApi.getCodeGs();
    const blob = new Blob([res.source], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code.gs';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunBridgeSetup = async () => {
    setBridgeBusy(true);
    try {
      await onRunBridgeSetup();
    } finally {
      setBridgeBusy(false);
    }
  };

  const handleConfirmBridgeSync = async () => {
    setBridgeBusy(true);
    try {
      await onSyncViaBridge();
      setConfirmBridgeSync(false);
    } finally {
      setBridgeBusy(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateTokenName(tokenName);
    if (!check.valid) {
      setTokenError(check.errors.name);
      return;
    }
    setTokenError('');
    setCreatingToken(true);
    try {
      const created = await onCreateToken({
        name: tokenName.trim(),
        scope: tokenScope,
      });
      setNewlyCreatedSecret(created.plainTextToken);
      setTokenName('');
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : 'Unable to create token.');
    } finally {
      setCreatingToken(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      await onUpdateSettings({
        authorImprint: authorImprint.trim() || settings.authorImprint,
        connectedSpreadsheetId: spreadsheetId.trim(),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      await onBootstrapGoogleSheet();
      setConfirmBootstrap(false);
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Google Workspace Account & Sheets/Drive Connection */}
        <section className="rounded-lg border border-slate-200 bg-white p-6 xl:col-span-6">
          <h2 className="text-base font-semibold text-slate-900">Google Workspace Account</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Connect Google Drive and Google Sheets to sync your product catalog and upload exported PDFs.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            {googleConnected && googleUser ? (
              <>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">
                    {googleUser.displayName || 'Connected Google Account'}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">{googleUser.email}</div>
                  <div className="mt-1 text-xs font-medium text-emerald-700">
                    Google Drive &amp; Sheets session active
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSignOutGoogle}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <div>
                  <div className="text-sm font-medium text-slate-900">Not signed in</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Sign in to enable live Drive folders and Sheets library sync.
                  </div>
                </div>
                <GoogleSignInButton onClick={onSignInGoogle} disabled={signingIn} />
              </>
            )}
          </div>

          <form onSubmit={handleSaveSettings} className="mt-5 space-y-4 border-t border-slate-200 pt-5">
            <div>
              <label htmlFor="studio-imprint" className="block text-xs font-medium text-slate-700">
                Publishing Imprint Name (Printed on KDP Title Pages)
              </label>
              <input
                id="studio-imprint"
                type="text"
                value={authorImprint}
                onChange={(e) => setAuthorImprint(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="sheet-id" className="block text-xs font-medium text-slate-700">
                  Connected Google Spreadsheet ID
                </label>
                {settings.connectedSpreadsheetUrl && (
                  <a
                    href={settings.connectedSpreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800"
                  >
                    Open Sheet
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </div>
              <div className="mt-1 flex gap-2">
                <input
                  id="sheet-id"
                  type="text"
                  value={spreadsheetId}
                  onChange={(e) => setSpreadsheetId(e.target.value)}
                  placeholder="Paste existing Spreadsheet ID or create new"
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!googleConnected}
                  onClick={() => setConfirmBootstrap(true)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
                >
                  Create New Sheet
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {savingSettings ? 'Saving…' : 'Save Workspace Settings'}
              </button>
              {settingsSaved && (
                <span className="text-xs font-medium text-emerald-700">Settings saved</span>
              )}
            </div>
          </form>
        </section>

        {/* Scoped Personal API Tokens */}
        <section className="rounded-lg border border-slate-200 bg-white p-6 xl:col-span-6">
          <h2 className="text-base font-semibold text-slate-900">Workspace API Tokens</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Generate SHA-256 hashed tokens for Google Apps Script triggers and external batch runners.
          </p>

          <form onSubmit={handleCreateToken} className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="token-label" className="sr-only">
                Token label
              </label>
              <input
                id="token-label"
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g., Nightly Apps Script Poller"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="token-scope" className="sr-only">
                Token scope
              </label>
              <select
                id="token-scope"
                value={tokenScope}
                onChange={(e) => setTokenScope(e.target.value as ApiTokenRecord['scope'])}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 sm:w-auto"
              >
                <option value="apps-script-trigger">Apps Script Trigger</option>
                <option value="read-write">Read / Write</option>
                <option value="read-only">Read Only</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={creatingToken}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              Create Token
            </button>
          </form>

          {tokenError && (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {tokenError}
            </p>
          )}

          {newlyCreatedSecret && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3.5">
              <div className="text-xs font-semibold text-amber-900">
                Copy your new API token now — it will not be displayed again.
              </div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded border border-amber-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900">
                  {newlyCreatedSecret}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(newlyCreatedSecret).catch(() => {});
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  {copiedSecret ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 divide-y divide-slate-200 border-t border-slate-200">
            {tokens.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No active API tokens.</p>
            ) : (
              tokens.map((tok) => (
                <div
                  key={tok.id}
                  className="flex items-center justify-between gap-3 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{tok.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-slate-500">
                      <span className="font-mono">{tok.prefix}</span>
                      <span aria-hidden="true">·</span>
                      <span>{tok.scope}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRevokeToken(tok.id)}
                    aria-label={`Revoke token ${tok.name}`}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Google Apps Script Web App Bridge (code.gs + Settings > Secrets) */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Google Apps Script Bridge (code.gs)
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">
              Copy <span className="font-mono text-slate-800">/code.gs</span> into Google Apps Script and run{' '}
              <span className="font-mono text-slate-800">setupWorkspace()</span> once to automatically create your Google Drive workspace folders, formatted Library Spreadsheet tabs, and 5-minute background job trigger. Deploy it as a Web App and save the deployment URL as{' '}
              <span className="font-mono text-slate-800">APPS_SCRIPT_WEBAPP_URL</span> in{' '}
              <span className="font-semibold text-slate-800">Settings &gt; Secrets</span>.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`font-medium ${
                  settings.appsScriptConfigured ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {settings.appsScriptConfigured
                  ? 'APPS_SCRIPT_WEBAPP_URL configured in Secrets'
                  : 'APPS_SCRIPT_WEBAPP_URL not set in Settings > Secrets yet'}
              </span>
              {settings.appsScriptLastSyncAt && (
                <>
                  <span className="text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    Last synced {new Date(settings.appsScriptLastSyncAt).toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyCodeGs}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {copiedCodeGs ? 'Copied code.gs' : 'Copy code.gs'}
            </button>
            <button
              type="button"
              onClick={handleDownloadCodeGs}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              Download code.gs
            </button>
            <button
              type="button"
              disabled={!settings.appsScriptConfigured || bridgeBusy}
              onClick={handleRunBridgeSetup}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              <Code2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {bridgeBusy ? 'Running…' : 'Run First-Time Setup'}
            </button>
            <button
              type="button"
              disabled={!settings.appsScriptConfigured || bridgeBusy}
              onClick={() => setConfirmBridgeSync(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-45 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Sync via Apps Script
            </button>
          </div>
        </div>
      </section>

      {/* Capability Map Architecture Reference Table */}
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Workspace Capability Map &amp; Build Order
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            All seven architectural modules active in this workspace.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 font-medium text-slate-500">
                <th className="px-6 py-3">Order</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Responsibility</th>
                <th className="px-6 py-3">Depends On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {CAPABILITY_MAP.map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-3 font-mono text-slate-400 tabular-nums">{row.id}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="px-4 py-3">{row.responsibility}</td>
                  <td className="px-6 py-3 text-slate-500">{row.depends}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={confirmBootstrap}
        title="Create a new FolioPress Library Spreadsheet?"
        description="FolioPress will create a new Google Spreadsheet with Products, Series, and Jobs tabs in your Google Drive."
        confirmLabel="Create Spreadsheet"
        tone="primary"
        busy={bootstrapping}
        onConfirm={handleBootstrap}
        onCancel={() => setConfirmBootstrap(false)}
      />

      <ConfirmDialog
        open={confirmBridgeSync}
        title="Sync Workspace tables via Google Apps Script?"
        description="This will write your Products, Series, Assets, and Jobs tables into the Google Spreadsheet managed by your deployed Apps Script Web App."
        confirmLabel="Sync via Apps Script"
        tone="primary"
        busy={bridgeBusy}
        onConfirm={handleConfirmBridgeSync}
        onCancel={() => setConfirmBridgeSync(false)}
      />
    </div>
  );
}
