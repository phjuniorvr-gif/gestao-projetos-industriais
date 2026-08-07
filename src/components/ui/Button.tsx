import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-action hover:bg-blue-700 text-white',
  secondary: 'bg-white hover:bg-page text-text border border-border',
  ghost: 'bg-transparent hover:bg-page text-text-muted',
  danger: 'bg-transparent hover:bg-status-delayed/10 text-status-delayed border border-status-delayed/40',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', icon, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});
