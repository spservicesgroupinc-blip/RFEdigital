import { forwardRef, type SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`
          w-full rounded-md border bg-surface px-3 py-2 text-sm
          focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-ring
          disabled:bg-surface-tertiary disabled:text-text-muted
          ${error ? 'border-danger focus:border-danger focus:ring-danger-200' : 'border-border-strong'}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = 'Select';
