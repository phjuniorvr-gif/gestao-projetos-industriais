import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface ProjectActionsMenuProps {
  activityCount: number;
  onEdit: () => void;
  onViewActivities: () => void;
  onUpdateProgress: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** Menu `⋯` sempre visível (spec Fase 3) — nunca escondido atrás de hover. */
export function ProjectActionsMenu({
  activityCount,
  onEdit,
  onViewActivities,
  onUpdateProgress,
  onDuplicate,
  onDelete,
}: ProjectActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function item(label: string, onClick: () => void, danger = false) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
          setOpen(false);
        }}
        className={`block w-full px-3 py-1.5 text-left text-xs ${
          danger ? 'text-status-delayed hover:bg-status-delayed-bg' : 'text-text hover:bg-page'
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Ações do projeto"
        aria-expanded={open}
        className="rounded-md p-1.5 text-text-muted hover:bg-page hover:text-text"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-border bg-card py-1 shadow-lg">
          {item('Editar projeto', onEdit)}
          {item(`Ver atividades (${activityCount})`, onViewActivities)}
          {item('Atualizar avanço', onUpdateProgress)}
          {item('Duplicar', onDuplicate)}
          <div className="my-1 border-t border-border-2" />
          {item('Mover para Excluídos', onDelete, true)}
        </div>
      )}
    </div>
  );
}
