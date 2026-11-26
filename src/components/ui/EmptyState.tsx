import type { ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  } & Partial<ButtonProps>;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { label, icon: actionIcon, onClick, ...buttonProps } = action ?? {};
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-text-muted">{icon}</div>}
      <h3 className="text-sm font-semibold text-text">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-xs text-text-muted">{description}</p>}
      {action && (
        <Button
          variant="primary"
          size="md"
          leadingIcon={actionIcon}
          onClick={onClick}
          className="mt-4"
          {...buttonProps}
        >
          {label}
        </Button>
      )}
    </div>
  );
}
