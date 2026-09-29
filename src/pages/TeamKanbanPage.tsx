import { useMemo, useState } from 'react';
import { PageHeader } from '../components/layout';
import { UpcomingTaskDetail } from '../components/gantt';
import { Card, EmptyState } from '../components/ui';
import { FilterSelect } from '../components/projects';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useUpcomingTasksData } from '../hooks';
import { STATUS_COLOR, STATUS_LABEL, type ActivityView, type ProjectStatus, type ProjectView, type TaskView } from '../types';
import { formatDatePtBr } from '../utils';

interface KanbanRow {
  project: ProjectView;
  activity: ActivityView;
  task: TaskView;
}

// Ordem de fluxo (não a de urgência que `STATUS_RANK`/faixa de saúde usam) — um quadro lê da
// esquerda pra direita como o trabalho progride: Planejado → Em andamento → Atrasado → Concluído.
const STATUS_ORDER: ProjectStatus[] = ['planned', 'in_progress', 'delayed', 'completed'];

/**
 * "Kanban da Equipe" (pedido do usuário) — admin-only, portfólio INTEIRO (todo status, sem janela
 * de data, diferente de "Tarefas por vencer") agrupado em 4 colunas de status; um seletor de
 * "Responsável" filtra pra ver só a carga de uma pessoa. Reaproveita `useUpcomingTasksData()` só
 * pela fiação (people/categories/holidays/isAdmin/mutações/`TaskPanel` via `UpcomingTaskDetail`,
 * mesmo padrão de `PendingConfirmationsPage.tsx`) — não pelo `rows`/`windowDays` dali, que exclui
 * concluída e restringe por janela; aqui a base é `data.projects` direto, sem window nenhuma.
 */
export function TeamKanbanPage() {
  const data = useUpcomingTasksData();
  const { projects, people, isAdmin } = data;
  const [responsavelFilter, setResponsavelFilter] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const allRows = useMemo(() => {
    const list: KanbanRow[] = [];
    for (const project of projects) {
      for (const activity of project.activities) {
        for (const task of activity.tasks) list.push({ project, activity, task });
      }
    }
    return list;
  }, [projects]);

  // Só quem tem pelo menos 1 tarefa aparece no seletor (mesmo raciocínio de `importacaoProjectOptions`
  // — lista de opções que sempre bate com algo, nunca mostra alguém com o quadro vazio de propósito).
  const responsavelOptions = useMemo(() => {
    const ids = new Set(allRows.map((r) => r.task.responsavelId).filter((id): id is string => Boolean(id)));
    return Array.from(ids)
      .map((id) => people.find((p) => p.id === id))
      .filter((p): p is (typeof people)[number] => Boolean(p))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((p) => ({ value: p.id, label: p.name }));
  }, [allRows, people]);

  const visibleRows = useMemo(
    () => (responsavelFilter ? allRows.filter((r) => r.task.responsavelId === responsavelFilter) : allRows),
    [allRows, responsavelFilter],
  );

  const groups = useMemo(() => {
    const byStatus: Record<ProjectStatus, KanbanRow[]> = { planned: [], in_progress: [], delayed: [], completed: [] };
    for (const row of visibleRows) byStatus[row.task.status].push(row);
    return byStatus;
  }, [visibleRows]);

  // Fase 5 — o item "Equipe" do menu já fica escondido pra quem não é administrador; esta guarda
  // cobre quem chega direto pela URL. `isAdmin === false` (não `undefined`, ainda carregando) pra
  // não piscar essa mensagem antes de saber o papel de verdade — mesmo padrão de `NewProjectPage.tsx`.
  if (isAdmin === false) {
    return (
      <EmptyState
        title="Somente administrador pode ver o Kanban da Equipe"
        description="Fale com um administrador do sistema para acessar esta tela."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kanban da Equipe"
        subtitle="Tarefas do portfólio inteiro, por responsável, organizadas por status"
        actions={
          <FilterSelect label="Responsável" value={responsavelFilter} onChange={setResponsavelFilter} options={responsavelOptions} />
        }
      />

      {allRows.length === 0 ? (
        <EmptyState title="Nenhuma tarefa cadastrada" description="Ainda não há tarefas no portfólio." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATUS_ORDER.map((status) => (
              <Card key={status} className="overflow-hidden p-0">
                <div className="px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: STATUS_COLOR[status] }}>
                  {STATUS_LABEL[status]}
                </div>
                <div className="px-3 py-3">
                  <span className="text-2xl font-bold text-text">{groups[status].length}</span>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATUS_ORDER.map((status) => (
              <div key={status} className="space-y-2">
                {groups[status].length === 0 ? (
                  <p className="px-1 text-xs text-text-muted2">Nenhuma tarefa neste status.</p>
                ) : (
                  groups[status].map(({ project, activity, task }) => {
                    const responsavel = people.find((p) => p.id === task.responsavelId)?.name ?? 'Sem responsável';
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => setSelectedTaskId(task.id)}
                        className="block w-full text-left"
                      >
                        <Card
                          className="space-y-1.5 border-l-4 p-3 transition-colors hover:border-text-muted2"
                          style={{ borderLeftColor: STATUS_COLOR[status] }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-text">{task.name}</span>
                            <span className="shrink-0 font-mono text-xs text-text-muted2">{project.code}</span>
                          </div>
                          <p className="truncate text-xs text-text-muted">
                            {project.code} — {project.name} · {activity.name}
                          </p>
                          <p className="truncate text-xs text-text-muted">{responsavel}</p>
                          <p className="text-xs text-text-muted">
                            Previsto: {formatDatePtBr(task.plannedStart)} — {formatDatePtBr(task.plannedEnd)}
                          </p>
                          <StatusBadge
                            status={task.status}
                            blocked={task.isBlocked}
                            startDelayed={task.isStartDelayed}
                            lateCompletion={task.isLateCompletion}
                            lateCompletionDays={task.lateCompletionDays}
                            pendingConfirmation={task.pendingConfirmation}
                            rejected={task.rejected}
                          />
                        </Card>
                      </button>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <UpcomingTaskDetail data={data} selectedTaskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} isMobile={false} />
    </div>
  );
}
