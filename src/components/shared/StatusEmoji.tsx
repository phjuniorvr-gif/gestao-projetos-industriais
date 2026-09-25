import { Frown, Meh, Smile } from 'lucide-react';
import { STATUS_COLOR, STATUS_LABEL, type ProjectStatus } from '../../types';
import { shouldShowStartDelayedBadge } from '../../utils/status';

const ICON_BY_STATUS: Record<ProjectStatus, typeof Smile> = {
  completed: Smile,
  in_progress: Meh,
  delayed: Frown,
  planned: Smile,
};

interface StatusEmojiProps {
  status: ProjectStatus;
  className?: string;
  /** Mesma condição do selo textual (`StatusBadge.tsx`) — início previsto vencido sem início
   * real (`TaskView.isStartDelayed`, e `isBlocked` pra suprimir quando bloqueada por
   * predecessora, mesmo raciocínio de lá). Passado só por chamador de nível TAREFA — nível
   * atividade/projeto não tem esse par de props, fica sempre na cor normal do status. */
  blocked?: boolean;
  startDelayed?: boolean;
}

/** Ícone-emoticon por status (mesmo mapeamento dos cards de saúde de Projetos/Cronograma),
 * reusado linha a linha (projeto/atividade/tarefa) na coluna "Status" do Gantt. Pedido do
 * usuário — mesmo tratamento laranja do selo "Não iniciada" (`StatusBadge.tsx`) também aqui, pra
 * diferenciar visualmente a condição sem precisar ler o texto do selo ao lado. */
export function StatusEmoji({ status, className = 'h-4 w-4', blocked, startDelayed }: StatusEmojiProps) {
  const Icon = ICON_BY_STATUS[status];
  const showStartDelayed = shouldShowStartDelayedBadge({ isStartDelayed: startDelayed, isBlocked: blocked, status });
  const label = showStartDelayed ? 'Não iniciada' : STATUS_LABEL[status];
  const color = showStartDelayed ? STATUS_COLOR.delayed : STATUS_COLOR[status];
  return (
    <span title={label} aria-label={label}>
      <Icon className={className} style={{ color }} aria-hidden="true" />
    </span>
  );
}
