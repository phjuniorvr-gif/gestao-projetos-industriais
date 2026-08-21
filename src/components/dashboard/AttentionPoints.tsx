import { Card } from '../ui';

interface AttentionPoint {
  color: string;
  title: string;
  subtitle: string;
}

interface AttentionPointsProps {
  points: AttentionPoint[];
}

/** "Pontos de atenção" — só os itens viáveis com o dado que já existe hoje (sem gerente definido,
 * concluídos no período). O item "sem atualização recente" do mockup do usuário ficou de fora:
 * precisaria de um `updated_at` que nenhuma tabela tem ainda (decisão confirmada com o usuário,
 * fica pra uma sessão futura dedicada à migration). */
export function AttentionPoints({ points }: AttentionPointsProps) {
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-text">Pontos de atenção</p>
      <p className="mb-3 text-xs text-text-muted">Indicadores que merecem acompanhamento</p>

      {points.length === 0 ? (
        <p className="text-sm text-text-muted">Nada a destacar agora.</p>
      ) : (
        <ul className="divide-y divide-border">
          {points.map((point) => (
            <li key={point.title} className="flex items-start gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: point.color }} />
              <div className="min-w-0">
                <p className="font-medium text-text">{point.title}</p>
                <p className="text-xs text-text-muted">{point.subtitle}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
