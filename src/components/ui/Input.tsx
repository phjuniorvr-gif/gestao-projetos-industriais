import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`rounded-md border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-text-muted outline-none focus:border-action focus:ring-1 focus:ring-action ${className}`}
        {...rest}
      />
    );
  },
);
