import { RefreshCw, X } from 'lucide-react';
import { STATUS_LABEL } from '../../types';
import { Button, Card, FormField, Select } from '../ui';

const PERIOD_OPTIONS = [
  { value: 30, label: 'Próximos 30 dias' },
  { value: 60, label: 'Próximos 60 dias' },
  { value: 90, label: 'Próximos 90 dias' },
];

interface DashboardFiltersProps {
  year: string;
  years: string[];
  onYearChange: (year: string) => void;
  periodDays: number;
  onPeriodChange: (days: number) => void;
  unit: string;
  units: string[];
  onUnitChange: (unit: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onClear: () => void;
}

/** Barra de filtros do Dashboard — Ano/Período/Unidade/Status ficam locais à página (nenhum
 * outro lugar do app precisa deles combinados assim); "Exportar" do mockup do usuário ficou de
 * fora por enquanto (escopo não definido ainda). */
export function DashboardFilters({
  year,
  years,
  onYearChange,
  periodDays,
  onPeriodChange,
  unit,
  units,
  onUnitChange,
  status,
  onStatusChange,
  onRefresh,
  refreshing,
  onClear,
}: DashboardFiltersProps) {
  const hasActiveFilter = Boolean(year || unit || status || periodDays !== 90);

  return (
    <Card className="flex flex-wrap items-end justify-between gap-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Ano" className="w-28">
          <Select value={year} onChange={(e) => onYearChange(e.target.value)} className="w-full">
            <option value="">Todos</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Período" className="w-44">
          <Select value={periodDays} onChange={(e) => onPeriodChange(Number(e.target.value))} className="w-full">
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Unidade" className="w-36">
          <Select value={unit} onChange={(e) => onUnitChange(e.target.value)} className="w-full">
            <option value="">Todas</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Status" className="w-36">
          <Select value={status} onChange={(e) => onStatusChange(e.target.value)} className="w-full">
            <option value="">Todos</option>
            {Object.values(STATUS_LABEL).map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex items-center gap-2">
        {hasActiveFilter && (
          <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={onClear}>
            Limpar filtros
          </Button>
        )}
        <Button variant="secondary" icon={<RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />} onClick={onRefresh}>
          Atualizar
        </Button>
      </div>
    </Card>
  );
}
