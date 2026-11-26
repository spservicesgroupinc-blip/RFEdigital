import { Copy, KeyRound, Trash2 } from 'lucide-react';
import type { ApiTokenRecord } from '../../types/workspace';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface TokenPanelProps {
  tokens: ApiTokenRecord[];
  tokenName: string;
  setTokenName: (value: string) => void;
  tokenScope: ApiTokenRecord['scope'];
  setTokenScope: (value: ApiTokenRecord['scope']) => void;
  tokenError: string;
  creatingToken: boolean;
  newlyCreatedSecret: string | null;
  copiedSecret: boolean;
  onCreate: (e: React.FormEvent) => void;
  onCopySecret: () => void;
  onRevoke: (id: string) => void;
}

export function TokenPanel({
  tokens,
  tokenName,
  setTokenName,
  tokenScope,
  setTokenScope,
  tokenError,
  creatingToken,
  newlyCreatedSecret,
  copiedSecret,
  onCreate,
  onCopySecret,
  onRevoke,
}: TokenPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Workspace API Tokens</CardTitle>
        <CardDescription>
          Generate SHA-256 hashed tokens for Google Apps Script triggers and external batch runners.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onCreate} className="flex flex-col gap-2.5 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="token-label" className="sr-only">
              Token label
            </label>
            <Input
              id="token-label"
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g., Nightly Apps Script Poller"
            />
          </div>
          <div>
            <label htmlFor="token-scope" className="sr-only">
              Token scope
            </label>
            <Select
              id="token-scope"
              value={tokenScope}
              onChange={(e) => setTokenScope(e.target.value as ApiTokenRecord['scope'])}
              className="sm:w-auto"
            >
              <option value="apps-script-trigger">Apps Script Trigger</option>
              <option value="read-write">Read / Write</option>
              <option value="read-only">Read Only</option>
            </Select>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={creatingToken}
            leadingIcon={<KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
            className="shrink-0 whitespace-nowrap"
          >
            Create Token
          </Button>
        </form>

        {tokenError && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {tokenError}
          </p>
        )}

        {newlyCreatedSecret && (
          <div className="mt-4 rounded-lg border border-warning-100 bg-warning-subtle p-3.5">
            <div className="text-xs font-semibold text-text">
              Copy your new API token now — it will not be displayed again.
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border border-warning-100 bg-surface px-2.5 py-1.5 font-mono text-xs text-text">
                {newlyCreatedSecret}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                leadingIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={onCopySecret}
                className="shrink-0 whitespace-nowrap"
              >
                {copiedSecret ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 divide-y divide-border border-t border-border">
          {tokens.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-muted">No active API tokens.</p>
          ) : (
            tokens.map((tok) => (
              <div
                key={tok.id}
                className="flex items-center justify-between gap-3 py-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-text">{tok.name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-text-muted">
                    <span className="font-mono">{tok.prefix}</span>
                    <span aria-hidden="true">·</span>
                    <span>{tok.scope}</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leadingIcon={<Trash2 className="h-3 w-3" aria-hidden="true" />}
                  onClick={() => onRevoke(tok.id)}
                  aria-label={`Revoke token ${tok.name}`}
                  className="shrink-0 whitespace-nowrap border-danger-200 text-danger hover:bg-danger-subtle"
                >
                  Revoke
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
