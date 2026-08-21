import type { Person, ProjectView } from '../../types';
import { STATUS_COLOR } from '../../types';
import { Card } from '../ui';

interface DelayedTasksByPersonProps {
  projects: ProjectView[];
  people: Person[];
  /** Quantas pessoas mostrar antes de agrupar o resto em "Outros" — mockup do usuário mostra 3. */
  topN?: number;
}

/** "Tarefas atrasadas por responsável" — diferente do `WorkloadPanel` (carga TOTAL de tarefas em
 * aberto, removido da tela de Projetos a pedido do usuário): aqui conta só tarefas com
 * status='delayed', pra achar onde os atrasos estão concentrados, não quem está mais ocupado. */
export function DelayedTasksByPerson({ projects, people, topN = 3 }: DelayedTasksByPersonProps) {
  const countByPerson = new Map<string, number>();
  let semResponsavel = 0;

  for (const project of projects) {
    for (const task of project.activities.flatMap((a) => a.tasks)) {
      if (task.status !== 'delayed') continue;
      if (!task.responsavelId) {
        semResponsavel += 1;
        continue;
      }
      countByPerson.set(task.responsavelId, (countByPerson.get(task.responsavelId) ?? 0) + 1);
    }
  }

  const ranked = Array.from(countByPerson.entries())
    .map(([personId, count]) => ({ person: people.find((p) => p.id === personId), count }))
    .filter((entry): entry is { person: Person; count: number } => Boolean(entry.person))
    .sort((a, b) => b.count - a.count);

  const top = ranked.slice(0, topN);
  const outrosCount = ranked.slice(topN).reduce((sum, entry) => sum + entry.count, 0);

  const rows = [
    ...top.map((entry) => ({ label: entry.person.name, count: entry.count })),
    ...(semResponsavel > 0 ? [{ label: 'Sem responsável', count: semResponsavel }] : []),
    ...(outrosCount > 0 ? [{ label: 'Outros', count: outrosCount }] : []),
  ];

  const maxCount = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-text">Tarefas atrasadas por responsável</p>
      <p className="mb-3 text-xs text-text-muted">Onde estão os principais gargalos</p>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">Nenhuma tarefa atrasada.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-3 text-sm">
              <span className="w-28 shrink-0 truncate text-text">{row.label}</span>
              <div className="h-2 flex-1 rounded-full bg-page">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${(row.count / maxCount) * 100}%`, backgroundColor: STATUS_COLOR.delayed }}
                />
              </div>
              <span className="w-4 shrink-0 text-right font-mono font-semibold text-text">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
