import { useMemo, useState } from 'react';
import { PageHeader } from '../components/layout';
import { RejectTaskDialog, UpcomingTaskDetail } from '../components/gantt';
import { Button, Card, EmptyState } from '../components/ui';
import { useIsMobile, useUpcomingTasksData } from '../hooks';
import type { ActivityView, ProjectView, TaskView } from '../types';

interface PendingRow {
  project: ProjectView;
  activity: ActivityView;
  task: TaskView;
}

/**
 * "Confirmações pendentes" (Fase 7+) — fila de tarefas que um usuário comum marcou como
 * concluída e que ainda esperam o administrador confirmar (`TaskView.pendingConfirmation`). Até
 * aqui a única forma de achar isso era o selo "Aguardando confirmação" espalhado pelo Cronograma/
 * Tarefas próximas — pedido do usuário por um lugar central pra revisar tudo de uma vez. Reaproveita
 * `useUpcomingTasksData()` só pela fiação (people/replanejamentos/isAdmin/TaskPanel via
 * `UpcomingTaskDetail`), não pelo filtro de 15 dias — a lista aqui é o portfólio inteiro, sem
 * janela de data (uma tarefa concluída há meses e nunca confirmada continua aparecendo).
 * Administrador e visualizador (`canViewAll`) alcançam a tela — só administrador vê os botões
 * "Confirmar"/"Reprovar" (mesmo padrão de `TaskPanel.tsx`).
 */
export function PendingConfirmationsPage() {
  const data = useUpcomingTasksData();
  const { projects, people, replanejamentos, isAdmin, confirmTaskCompletion, rejectTaskCompletion } = data;
  const isMobile = useIsMobile();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null);

  const pending = useMemo(() => {
    const list: PendingRow[] = [];
    for (const project of projects) {
      for (const activity of project.activities) {
        for (const task of activity.tasks) {
          if (task.pendingConfirmation) list.push({ project, activity, task });
        }
      }
    }
    return list.sort((a, b) => (b.task.actualEnd ?? '').localeCompare(a.task.actualEnd ?? ''));
  }, [projects]);

  const rejectingRow = pending.find((r) => r.task.id === rejectingTaskId);

  // Última entrada de "informar real" (campo='real'/campo_data='fim') pra esta tarefa — é onde
  // mora o timestamp de verdade (`actual_end` é só data, sem hora) e quem informou.
  function lastRealFimEntry(taskId: string) {
    return replanejamentos
      .filter((r) => r.tarefaId === taskId && r.campo === 'real' && r.campoData === 'fim')
      .sort((a, b) => b.quando.localeCompare(a.quando))[0];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Confirmações pendentes"
        subtitle="Tarefas marcadas como concluídas por usuários comuns, aguardando confirmação do administrador"
      />

      {pending.length === 0 ? (
        <EmptyState title="Nada pendente" description="Toda finalização já foi confirmada." />
      ) : (
        <div className="space-y-2">
          {pending.map(({ project, activity, task }) => {
            const entry = lastRealFimEntry(task.id);
            const quemNome = entry ? (people.find((p) => p.userId === entry.quemUserId)?.name ?? 'Usuário') : 'Usuário';
            const quando = entry ? new Date(entry.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
            return (
              <Card key={task.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-text-muted2">
                      {project.code} · {activity.name}
                    </p>
                    <p className="font-semibold text-text">{task.name}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      Concluída em {quando} por {quemNome}
                      {task.rejectionCount > 0 && (
                        <span className="ml-1 font-semibold text-status-delayed">
                          — já reprovada {task.rejectionCount} {task.rejectionCount === 1 ? 'vez' : 'vezes'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" onClick={() => setSelectedTaskId(task.id)}>
                      Ver
                    </Button>
                    {isAdmin === true && (
                      <>
                        <Button variant="danger" onClick={() => setRejectingTaskId(task.id)}>
                          Reprovar
                        </Button>
                        <Button variant="primary" onClick={() => confirmTaskCompletion(project.id, task.id)}>
                          Confirmar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <UpcomingTaskDetail data={data} selectedTaskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} isMobile={isMobile} />

      <RejectTaskDialog
        open={Boolean(rejectingRow)}
        taskName={rejectingRow?.task.name ?? ''}
        onCancel={() => setRejectingTaskId(null)}
        onConfirm={(motivo) => {
          if (!rejectingRow) return { valid: false, errors: ['Tarefa não encontrada.'] };
          const result = rejectTaskCompletion(rejectingRow.project.id, rejectingRow.task.id, motivo);
          if (result.valid) setRejectingTaskId(null);
          return result;
        }}
      />
    </div>
  );
}
