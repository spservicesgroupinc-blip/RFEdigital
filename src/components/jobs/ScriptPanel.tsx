import { useEffect, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { workspaceApi } from '../../lib/api';
import type { WorkspaceSettings } from '../../types/workspace';

interface ScriptPanelProps {
  settings: WorkspaceSettings;
}

export function ScriptPanel({ settings }: ScriptPanelProps) {
  const [copiedScript, setCopiedScript] = useState(false);
  const [codeGsSource, setCodeGsSource] = useState<string>('');
  const [loadingScript, setLoadingScript] = useState(false);

  useEffect(() => {
    if (codeGsSource) return;
    setLoadingScript(true);
    workspaceApi
      .getCodeGs()
      .then((res) => setCodeGsSource(res.source))
      .catch(() => setCodeGsSource('// Unable to load /code.gs from server.'))
      .finally(() => setLoadingScript(false));
  }, [codeGsSource]);

  const copyScript = () => {
    if (!codeGsSource) return;
    navigator.clipboard?.writeText(codeGsSource).catch(() => {});
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 1800);
  };

  const downloadScript = () => {
    if (!codeGsSource) return;
    const blob = new Blob([codeGsSource], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'code.gs';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card variant="default">
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text">Google Apps Script First-Run Bridge (code.gs)</h3>
            <p className="mt-0.5 text-xs text-text-muted">
              Copy into Apps Script, run <span className="font-mono">setupWorkspace()</span> once, deploy as a Web
              App, and save the URL as <span className="font-mono">APPS_SCRIPT_WEBAPP_URL</span> in Settings &gt;
              Secrets.
              {settings.appsScriptConfigured
                ? ' (APPS_SCRIPT_WEBAPP_URL detected on server.)'
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Download className="h-3.5 w-3.5" />}
              onClick={downloadScript}
              disabled={!codeGsSource}
            >
              Download code.gs
            </Button>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Copy className="h-3.5 w-3.5" />}
              onClick={copyScript}
              disabled={!codeGsSource}
            >
              {copiedScript ? 'Copied code.gs' : 'Copy code.gs'}
            </Button>
          </div>
        </div>
        <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-border bg-surface-tertiary p-4 font-mono text-xs leading-relaxed text-text">
          <code>{loadingScript ? 'Loading code.gs…' : codeGsSource}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
