import type { LucideIcon } from 'lucide-react';
import type { ModuleId, WorkspaceSnapshot } from '../../types/workspace';
import type { User } from 'firebase/auth';

interface NavItem {
  id: ModuleId;
  group: 'primary' | 'secondary';
  label: string;
  caption: string;
  icon: LucideIcon;
}

interface DesktopSidebarProps {
  brand: string;
  navItems: NavItem[];
  activeModule: ModuleId;
  onNavigate: (id: ModuleId) => void;
  workspace: WorkspaceSnapshot | null;
  googleConnected: boolean;
  googleUser: User | null;
  queuedJobsCount: number;
}

export function DesktopSidebar({
  brand,
  navItems,
  activeModule,
  onNavigate,
  workspace,
  googleConnected,
  googleUser,
  queuedJobsCount,
}: DesktopSidebarProps) {
  const primaryItems = navItems.filter((i) => i.group === 'primary');
  const secondaryItems = navItems.filter((i) => i.group === 'secondary');

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-16 items-center border-b border-border px-6">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="font-display text-lg font-bold tracking-tight text-text"
        >
          {brand}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Workspace modules">
        <div className="space-y-1">
          {primaryItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeModule === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </div>

        <div className="mt-5 border-t border-border-subtle px-3 pb-1.5 pt-4 text-[11px] font-semibold tracking-wide text-text-muted">
          More
        </div>
        <div className="space-y-1">
          {secondaryItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeModule === item.id}
              onClick={() => onNavigate(item.id)}
              badge={item.id === 'background-runs' && queuedJobsCount > 0 ? queuedJobsCount : undefined}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-border p-4 text-xs">
        <div className="font-medium text-text">{workspace?.settings.authorImprint ?? brand}</div>
        <div className="mt-1 text-text-muted">
          {googleConnected
            ? `Google connected (${googleUser?.email ?? 'Active'})`
            : 'Local studio · Connect Drive in Settings'}
        </div>
      </div>
    </aside>
  );
}

function NavButton({
  item,
  active,
  onClick,
  badge,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
        active
          ? 'bg-primary-subtle text-primary-800'
          : 'text-text-secondary hover:bg-surface-secondary hover:text-text'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Icon
          className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : 'text-text-muted'}`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium">{item.label}</span>
      </span>
      {badge !== undefined && (
        <span className="font-mono text-xs font-medium text-warning-700 tabular-nums">{badge}</span>
      )}
    </button>
  );
}
