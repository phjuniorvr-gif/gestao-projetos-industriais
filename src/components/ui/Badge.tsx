import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
      style={color ? { backgroundColor: `${color}1a`, color } : undefined}
    >
      {children}
    </span>
  );
}
