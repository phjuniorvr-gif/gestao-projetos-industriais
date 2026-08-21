import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type PieSectorDataItem } from 'recharts';
import { Card } from '../ui';

interface UnitEntry {
  unit: string;
  count: number;
  delayed: number;
}

interface UnitDonutChartProps {
  data: UnitEntry[];
  onSelectUnit?: (unit: string) => void;
}

/** Paleta fixa por posição (não há cor "oficial" de unidade em nenhum lugar do app) — cicla se
 * tiver mais unidades que cores. */
const UNIT_COLORS = ['#2563EB', '#7C3AED', '#0EA5E9', '#059669', '#D97706', '#DB2777'];

/** Rosca de "Projetos por unidade" — mesmo componente-padrão do `StatusDonutChart`, ao lado dele
 * no Dashboard (pedido do usuário: trocar a barra horizontal por rosca, lado a lado). */
export function UnitDonutChart({ data, onSelectUnit }: UnitDonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const chartData = data.map((d, i) => ({ ...d, color: UNIT_COLORS[i % UNIT_COLORS.length] }));

  return (
    <Card className="p-4">
      <p className="mb-3 text-sm font-semibold text-text">Projetos por unidade</p>
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-40 w-40 shrink-0">
          {chartData.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">Sem projetos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="unit"
                  innerRadius="65%"
                  outerRadius="100%"
                  paddingAngle={chartData.length > 1 ? 2 : 0}
                  stroke="none"
                  onClick={(entry: PieSectorDataItem) => {
                    const unit = (entry as unknown as UnitEntry).unit;
                    if (unit) onSelectUnit?.(unit);
                  }}
                  style={{ cursor: onSelectUnit ? 'pointer' : undefined }}
                >
                  {chartData.map((d) => (
                    <Cell key={d.unit} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const payload = item?.payload as (UnitEntry & { color: string }) | undefined;
                    return [`${value} projeto${value === 1 ? '' : 's'}`, payload?.unit ?? ''];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-text">{total}</span>
            <span className="text-xs text-text-muted">projeto{total === 1 ? '' : 's'}</span>
          </div>
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {chartData.map((d) => (
            <li key={d.unit}>
              <button
                type="button"
                onClick={() => onSelectUnit?.(d.unit)}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-text hover:bg-page"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                {d.unit}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
