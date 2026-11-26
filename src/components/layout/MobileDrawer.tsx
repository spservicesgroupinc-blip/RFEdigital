import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleId, WorkspaceSnapshot } from '../../types/workspace';
import { PWAInstallButton } from '../PWAInstallButton';
import { Button } from '../ui/Button';

interface NavItem {
  id: ModuleId;
  group: 'primary' | 'secondary';
  label: string;
  caption: string;
  icon: LucideIcon;
}

interface MobileDrawerProps {
  brand: string;
  logo: string;
  isOpen: boolean;
  onClose: () => void;
  navItems: NavItem[];
  activeModule: ModuleId;
  onNavigate: (id: ModuleId) => void;
  workspace: WorkspaceSnapshot | null;
  googleConnected: boolean;
  googleUser: { email?: string | null } | null;
  queuedJobsCount: number;
  onInstalled: () => void;
}

export function MobileDrawer({
  brand,
  logo,
  isOpen,
  onClose,
  navItems,
  activeModule,
  onNavigate,
  workspace,
  googleConnected,
  googleUser,
  queuedJobsCount,
  onInstalled,
}: MobileDrawerProps) {
  if (!isOpen) return null;

  const primaryItems = navItems.filter((i) => i.group === 'primary');
  const secondaryItems = navItems.filter((i) => i.group === 'secondary');

  const handleNavigate = (id: ModuleId) => {
    onNavigate(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Workspace navigation">
      <div className="fixed inset-0 bg-text/40" onClick={onClose} />
      <div className="safe-top safe-bottom relative z-10 flex w-72 max-w-[85vw] flex-col bg-surface shadow-xl">
        <div className="flex h-15 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="" aria-hidden="true" className="h-7 w-7 rounded-md" />
            <span className="font-display text-lg font-bold text-text">{brand}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close navigation menu">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          <div className="space-y-1">
            {primaryItems.map((item) => (
              <DrawerButton
                key={item.id}
                item={item}
                active={activeModule === item.id}
                onClick={() => handleNavigate(item.id)}
                showCaption
              />
            ))}
          </div>

          <div className="border-t border-border-subtle pt-3">
            <div className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-text-muted">More</div>
            <div className="space-y-1">
              {secondaryItems.map((item) => (
                <DrawerButton
                  key={item.id}
                  item={item}
                  active={activeModule === item.id}
                  onClick={() => handleNavigate(item.id)}
                  showCaption
                  badge={item.id === 'background-runs' && queuedJobsCount > 0 ? queuedJobsCount : undefined}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="space-y-3 border-t border-border p-4">
          <PWAInstallButton variant="full" onInstalled={onInstalled} />
          <div className="text-xs text-text-muted">
            <div className="font-medium text-text">{workspace?.settings.authorImprint ?? brand}</div>
            <div className="mt-0.5 truncate">
              {googleConnected
                ? `Google connected (${googleUser?.email ?? 'Active'})`
                : 'Local studio · Connect Drive in Settings'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerButton({
  item,
  active,
  onClick,
  showCaption,
  badge,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  showCaption?: boolean;
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={`flex min-h-[44px] w-full items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? 'bg-primary-subtle text-primary-800' : 'text-text-secondary hover:bg-surface-secondary'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{item.label}</span>
      </span>
      {showCaption ? (
        <span className="text-[11px] text-text-muted">{item.caption}</span>
      ) : badge !== undefined ? (
        <span className="font-mono text-xs font-medium text-warning-700 tabular-nums">{badge}</span>
      ) : null}
    </button>
  );
}
