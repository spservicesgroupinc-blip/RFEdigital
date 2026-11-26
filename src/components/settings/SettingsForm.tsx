import { ExternalLink } from 'lucide-react';
import type { WorkspaceSettings } from '../../types/workspace';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';

interface SettingsFormProps {
  authorImprint: string;
  setAuthorImprint: (value: string) => void;
  spreadsheetId: string;
  setSpreadsheetId: (value: string) => void;
  settings: WorkspaceSettings;
  savingSettings: boolean;
  settingsSaved: boolean;
  googleConnected: boolean;
  onSave: (e: React.FormEvent) => void;
  onCreateNewSheet: () => void;
}

export function SettingsForm({
  authorImprint,
  setAuthorImprint,
  spreadsheetId,
  setSpreadsheetId,
  settings,
  savingSettings,
  settingsSaved,
  googleConnected,
  onSave,
  onCreateNewSheet,
}: SettingsFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Workspace Settings</CardTitle>
        <CardDescription>
          Your publishing imprint and the Google Spreadsheet that backs this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSave} className="space-y-4">
          <div>
            <label
              htmlFor="studio-imprint"
              className="block text-xs font-medium text-text-secondary"
            >
              Publishing Imprint Name (Printed on KDP Title Pages)
            </label>
            <Input
              id="studio-imprint"
              type="text"
              value={authorImprint}
              onChange={(e) => setAuthorImprint(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="sheet-id" className="block text-xs font-medium text-text-secondary">
                Connected Google Spreadsheet ID
              </label>
              {settings.connectedSpreadsheetUrl && (
                <a
                  href={settings.connectedSpreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover"
                >
                  Open Sheet
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
            <div className="mt-1 flex gap-2">
              <Input
                id="sheet-id"
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="Paste existing Spreadsheet ID or create new"
                className="min-w-0 flex-1 font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onCreateNewSheet}
                disabled={!googleConnected}
                className="shrink-0 whitespace-nowrap"
              >
                Create New Sheet
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={savingSettings}
              className="shrink-0 whitespace-nowrap"
            >
              {savingSettings ? 'Saving…' : 'Save Workspace Settings'}
            </Button>
            {settingsSaved && <span className="text-xs font-medium text-success">Settings saved</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
