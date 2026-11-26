import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 z-40 flex items-center justify-center gap-2 rounded-lg border border-warning-100 bg-warning px-3.5 py-2 text-xs font-medium text-text-inverse shadow-lg sm:left-4 sm:right-auto lg:bottom-4"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>Offline Mode — Showing cached workspace data.</span>
    </div>
  );
}
