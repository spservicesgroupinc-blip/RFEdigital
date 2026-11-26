import type { User } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { GoogleSignInButton } from '../GoogleSignInButton';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

interface AccountCardProps {
  googleUser: User | null;
  googleConnected: boolean;
  signingIn: boolean;
  onSignInGoogle: () => Promise<void>;
  onSignOutGoogle: () => Promise<void>;
}

export function AccountCard({
  googleUser,
  googleConnected,
  signingIn,
  onSignInGoogle,
  onSignOutGoogle,
}: AccountCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Google Workspace Account</CardTitle>
        <CardDescription>
          Connect Google Drive and Google Sheets to sync your product catalog and upload exported
          PDFs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border bg-surface-secondary p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {googleConnected && googleUser ? (
              <>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text">
                    {googleUser.displayName || 'Connected Google Account'}
                  </div>
                  <div className="mt-0.5 text-xs text-text-secondary">{googleUser.email}</div>
                  <Badge variant="success" size="sm" className="mt-2">
                    Google Drive &amp; Sheets session active
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leadingIcon={<LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={onSignOutGoogle}
                  className="shrink-0 whitespace-nowrap"
                >
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <div>
                  <div className="text-sm font-medium text-text">Not signed in</div>
                  <div className="mt-0.5 text-xs text-text-secondary">
                    Sign in to enable live Drive folders and Sheets library sync.
                  </div>
                </div>
                <GoogleSignInButton onClick={onSignInGoogle} disabled={signingIn} />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
