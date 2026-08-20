import { ListChecks } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ProjectStatus, ProjectView } from '../../types';
import { STATUS_COLOR, STATUS_LABEL } from '../../types';
import { computeStatusDistribution } from '../../utils/portfolio';
import { Card } from '../ui';
import { StatusEmoji } from '../shared/StatusEmoji';

interface ProjectsHealthStripProps {
  /** Já filtrado por busca/unidade/ano, mas NUNCA por status — é a base que os 4 cards de status
   * usam pra contar (senão selecionar "Atrasado" zeraria os outros em vez de só filtrar a tabela). */
  projects: ProjectView[];
  /** Contagem do card "Total" — essa sim reflete o filtro de status também, pra bater com o que a
   * tabela mostra (pedido do usuário: total conta só o que está selecionado). */
  totalCount: number;
  activeStatuses: ProjectStatus[];
  /** `multi` vem do Ctrl/Cmd+clique — acrescenta/remove o status da seleção em vez de trocar. */
  onToggleStatus: (status: ProjectStatus, multi: boolean) => void;
}

const STATUS_CARD_ORDER: ProjectStatus[] = ['completed', 'in_progress', 'delayed', 'planned'];

/** Cards de saúde: total + um por status, clicáveis (filtra a tabela) — substitui a barra
 * empilhada + chips (Fase 3) por um resumo mais direto, a pedido do usuário. Reflete busca/
 * unidade/ano (recebe a lista já filtrada por esses três); status é tratado à parte, ver
 * `totalCount` acima. */
export function ProjectsHealthStrip({ projects, totalCount, activeStatuses, onToggleStatus }: ProjectsHealthStripProps) {
  const distribution = computeStatusDistribution(projects);
  const countOf = (status: ProjectStatus) => distribution.find((d) => d.status === status)?.count ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Card className="overflow-hidden p-0">
        <div className="bg-text px-3 py-1.5 text-xs font-semibold text-white">Total de Projetos</div>
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-2xl font-bold text-text">{totalCount}</span>
          <ListChecks className="h-6 w-6 text-text" />
        </div>
      </Card>

      {STATUS_CARD_ORDER.map((status) => (
        <button
          key={status}
          type="button"
          onClick={(e) => onToggleStatus(status, e.ctrlKey || e.metaKey)}
          className="text-left"
          title="Ctrl+clique pra selecionar mais de um status"
        >
          <Card
            className={`overflow-hidden p-0 transition-opacity ${
              activeStatuses.includes(status)
                ? 'ring-2 ring-offset-1'
                : activeStatuses.length > 0
                  ? 'opacity-50'
                  : ''
            }`}
            style={activeStatuses.includes(status) ? ({ '--tw-ring-color': STATUS_COLOR[status] } as CSSProperties) : undefined}
          >
            <div className="px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: STATUS_COLOR[status] }}>
              {STATUS_LABEL[status]}
            </div>
            <div className="flex items-center justify-between px-3 py-3">
              <span className="text-2xl font-bold text-text">{countOf(status)}</span>
              <StatusEmoji status={status} className="h-6 w-6" />
            </div>
          </Card>
        </button>
      ))}
    </div>
  );
}
