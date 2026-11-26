import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          w-full rounded-md border px-3 py-2 text-sm
          placeholder:text-text-placeholder
          focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-ring
          disabled:bg-surface-tertiary disabled:text-text-muted
          ${error ? 'border-danger focus:border-danger focus:ring-danger-200' : 'border-border-strong'}
          ${className}
        `}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
