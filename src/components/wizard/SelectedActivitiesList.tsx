import { Fragment, useMemo } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Input } from '../ui';
import { PersonSelect } from '../shared/PersonSelect';
import { TaskDependencyInput } from '../gantt/TaskDependencyInput';
import type { Person, Task } from '../../types';
import type { DraftActivity } from './types';

interface SelectedActivitiesListProps {
  activities: DraftActivity[];
  people: Person[];
  onCreatePerson: (name: string) => Promise<Person>;
  onToggleExpand: (activityKey: string) => void;
  onRemove: (activityKey: string) => void;
  onChangeDuration: (activityKey: string, taskKey: string, durationDays: number) => void;
  onChangeResponsavel: (activityKey: string, taskKey: string, responsavelId: string | undefined) => void;
  onChangePredecessors: (activityKey: string, taskKey: string, predecessorRowNumbers: number[]) => void;
}

export function SelectedActivitiesList({
  activities,
  people,
  onCreatePerson,
  onToggleExpand,
  onRemove,
  onChangeDuration,
  onChangeResponsavel,
  onChangePredecessors,
}: SelectedActivitiesListProps) {
  const flatTasks = useMemo(() => activities.flatMap((a) => a.tasks), [activities]);

  const lineByKey = useMemo(() => {
    const map = new Map<string, number>();
    flatTasks.forEach((t, index) => map.set(t.key, index + 1));
    return map;
  }, [flatTasks]);

  const syntheticTasks: Task[] = useMemo(
    () =>
      flatTasks.map((t) => ({
        id: t.key,
        rowNumber: lineByKey.get(t.key)!,
        activityId: '',
        name: t.name,
        category: t.category,
        predecessorRowNumbers: t.predecessorRowNumbers,
        plannedStart: '',
        plannedEnd: '',
        status: 'planned',
      })),
    [flatTasks, lineByKey],
  );

  if (activities.length === 0) {
    return <p className="text-sm text-text-muted">Nenhuma atividade adicionada ainda.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-text-muted">
        {activities.length} {activities.length === 1 ? 'atividade' : 'atividades'}
      </p>

      {activities.map((activity) => {
        const lines = activity.tasks.map((t) => lineByKey.get(t.key)!);
        const rangeLabel =
          lines.length > 0
            ? `Linhas ${String(lines[0]).padStart(2, '0')}–${String(lines.at(-1)).padStart(2, '0')}`
            : 'Sem tarefas';

        return (
          <Card key={activity.key} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text">{activity.name}</p>
                <p className="text-xs text-text-muted">
                  {activity.tasks.length} {activity.tasks.length === 1 ? 'tarefa' : 'tarefas'} • {rangeLabel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  icon={activity.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  onClick={() => onToggleExpand(activity.key)}
                >
                  {activity.expanded ? 'Ocultar tarefas' : 'Expandir tarefas'}
                </Button>
                <button
                  type="button"
                  onClick={() => onRemove(activity.key)}
                  className="rounded-md p-2 text-text-muted hover:bg-status-delayed/10 hover:text-status-delayed"
                  aria-label={`Excluir ${activity.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {activity.expanded && activity.tasks.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-page/60 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="w-16 px-3 py-2 text-center">Linha</th>
                      <th className="px-3 py-2">Tarefa</th>
                      <th className="w-40 px-3 py-2">Responsável</th>
                      <th className="w-32 px-3 py-2">Duração</th>
                      <th className="w-44 px-3 py-2">Predecessora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.tasks.map((task) => (
                      <Fragment key={task.key}>
                        <tr className="border-b border-border/70 last:border-b-0">
                          <td className="px-3 py-2 text-center">
                            <Badge color="#64748B">{String(lineByKey.get(task.key)).padStart(2, '0')}</Badge>
                          </td>
                          <td className="px-3 py-2 text-text">{task.name}</td>
                          <td className="px-3 py-2">
                            <PersonSelect
                              value={task.responsavelId}
                              onChange={(id) => onChangeResponsavel(activity.key, task.key, id)}
                              people={people}
                              onCreatePerson={onCreatePerson}
                              placeholder="Sem responsável"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={1}
                                value={task.durationDays}
                                onChange={(e) =>
                                  onChangeDuration(activity.key, task.key, Math.max(1, Number(e.target.value) || 1))
                                }
                                className="w-16"
                              />
                              <span className="text-xs text-text-muted">du</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <TaskDependencyInput
                              value={task.predecessorRowNumbers}
                              allTasks={syntheticTasks}
                              taskRowNumber={lineByKey.get(task.key)!}
                              onChange={(numbers, validation) => {
                                if (validation.valid) onChangePredecessors(activity.key, task.key, numbers);
                              }}
                            />
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
