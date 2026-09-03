import { Search, X } from 'lucide-react';
import { Button, Input } from '../ui';
import { STATUS_LABEL } from '../../types';
import { computeActiveFilterCount } from '../../utils/portfolio';
import { FilterSelect } from './FilterSelect';

export interface ProjectFiltersState {
  search: string;
  unit: string;
  /** Vários status ao mesmo tempo (Ctrl/Cmd+clique nos cards de saúde) — o dropdown abaixo
   * continua de seleção única, só escreve um item nesse array. */
  status: string[];
  year: string;
}

export const EMPTY_FILTERS: ProjectFiltersState = { search: '', unit: '', status: [], year: '' };

interface ProjectFiltersProps {
  filters: ProjectFiltersState;
  units: string[];
  years: string[];
  onChange: (filters: ProjectFiltersState) => void;
  /** Aba Importação (pedido do usuário) — some com o dropdown "Status", já redundante lá: o
   * status de tarefa é filtrado pelos cards/chips (`ProjectsHealthStrip`/"Status das tarefas"), e
   * esse dropdown escreve no MESMO `filters.status` com rótulos de projeto ("Atrasado", não
   * "Tarefa Atrasada") — confuso duplicar o controle com um rótulo que não bate. */
  hideStatus?: boolean;
  /** Aba Importação (pedido do usuário) — some com a busca "Buscar projeto ou responsável", que
   * busca por PROJETO (código/nome/gerente), sem sentido numa lista achatada por atividade/tarefa
   * onde o projeto nem tem linha própria. */
  hideSearch?: boolean;
}

export function ProjectFilters({ filters, units, years, onChange, hideStatus = false, hideSearch = false }: ProjectFiltersProps) {
  const activeCount = computeActiveFilterCount(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hideSearch && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted2" />
          <Input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Buscar projeto ou responsável"
            aria-label="Buscar projeto ou responsável"
            className="w-64 pl-8"
          />
        </div>
      )}
      <FilterSelect label="Unidade" value={filters.unit} onChange={(unit) => onChange({ ...filters, unit })} options={units} />
      {!hideStatus && (
        <FilterSelect
          label="Status"
          value={filters.status[0] ?? ''}
          onChange={(status) => onChange({ ...filters, status: status ? [status] : [] })}
          options={Object.values(STATUS_LABEL)}
        />
      )}
      <FilterSelect label="Ano" value={filters.year} onChange={(year) => onChange({ ...filters, year })} options={years} />
      {activeCount > 0 && (
        <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => onChange(EMPTY_FILTERS)}>
          Limpar filtros ({activeCount})
        </Button>
      )}
    </div>
  );
}
