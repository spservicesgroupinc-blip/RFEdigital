import { Menu, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleId } from '../../types/workspace';
import { PWAInstallButton } from '../PWAInstallButton';
import { Button } from '../ui/Button';

interface TopHeaderProps {
  activeLabel: string;
  activeIcon?: LucideIcon;
  onOpenMobileNav: () => void;
  primaryAction?: {
    label: string;
    shortLabel?: string;
    onClick: () => void;
    isLoading?: boolean;
    disabled?: boolean;
  } | null;
  onInstalledPWA: () => void;
}

export function TopHeader({
  activeLabel,
  onOpenMobileNav,
  primaryAction,
  onInstalledPWA,
}: TopHeaderProps) {
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-border bg-surface">
      <div className="flex h-14 items-center justify-between gap-2 px-4 sm:h-16 sm:gap-4 sm:px-5 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMobileNav}
            aria-label="Open navigation menu"
            className="lg:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="hidden font-medium text-text-muted sm:inline">Workspace</span>
            <span className="hidden text-border-strong sm:inline" aria-hidden="true">
              /
            </span>
            <h1 className="truncate font-display text-base font-semibold text-text">{activeLabel}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <PWAInstallButton variant="header" onInstalled={onInstalledPWA} />
          {primaryAction && (
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Plus className="h-3.5 w-3.5" />}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              isLoading={primaryAction.isLoading}
              className="whitespace-nowrap"
            >
              <span className="sm:hidden">{primaryAction.shortLabel ?? primaryAction.label}</span>
              <span className="hidden sm:inline">{primaryAction.label}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
