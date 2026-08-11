import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import type { Holiday, Person, Project, ProjectView, Task } from '../../types';
import { STATUS_COLOR } from '../../types';
import { businessDaysBetween, formatDatePtBr, formatPeriod } from '../../utils';
import { computeActivityTeam, computeExpectedProgress, computeScheduleDeviationDays } from '../../utils/portfolio';
import { Button, FormField, Input, Textarea } from '../ui';
import { PersonSelect } from '../shared/PersonSelect';
import { InlineTaskProgressEdit } from './InlineTaskProgressEdit';
import { MiniGantt } from './MiniGantt';

interface ProjectDetailPanelProps {
  project: ProjectView | null;
  people: Person[];
  today: string;
  holidays: Holiday[];
  onCreatePerson: (name: string) => Promise<Person>;
  onSave: (patch: Pick<Project, 'name' | 'description' | 'unit' | 'gerenteId'>) => void;
  onAddActivity: () => void;
  onUpdateTask: (projectId: string, taskId: string, patch: Pick<Task, 'actualStart' | 'actualEnd'>) => void;
  onClose: () => void;
}

function avatarInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Painel lateral de detalhe/edição (Fase 3) — substitui `EditProjectDialog` (modal). Leitura por
 * padrão, "Editar" só na seção Identificação (único bloco com campo bruto de verdade); o resto
 * é sempre derivado. Fecha com Esc ou clique no scrim; lista continua visível atrás.
 */
export function ProjectDetailPanel({
  project,
  people,
  today,
  holidays,
  onCreatePerson,
  onSave,
  onAddActivity,
  onUpdateTask,
  onClose,
}: ProjectDetailPanelProps) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(false);
  const [progressPopoverOpen, setProgressPopoverOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [gerenteId, setGerenteId] = useState<string | undefined>();

  useEffect(() => {
    if (!project) return;
    setEditingId(false);
    setName(project.name);
    setDescription(project.description ?? '');
    setUnit(project.unit);
    setGerenteId(project.gerenteId);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [project, onClose]);

  if (!project) return null;

  const gerente = people.find((p) => p.id === project.gerenteId);
  const allTasks = project.activities.flatMap((a) => a.tasks);
  const dependencyCount = allTasks.reduce((sum, t) => sum + t.predecessorRowNumbers.length, 0);
  const durationDays =
    project.plannedStart && project.plannedEnd
      ? businessDaysBetween(project.plannedStart, project.plannedEnd, holidays, project.unit)
      : undefined;
  const expected = computeExpectedProgress(allTasks, today, holidays, project.unit);

  function handleSaveIdentificacao() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() || undefined, unit: unit.trim(), gerenteId });
    setEditingId(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-[430px] flex-col overflow-y-auto bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="font-mono text-xs text-text-muted2">{project.code}</p>
            <p className="text-base font-semibold text-text">{project.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-text-muted hover:bg-page hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 px-5 py-4">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted2">Identificação</h3>
              {!editingId && (
                <button
                  type="button"
                  onClick={() => setEditingId(true)}
                  className="text-xs font-medium text-action hover:underline"
                >
                  Editar
                </button>
              )}
            </div>
            {editingId ? (
              <div className="space-y-3">
                <FormField label="Nome do projeto" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
                </FormField>
                <FormField label="Descrição / observação">
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full" />
                </FormField>
                <FormField label="Unidade">
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full" />
                </FormField>
                <FormField label="Gerente do projeto">
                  <PersonSelect
                    value={gerenteId}
                    onChange={setGerenteId}
                    people={people}
                    onCreatePerson={onCreatePerson}
                    placeholder="Sem gerente"
                  />
                </FormField>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setEditingId(false)}>
                    Cancelar
                  </Button>
                  <Button variant="primary" onClick={handleSaveIdentificacao}>
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-sm text-text">
                <p>{project.unit}</p>
                <p className="text-text-muted">{gerente?.name ?? 'Sem gerente'}</p>
                {project.description && <p className="text-text-muted">{project.description}</p>}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted2">Cronograma</h3>
            <MiniGantt
              plannedStart={project.plannedStart}
              plannedEnd={project.plannedEnd}
              actualStart={project.actualStart}
              actualEnd={project.actualEnd}
              status={project.status}
              today={today}
            />
            <div className="mt-2 space-y-0.5 text-xs text-text-muted">
              <p>Previsto: {formatPeriod(project.plannedStart, project.plannedEnd)}</p>
              <p>Real: {project.actualStart ? formatPeriod(project.actualStart, project.actualEnd) : 'Não iniciado'}</p>
            </div>
          </section>

          <section className="relative">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted2">Avanço</h3>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg font-semibold text-text">{project.progress}%</span>
              <span className="text-xs text-text-muted2">previsto pra hoje: {expected}%</span>
            </div>
            <div className="relative mt-2 h-1.5 w-full rounded-full bg-page">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${project.progress}%`, backgroundColor: STATUS_COLOR[project.status] }}
              />
              <div className="absolute top-0 h-1.5 w-px bg-text-ink2" style={{ left: `${expected}%` }} />
            </div>
            {allTasks.some((t) => t.status !== 'completed') && (
              <button
                type="button"
                onClick={() => setProgressPopoverOpen((o) => !o)}
                className="mt-2 text-xs font-medium text-action hover:underline"
              >
                Atualizar avanço
              </button>
            )}
            <InlineTaskProgressEdit
              project={project}
              open={progressPopoverOpen}
              onClose={() => setProgressPopoverOpen(false)}
              onConfirm={(taskId, patch) => onUpdateTask(project.id, taskId, patch)}
            />
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted2">Escopo</h3>
            <p className="text-sm text-text-muted">
              {dependencyCount} dependência{dependencyCount === 1 ? '' : 's'} entre tarefas
            </p>
            <p className="text-sm text-text-muted">
              {durationDays !== undefined ? `${durationDays} dias úteis previstos` : 'Duração ainda não definida'}
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted2">Atividades e equipe</h3>
              <button type="button" onClick={onAddActivity} className="text-xs font-medium text-action hover:underline">
                + Adicionar atividade
              </button>
            </div>
            <p className="mb-2 text-[11px] text-text-muted2">
              A equipe do projeto não é digitada — sai de quem responde por cada tarefa.
            </p>
            {project.activities.length === 0 ? (
              <p className="text-sm text-text-muted">Nenhuma atividade ainda.</p>
            ) : (
              <ul className="space-y-2">
                {project.activities.map((activity) => {
                  const team = computeActivityTeam(activity, people);
                  const deviation = computeScheduleDeviationDays(
                    { status: activity.status, plannedEnd: activity.plannedEnd, actualEnd: activity.actualEnd, unit: project.unit },
                    today,
                    holidays,
                  );
                  return (
                    <li key={activity.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-text">{activity.name}</p>
                        <p className="text-xs text-text-muted2">
                          {activity.plannedEnd ? `Entrega ${formatDatePtBr(activity.plannedEnd)}` : 'Sem tarefas'}
                          {deviation > 0 && ` · +${deviation}d`}
                        </p>
                      </div>
                      {team.length > 0 && (
                        <span className="flex -space-x-1.5">
                          {team.slice(0, 3).map(({ person, hasDelayedTask }) => (
                            <span
                              key={person.id}
                              title={person.name}
                              className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 border-card text-[9px] font-semibold ${
                                hasDelayedTask ? 'bg-status-delayed-bg text-status-delayed' : 'bg-border-2 text-text-muted'
                              }`}
                            >
                              {avatarInitials(person.name)}
                            </span>
                          ))}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={() => navigate(`/projetos/${project.id}/cronograma`)}>
            Ver atividades
          </Button>
        </div>
      </div>
    </div>
  );
}
