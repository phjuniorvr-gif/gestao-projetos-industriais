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
  /** Pedido do usuário — caminho inverso de "Transformar em projeto" (Pipeline). Só quando o
   * projeto não tem nenhuma atividade ainda (`activityCount === 0`) — com atividade/tarefa
   * cadastrada perderia cronograma, e Pipeline não tem onde guardar isso. */
  onDemoteToPipeline: () => void;
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
  onDemoteToPipeline,
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

  function item(
    label: string,
    onClick: () => void,
    options: { danger?: boolean; locked?: boolean; disabledReason?: string } = {},
  ) {
    const { danger = false, locked: itemLocked = false, disabledReason } = options;
    const disabled = itemLocked || Boolean(disabledReason);
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          onClick();
          setOpen(false);
        }}
        disabled={disabled}
        title={itemLocked ? 'Somente administrador pode fazer isto.' : disabledReason}
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
          {item('Rebaixar para Pipeline', onDemoteToPipeline, {
            locked,
            disabledReason: activityCount > 0 ? 'Só é possível rebaixar um projeto sem nenhuma atividade cadastrada.' : undefined,
          })}
          <div className="my-1 border-t border-border-2" />
          {item('Mover para Excluídos', onDelete, { danger: true, locked })}
        </div>
      )}
    </div>
  );
}
