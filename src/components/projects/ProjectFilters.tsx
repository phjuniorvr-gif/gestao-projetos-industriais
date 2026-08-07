import { X } from 'lucide-react';
import { Button } from '../ui';
import { STATUS_LABEL } from '../../types';
import { FilterSelect } from './FilterSelect';

export interface ProjectFiltersState {
  unit: string;
  status: string;
  year: string;
}

export const EMPTY_FILTERS: ProjectFiltersState = { unit: '', status: '', year: '' };

interface ProjectFiltersProps {
  filters: ProjectFiltersState;
  units: string[];
  years: string[];
  onChange: (filters: ProjectFiltersState) => void;
}

export function ProjectFilters({ filters, units, years, onChange }: ProjectFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect label="Unidade" value={filters.unit} onChange={(unit) => onChange({ ...filters, unit })} options={units} />
      <FilterSelect
        label="Status"
        value={filters.status}
        onChange={(status) => onChange({ ...filters, status })}
        options={Object.values(STATUS_LABEL)}
      />
      <FilterSelect label="Ano" value={filters.year} onChange={(year) => onChange({ ...filters, year })} options={years} />
      <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => onChange(EMPTY_FILTERS)}>
        Limpar Filtro
      </Button>
    </div>
  );
}
