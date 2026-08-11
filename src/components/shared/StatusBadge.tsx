import { AlertTriangle, Clock, Hourglass } from 'lucide-react';
import { Badge } from '../ui';
import { STATUS_COLOR, STATUS_LABEL, type ProjectStatus } from '../../types';
import { shouldShowStartDelayedBadge } from '../../utils/status';

interface StatusBadgeProps {
  status: ProjectStatus;
  /** Nível de tarefa — ícone. Nível de atividade/projeto usa blockedCount (some() satura). */
  blocked?: boolean;
  blockedCount?: number;
  /** Suprimido quando blocked (redundante — bloqueado já é a explicação mais específica). */
  startDelayed?: boolean;
  startDelayedCount?: number;
  lateCompletion?: boolean;
  /** Dias úteis de atraso; sem isso (feriados ainda carregando) mostra só o ícone. */
  lateCompletionDays?: number;
}

const iconClass = 'h-3 w-3 text-status-delayed';

export function StatusBadge({
  status,
  blocked,
  blockedCount,
  startDelayed,
  startDelayedCount,
  lateCompletion,
  lateCompletionDays,
}: StatusBadgeProps) {
  const showStartDelayed = shouldShowStartDelayedBadge({ isStartDelayed: startDelayed, isBlocked: blocked, status });

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>

      {blocked && (
        <span aria-label="Bloqueada por predecessora não concluída" title="Bloqueada por predecessora não concluída">
          <Hourglass className={iconClass} aria-hidden="true" />
        </span>
      )}
      {!!blockedCount && (
        <span
          aria-label={`${blockedCount} ${blockedCount === 1 ? 'tarefa bloqueada' : 'tarefas bloqueadas'}`}
          title={`${blockedCount} ${blockedCount === 1 ? 'tarefa bloqueada' : 'tarefas bloqueadas'}`}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-status-delayed"
        >
          <Hourglass className={iconClass} aria-hidden="true" />
          {blockedCount}
        </span>
      )}

      {showStartDelayed && (
        <span aria-label="Deveria ter começado" title="Deveria ter começado">
          <AlertTriangle className={iconClass} aria-hidden="true" />
        </span>
      )}
      {!!startDelayedCount && (
        <span
          aria-label={`${startDelayedCount} ${startDelayedCount === 1 ? 'tarefa deveria ter começado' : 'tarefas deveriam ter começado'}`}
          title={`${startDelayedCount} ${startDelayedCount === 1 ? 'tarefa deveria ter começado' : 'tarefas deveriam ter começado'}`}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-status-delayed"
        >
          <AlertTriangle className={iconClass} aria-hidden="true" />
          {startDelayedCount}
        </span>
      )}

      {lateCompletion &&
        (lateCompletionDays !== undefined ? (
          <span
            aria-label={`Concluída com ${lateCompletionDays} dias úteis de atraso`}
            title={`Concluída com ${lateCompletionDays} dias úteis de atraso`}
            className="text-[10px] font-semibold text-status-delayed"
          >
            +{lateCompletionDays}d
          </span>
        ) : (
          <span aria-label="Concluída com atraso" title="Concluída com atraso">
            <Clock className={iconClass} aria-hidden="true" />
          </span>
        ))}
    </span>
  );
}
