import type { ReactNode, HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted';
  size?: 'sm' | 'md';
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-surface-tertiary text-text-secondary border-border-subtle',
  primary: 'bg-primary-subtle text-primary-800 border-primary-200',
  success: 'bg-success-subtle text-success-700 border-success-100',
  warning: 'bg-warning-subtle text-warning-700 border-warning-100',
  danger: 'bg-danger-subtle text-danger-700 border-danger-100',
  muted: 'bg-surface-secondary text-text-muted border-border-subtle',
};

const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'px-1.5 py-0.5 text-[11px]',
  md: 'px-2 py-0.5 text-xs',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
