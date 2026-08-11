import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { AddActivityDialog } from '../components/gantt';
import {
  AttentionPanel,
  EMPTY_FILTERS,
  ProjectDetailPanel,
  ProjectFilters,
  ProjectsHealthStrip,
  ProjectsTable,
  WorkloadPanel,
  type ProjectFiltersState,
} from '../components/projects';
import { Button, UndoToast } from '../components/ui';
import { useHolidays, usePeople, useProjects, useUndoToast } from '../hooks';
import { sortProjectsByCriticality } from '../utils';
import { STATUS_LABEL, type ProjectStatus, type ProjectView } from '../types';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, today, addActivity, createProject, removeProject, restoreProject, updateProjectInfo, updateTask } =
    useProjects();
  const { people, createPerson } = usePeople();
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const { toast, show, dismiss } = useUndoToast();
  const [filters, setFilters] = useState<ProjectFiltersState>(EMPTY_FILTERS);
  // Guarda só o id, não o ProjectView capturado no clique — o painel precisa refletir o projeto
  // sempre atualizado (ex.: depois de salvar Identificação ou adicionar atividade, sem fechar),
  // não uma foto congelada de quando a linha foi clicada.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingActivityToId, setAddingActivityToId] = useState<string | null>(null);
  const editing = projects.find((p) => p.id === editingId) ?? null;
  const addingActivityTo = projects.find((p) => p.id === addingActivityToId) ?? null;

  const handleDelete = (project: ProjectView) => {
    removeProject(project.id);
    show(`${project.code} movido para Excluídos`, () => restoreProject(project));
  };

  /** Clona nome/categoria/datas/predecessoras de cada tarefa — mesmo formato que createProject já
   * aceita do wizard, sem precisar de nenhuma lógica nova de "duplicar" no backend/hook. */
  const handleDuplicate = (project: ProjectView) => {
    createProject({
      name: `${project.name} (cópia)`,
      description: project.description,
      unit: project.unit,
      sector: project.sector,
      gerenteId: project.gerenteId,
      activities: project.activities.map((activity) => ({
        name: activity.name,
        tasks: activity.tasks.map((task) => ({
          name: task.name,
          category: task.category,
          responsavelId: task.responsavelId,
          plannedStart: task.plannedStart,
          plannedEnd: task.plannedEnd,
          predecessorRowNumbers: task.predecessorRowNumbers,
        })),
      })),
    });
  };

  const safeHolidays = holidaysLoaded ? holidays : [];

  const units = useMemo(
    () => Array.from(new Set(projects.map((p) => p.unit).filter(Boolean))).sort(),
    [projects],
  );
  const years = useMemo(
    () =>
      Array.from(new Set(projects.map((p) => p.plannedStart?.slice(0, 4)).filter((y): y is string => Boolean(y)))).sort(),
    [projects],
  );

  const activeStatus = useMemo(
    () => (Object.keys(STATUS_LABEL) as ProjectStatus[]).find((s) => STATUS_LABEL[s] === filters.status) ?? null,
    [filters.status],
  );
  const toggleStatus = (status: ProjectStatus) => {
    setFilters((f) => ({ ...f, status: f.status === STATUS_LABEL[status] ? '' : STATUS_LABEL[status] }));
  };

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (filters.unit && p.unit !== filters.unit) return false;
        if (filters.status && STATUS_LABEL[p.status] !== filters.status) return false;
        if (filters.year && p.plannedStart?.slice(0, 4) !== filters.year) return false;
        if (filters.search.trim()) {
          const term = filters.search.trim().toLowerCase();
          const gerente = people.find((person) => person.id === p.gerenteId)?.name ?? '';
          const haystack = `${p.code} ${p.name} ${gerente}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      }),
    [projects, filters, people],
  );

  const sorted = useMemo(
    () => sortProjectsByCriticality(filtered, today, safeHolidays),
    [filtered, today, safeHolidays],
  );

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-8 -mt-6 space-y-5 border-b border-border bg-page px-8 pt-6 pb-5">
        <PageHeader
          title="Status de Projetos"
          subtitle="Visão Geral - Automação"
          actions={
            <>
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/novo-projeto')}>
                Novo Projeto
              </Button>
              <ProjectFilters filters={filters} units={units} years={years} onChange={setFilters} />
            </>
          }
        />

        <ProjectsHealthStrip
          projects={projects}
          today={today}
          holidays={safeHolidays}
          activeStatus={activeStatus}
          onToggleStatus={toggleStatus}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <ProjectsTable
          projects={sorted}
          people={people}
          today={today}
          holidays={safeHolidays}
          onEdit={(project) => setEditingId(project.id)}
          onDelete={handleDelete}
          onUpdateTask={updateTask}
          onDuplicate={handleDuplicate}
        />

        <div className="space-y-4">
          <AttentionPanel projects={projects} today={today} holidays={safeHolidays} />
          <WorkloadPanel projects={projects} people={people} />
        </div>
      </div>

      <ProjectDetailPanel
        project={editing}
        people={people}
        today={today}
        holidays={safeHolidays}
        onCreatePerson={createPerson}
        onSave={(patch) => {
          if (editing) updateProjectInfo(editing.id, patch);
        }}
        onAddActivity={() => setAddingActivityToId(editingId)}
        onUpdateTask={updateTask}
        onClose={() => setEditingId(null)}
      />

      <AddActivityDialog
        project={addingActivityTo}
        onAdd={(name) => {
          if (addingActivityTo) addActivity(addingActivityTo.id, name);
          setAddingActivityToId(null);
        }}
        onCancel={() => setAddingActivityToId(null)}
      />

      <UndoToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
