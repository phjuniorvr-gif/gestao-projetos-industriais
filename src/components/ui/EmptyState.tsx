import type { ReactNode } from 'react';
import { FolderSearch } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <div className="text-text-muted">{icon ?? <FolderSearch className="h-10 w-10" />}</div>
      <p className="text-sm font-medium text-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action}
    </div>
  );
}
