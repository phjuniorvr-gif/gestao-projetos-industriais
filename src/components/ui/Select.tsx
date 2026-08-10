import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={`appearance-none rounded-md border border-border bg-white py-2 pl-3 pr-8 text-sm text-text outline-none focus:border-action focus:ring-[3px] focus:ring-action/[0.13] ${className}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      </div>
    );
  },
);
