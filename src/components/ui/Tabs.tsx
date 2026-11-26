import type { ReactNode } from 'react';

export interface TabsProps<T extends string> {
  items: Array<{ id: T; label: string; badge?: ReactNode }>;
  activeId: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({
  items,
  activeId,
  onChange,
  className = '',
}: TabsProps<T>) {
  return (
    <div
      className={`inline-flex w-full items-center gap-1 overflow-x-auto rounded-lg bg-surface-tertiary p-1 sm:w-auto ${className}`}
      role="tablist"
    >
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}
