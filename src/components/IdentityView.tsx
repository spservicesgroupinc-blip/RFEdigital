import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { ApiTokenRecord, WorkspaceSettings } from '../types/workspace';
import { validateTokenName } from '../lib/workspaceLogic';
import { workspaceApi } from '../lib/api';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from './ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { AccountCard, BridgePanel, SettingsForm, TokenPanel } from './settings';

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
  { id: '08', name: 'Trends', responsibility: 'Live web market research, competitive deep-dives, 1-click project launch', depends: 'Library, Planning' },
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const handleCopySecret = () => {
    if (!newlyCreatedSecret) return;
    navigator.clipboard?.writeText(newlyCreatedSecret).catch(() => {});
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 1800);
  };

  return (
    <div className="space-y-6">
      <AccountCard
        googleUser={googleUser}
        googleConnected={googleConnected}
        signingIn={signingIn}
        onSignInGoogle={onSignInGoogle}
        onSignOutGoogle={onSignOutGoogle}
      />

      <SettingsForm
        authorImprint={authorImprint}
        setAuthorImprint={setAuthorImprint}
        spreadsheetId={spreadsheetId}
        setSpreadsheetId={setSpreadsheetId}
        settings={settings}
        savingSettings={savingSettings}
        settingsSaved={settingsSaved}
        googleConnected={googleConnected}
        onSave={handleSaveSettings}
        onCreateNewSheet={() => setConfirmBootstrap(true)}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        leadingIcon={
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        }
        onClick={() => setShowAdvanced((v) => !v)}
      >
        Advanced (API tokens &amp; Apps Script bridge)
      </Button>

      {showAdvanced && (
        <div className="space-y-6">
          <TokenPanel
            tokens={tokens}
            tokenName={tokenName}
            setTokenName={setTokenName}
            tokenScope={tokenScope}
            setTokenScope={setTokenScope}
            tokenError={tokenError}
            creatingToken={creatingToken}
            newlyCreatedSecret={newlyCreatedSecret}
            copiedSecret={copiedSecret}
            onCreate={handleCreateToken}
            onCopySecret={handleCopySecret}
            onRevoke={onRevokeToken}
          />
          <BridgePanel
            settings={settings}
            bridgeBusy={bridgeBusy}
            copiedCodeGs={copiedCodeGs}
            onCopy={handleCopyCodeGs}
            onDownload={handleDownloadCodeGs}
            onRunSetup={handleRunBridgeSetup}
            onRequestSync={() => setConfirmBridgeSync(true)}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2">Workspace Capability Map &amp; Build Order</CardTitle>
          <CardDescription>All seven architectural modules active in this workspace.</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-secondary font-medium text-text-muted">
                <th className="px-6 py-3">Order</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Responsibility</th>
                <th className="px-6 py-3">Depends On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-text-secondary">
              {CAPABILITY_MAP.map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-3 font-mono text-text-muted tabular-nums">{row.id}</td>
                  <td className="px-4 py-3 font-semibold text-text">{row.name}</td>
                  <td className="px-4 py-3">{row.responsibility}</td>
                  <td className="px-6 py-3 text-text-muted">{row.depends}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
