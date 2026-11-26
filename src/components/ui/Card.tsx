import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'subtle';
}

const variantClasses: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'bg-surface border border-border',
  elevated: 'bg-surface border border-border-subtle shadow-sm',
  subtle: 'bg-surface-secondary border border-border-subtle',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-lg ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ children, action, className = '', ...props }: CardHeaderProps) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4 ${className}`}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  as?: 'h2' | 'h3' | 'h4';
}

export function CardTitle({
  children,
  as: Component = 'h2',
  className = '',
  ...props
}: CardTitleProps) {
  return (
    <Component
      className={`text-sm font-semibold text-text ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export function CardDescription({ children, className = '', ...props }: CardDescriptionProps) {
  return (
    <p className={`mt-0.5 text-xs text-text-muted ${className}`} {...props}>
      {children}
    </p>
  );
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardContent({ children, className = '', ...props }: CardContentProps) {
  return (
    <div className={`p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardFooter({ children, className = '', ...props }: CardFooterProps) {
  return (
    <div
      className={`flex items-center justify-end gap-3 border-t border-border-subtle px-5 py-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
