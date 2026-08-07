import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className = '', id, ...rest },
  ref,
) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 text-sm text-text-muted">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className={`h-4 w-4 rounded border-border bg-white accent-action ${className}`}
        {...rest}
      />
      {label}
    </label>
  );
});
