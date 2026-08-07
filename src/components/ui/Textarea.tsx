import { forwardRef, type TextareaHTMLAttributes } from 'react';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`rounded-md border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-text-muted outline-none focus:border-action focus:ring-1 focus:ring-action ${className}`}
        {...rest}
      />
    );
  },
);
