import { Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleId } from '../../types/workspace';

interface MobileTab {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
}

interface MobileBottomNavProps {
  tabs: MobileTab[];
  moreTabs: ModuleId[];
  activeModule: ModuleId;
  onNavigate: (id: ModuleId) => void;
  onOpenMore: () => void;
  queuedJobsCount: number;
}

export function MobileBottomNav({
  tabs,
  moreTabs,
  activeModule,
  onNavigate,
  onOpenMore,
  queuedJobsCount,
}: MobileBottomNavProps) {
  const isSecondaryActive = !tabs.some((t) => t.id === activeModule);

  return (
    <nav
      aria-label="Mobile quick navigation"
      className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
    >
      <div className="grid h-16 grid-cols-5 items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeModule === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors ${
                active ? 'text-primary' : 'text-text-muted hover:text-text'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMore}
          aria-label="More workspace modules"
          className={`relative flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors ${
            isSecondaryActive ? 'text-primary' : 'text-text-muted hover:text-text'
          }`}
        >
          <Menu className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>More</span>
          {queuedJobsCount > 0 && (
            <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-warning" />
          )}
        </button>
      </div>
    </nav>
  );
}
