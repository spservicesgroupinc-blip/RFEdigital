import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-primary text-text-inverse hover:bg-primary-hover active:bg-primary-pressed focus-visible:ring-primary-300',
  secondary:
    'bg-surface-tertiary text-text hover:bg-surface-muted active:bg-border focus-visible:ring-primary-300',
  outline:
    'border border-border-strong bg-surface text-text hover:bg-surface-secondary hover:border-border-strong active:bg-surface-tertiary focus-visible:ring-primary-300',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-tertiary hover:text-text active:bg-surface-muted focus-visible:ring-primary-300',
  danger:
    'bg-danger text-white hover:bg-danger-700 active:bg-danger-800 focus-visible:ring-danger-200',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-4 text-xs gap-1.5 rounded-md',
  lg: 'h-10 px-5 text-sm gap-2 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leadingIcon,
      trailingIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary disabled:opacity-50 disabled:cursor-not-allowed';
    return (
      <button
        ref={ref}
        type={props.type ?? 'button'}
        disabled={disabled || isLoading}
        className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {children}
          </>
        ) : (
          <>
            {leadingIcon}
            {children}
            {trailingIcon}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
