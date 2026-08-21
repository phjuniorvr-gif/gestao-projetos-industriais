import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type PieSectorDataItem } from 'recharts';
import { STATUS_COLOR, STATUS_LABEL, type ProjectStatus } from '../../types';
import type { StatusDistributionEntry } from '../../utils/portfolio';
import { Card } from '../ui';

interface StatusDonutChartProps {
  distribution: StatusDistributionEntry[];
  onSelectStatus?: (status: ProjectStatus) => void;
  subtitle?: string;
  /** "Leitura rápida" — frase-resumo do Dashboard, opcional (as outras telas que usam este
   * componente não precisam dela). */
  summary?: string;
}

/** Rosca de status (Recharts) + legenda clicável ao lado — versão "infográfica" do Dashboard,
 * pedida pelo usuário como alternativa mais visual à grade de cards (`StatusGrid`, que segue
 * sendo o padrão nas telas mobile). Primeiro gráfico de verdade do projeto — decisão confirmada
 * com o usuário: instalar Recharts em vez de desenhar SVG à mão. */
export function StatusDonutChart({ distribution, onSelectStatus, subtitle, summary }: StatusDonutChartProps) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  const data = distribution.filter((d) => d.count > 0);

  return (
    <Card className="p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-text">Status dos projetos</p>
        {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-40 w-40 shrink-0">
          {data.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">Sem projetos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="status"
                  innerRadius="65%"
                  outerRadius="100%"
                  paddingAngle={data.length > 1 ? 2 : 0}
                  stroke="none"
                  onClick={(entry: PieSectorDataItem) => {
                    const status = (entry as unknown as StatusDistributionEntry).status;
                    if (status) onSelectStatus?.(status);
                  }}
                  style={{ cursor: onSelectStatus ? 'pointer' : undefined }}
                >
                  {data.map((d) => (
                    <Cell key={d.status} fill={STATUS_COLOR[d.status]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => {
                    const payload = item?.payload as StatusDistributionEntry | undefined;
                    const label = payload ? STATUS_LABEL[payload.status] : '';
                    return [`${value} projeto${value === 1 ? '' : 's'}`, label];
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
          {distribution.map((d) => (
            <li key={d.status}>
              <button
                type="button"
                onClick={() => onSelectStatus?.(d.status)}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-text hover:bg-page"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLOR[d.status] }} />
                {STATUS_LABEL[d.status]}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {summary && (
        <p className="mt-4 rounded-md bg-page px-3 py-2 text-xs text-text">
          <span className="font-semibold">Leitura rápida: </span>
          {summary}
        </p>
      )}
    </Card>
  );
}
