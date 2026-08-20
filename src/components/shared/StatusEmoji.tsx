import { Frown, Meh, Smile } from 'lucide-react';
import { STATUS_COLOR, STATUS_LABEL, type ProjectStatus } from '../../types';

const ICON_BY_STATUS: Record<ProjectStatus, typeof Smile> = {
  completed: Smile,
  in_progress: Meh,
  delayed: Frown,
  planned: Smile,
};

interface StatusEmojiProps {
  status: ProjectStatus;
  className?: string;
}

/** Ícone-emoticon por status (mesmo mapeamento dos cards de saúde de Projetos/Cronograma),
 * reusado linha a linha (projeto/atividade/tarefa) na coluna "Status" do Gantt. */
export function StatusEmoji({ status, className = 'h-4 w-4' }: StatusEmojiProps) {
  const Icon = ICON_BY_STATUS[status];
  return (
    <span title={STATUS_LABEL[status]} aria-label={STATUS_LABEL[status]}>
      <Icon className={className} style={{ color: STATUS_COLOR[status] }} aria-hidden="true" />
    </span>
  );
}
