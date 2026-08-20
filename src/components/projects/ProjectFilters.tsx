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
}

export function ProjectFilters({ filters, units, years, onChange }: ProjectFiltersProps) {
  const activeCount = computeActiveFilterCount(filters);

  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <FilterSelect label="Unidade" value={filters.unit} onChange={(unit) => onChange({ ...filters, unit })} options={units} />
      <FilterSelect
        label="Status"
        value={filters.status[0] ?? ''}
        onChange={(status) => onChange({ ...filters, status: status ? [status] : [] })}
        options={Object.values(STATUS_LABEL)}
      />
      <FilterSelect label="Ano" value={filters.year} onChange={(year) => onChange({ ...filters, year })} options={years} />
      {activeCount > 0 && (
        <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => onChange(EMPTY_FILTERS)}>
          Limpar filtros ({activeCount})
        </Button>
      )}
    </div>
  );
}
