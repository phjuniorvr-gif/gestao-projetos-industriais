import { AlertTriangle, Clock, Hourglass, UserCheck, XCircle } from 'lucide-react';
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
  /** Fase 7+ — `TaskView.pendingConfirmation`: tem data real preenchida por usuário comum,
   * ainda sem confirmação do administrador. Enquanto isso, `status` já não é 'completed' — este
   * selo é o que explica a aparente contradição pra quem olha. */
  pendingConfirmation?: boolean;
  /** Fase 7+ — `Task.rejected`: administrador reprovou a última finalização informada (fim real
   * voltou a vazio). Mutuamente exclusivo com `pendingConfirmation` na prática (reprovar sempre
   * limpa `actualEnd`) — é o que avisa a pessoa que precisa informar de novo. */
  rejected?: boolean;
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
  pendingConfirmation,
  rejected,
}: StatusBadgeProps) {
  const showStartDelayed = shouldShowStartDelayedBadge({ isStartDelayed: startDelayed, isBlocked: blocked, status });

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
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

      {pendingConfirmation && (
        <span
          aria-label="Aguardando confirmação do administrador"
          title="Aguardando confirmação do administrador"
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-page px-1.5 py-0.5 text-[10px] font-semibold text-text-muted2"
        >
          <UserCheck className="h-3 w-3" aria-hidden="true" />
          Ag. confirmação
        </span>
      )}

      {rejected && (
        <span
          aria-label="Finalização não validada pelo administrador"
          title="Finalização não validada pelo administrador"
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-status-delayed/10 px-1.5 py-0.5 text-[10px] font-semibold text-status-delayed"
        >
          <XCircle className="h-3 w-3" aria-hidden="true" />
          Não validado
        </span>
      )}
    </span>
  );
}
