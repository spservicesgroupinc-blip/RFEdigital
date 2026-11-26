import { Code2, Copy, Download, RefreshCw } from 'lucide-react';
import type { WorkspaceSettings } from '../../types/workspace';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

interface BridgePanelProps {
  settings: WorkspaceSettings;
  bridgeBusy: boolean;
  copiedCodeGs: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onRunSetup: () => void;
  onRequestSync: () => void;
}

export function BridgePanel({
  settings,
  bridgeBusy,
  copiedCodeGs,
  onCopy,
  onDownload,
  onRunSetup,
  onRequestSync,
}: BridgePanelProps) {
  const configured = settings.appsScriptConfigured;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Google Apps Script Bridge (code.gs)</CardTitle>
        <CardDescription>
          Copy <span className="font-mono text-text">/code.gs</span> into Google Apps Script and run{' '}
          <span className="font-mono text-text">setupWorkspace()</span> once to automatically create
          your Google Drive workspace folders, formatted Library Spreadsheet tabs, and 5-minute
          background job trigger. Deploy it as a Web App and save the deployment URL as{' '}
          <span className="font-mono text-text">APPS_SCRIPT_WEBAPP_URL</span> in{' '}
          <span className="font-semibold text-text">Settings &gt; Secrets</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={configured ? 'success' : 'warning'} size="md">
            {configured
              ? 'APPS_SCRIPT_WEBAPP_URL configured in Secrets'
              : 'APPS_SCRIPT_WEBAPP_URL not set in Settings > Secrets yet'}
          </Badge>
          {settings.appsScriptLastSyncAt && (
            <>
              <span className="text-border-strong" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-text-muted tabular-nums">
                Last synced {new Date(settings.appsScriptLastSyncAt).toLocaleString()}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leadingIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onCopy}
          >
            {copiedCodeGs ? 'Copied code.gs' : 'Copy code.gs'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            leadingIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onDownload}
          >
            Download code.gs
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            leadingIcon={<Code2 className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onRunSetup}
            disabled={!configured || bridgeBusy}
          >
            {bridgeBusy ? 'Running…' : 'Run First-Time Setup'}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={onRequestSync}
            disabled={!configured || bridgeBusy}
          >
            Sync via Apps Script
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
