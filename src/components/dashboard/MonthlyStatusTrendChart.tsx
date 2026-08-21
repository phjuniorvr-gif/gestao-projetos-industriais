import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProjectView } from '../../types';
import { STATUS_COLOR } from '../../types';
import { Card } from '../ui';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface MonthlyStatusTrendChartProps {
  projects: ProjectView[];
  /** Ano de referência (string "2026" ou vazia = ano atual) — mesmo filtro "Ano" do resto do
   * Dashboard. */
  year: string;
}

/** Projetos agrupados pelo mês do PRAZO PREVISTO (plannedEnd), coloridos pelo status ATUAL —
 * "quantos projetos vencem em cada mês, e em que situação estão" (não é uma curva histórica de
 * status ao longo do tempo — o app não guarda snapshot de status por data, só o status de hoje). */
export function MonthlyStatusTrendChart({ projects, year }: MonthlyStatusTrendChartProps) {
  const referenceYear = year || new Date().getFullYear().toString();

  const data = MONTH_LABELS.map((label, index) => {
    const monthKey = `${referenceYear}-${String(index + 1).padStart(2, '0')}`;
    const inMonth = projects.filter((p) => p.plannedEnd?.slice(0, 7) === monthKey);
    return {
      month: label,
      em_andamento: inMonth.filter((p) => p.status === 'in_progress').length,
      atrasado: inMonth.filter((p) => p.status === 'delayed').length,
      concluido: inMonth.filter((p) => p.status === 'completed').length,
    };
  });

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-text">Projetos por mês de prazo</p>
      <p className="mb-3 text-xs text-text-muted">Entregas previstas em {referenceYear}, por status atual</p>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
            <Tooltip />
            <Legend
              formatter={(value) => (value === 'em_andamento' ? 'Em andamento' : value === 'atrasado' ? 'Atrasado' : 'Concluído')}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Line type="monotone" dataKey="em_andamento" stroke={STATUS_COLOR.in_progress} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="atrasado" stroke={STATUS_COLOR.delayed} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="concluido" stroke={STATUS_COLOR.completed} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
