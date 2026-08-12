import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { LockBadge } from '../ui';

interface ProjectActionsMenuProps {
  activityCount: number;
  /** Fase 5 — `undefined` enquanto o papel ainda não carregou, tratado como travado. */
  isAdmin: boolean | undefined;
  onEdit: () => void;
  onViewActivities: () => void;
  onUpdateProgress: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** Menu `⋯` sempre visível (spec Fase 3) — nunca escondido atrás de hover. "Ver atividades"
 * (navegação) e "Atualizar avanço" (informar real — Fase 5: liberado pra qualquer usuário)
 * continuam sempre abertos; o resto é CRUD de projeto, admin-only. */
export function ProjectActionsMenu({
  activityCount,
  isAdmin,
  onEdit,
  onViewActivities,
  onUpdateProgress,
  onDuplicate,
  onDelete,
}: ProjectActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locked = isAdmin !== true;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function item(label: string, onClick: () => void, options: { danger?: boolean; locked?: boolean } = {}) {
    const { danger = false, locked: itemLocked = false } = options;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (itemLocked) return;
          onClick();
          setOpen(false);
        }}
        disabled={itemLocked}
        title={itemLocked ? 'Somente administrador pode fazer isto.' : undefined}
        className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
          danger ? 'text-status-delayed hover:bg-status-delayed-bg' : 'text-text hover:bg-page'
        }`}
      >
        {label}
        {itemLocked && <LockBadge />}
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
          {item('Editar projeto', onEdit, { locked })}
          {item(`Ver atividades (${activityCount})`, onViewActivities)}
          {item('Atualizar avanço', onUpdateProgress)}
          {item('Duplicar', onDuplicate, { locked })}
          <div className="my-1 border-t border-border-2" />
          {item('Mover para Excluídos', onDelete, { danger: true, locked })}
        </div>
      )}
    </div>
  );
}
