import type { ReactNode } from 'react';

interface FormFieldProps {
  /** `ReactNode`, não só `string` — permite anexar `LockBadge` (Fase 5) ao lado do texto sem
   * precisar de um wrapper novo em quem chama. */
  label: ReactNode;
  required?: boolean;
  error?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, required, error, className = '', children }: FormFieldProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-medium text-text-muted">
        {label} {required && <span className="text-status-delayed">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-status-delayed">{error}</p>}
    </div>
  );
}
