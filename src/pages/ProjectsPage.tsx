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
  type ProjectFiltersState,
} from '../components/projects';
import { Button, UndoToast } from '../components/ui';
import { useCatalog, useCategories, useHolidays, usePeople, usePerfil, useProjects, useUndoToast } from '../hooks';
import { sortProjectsByCriticality, todayISO } from '../utils';
import { STATUS_LABEL, type ProjectStatus, type ProjectView } from '../types';

export function ProjectsPage() {
  const navigate = useNavigate();
  const {
    projects,
    today,
    addActivity,
    addActivityWithTasks,
    createProject,
    removeProject,
    restoreProject,
    updateProjectInfo,
    updateTaskActualDates,
  } = useProjects();
  const { people, createPerson } = usePeople();
  const { catalog } = useCatalog();
  const { categories } = useCategories();
  const isAdmin = usePerfil();
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const { toast, show, dismiss } = useUndoToast();
  const [filters, setFilters] = useState<ProjectFiltersState>(EMPTY_FILTERS);
  // Ordenação padrão continua por criticidade (sortProjectsByCriticality) — clicar no cabeçalho
  // "Projeto" (ProjectsTable.tsx) alterna pra A-Z/Z-A; um terceiro clique volta pra criticidade.
  const [nameSort, setNameSort] = useState<'asc' | 'desc' | null>(null);
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

  const activeStatuses = useMemo(
    () => (Object.keys(STATUS_LABEL) as ProjectStatus[]).filter((s) => filters.status.includes(STATUS_LABEL[s])),
    [filters.status],
  );
  // Clique normal: seleção única (troca ou limpa se já era o único ativo). Ctrl/Cmd+clique:
  // acrescenta/remove esse status da seleção, permitindo ver vários status juntos na tabela.
  const toggleStatus = (status: ProjectStatus, multi: boolean) => {
    const label = STATUS_LABEL[status];
    setFilters((f) => {
      if (multi) {
        const has = f.status.includes(label);
        return { ...f, status: has ? f.status.filter((s) => s !== label) : [...f.status, label] };
      }
      const isOnlySelected = f.status.length === 1 && f.status[0] === label;
      return { ...f, status: isOnlySelected ? [] : [label] };
    });
  };

  // Sem o filtro de status — é a base que os cards de saúde usam pra contar por status (senão,
  // selecionar "Atrasado" zeraria os outros cards em vez de só destacar/filtrar a tabela).
  const filteredExceptStatus = useMemo(
    () =>
      projects.filter((p) => {
        if (filters.unit && p.unit !== filters.unit) return false;
        if (filters.year && p.plannedStart?.slice(0, 4) !== filters.year) return false;
        if (filters.search.trim()) {
          const term = filters.search.trim().toLowerCase();
          const gerente = people.find((person) => person.id === p.gerenteId)?.name ?? '';
          const haystack = `${p.code} ${p.name} ${gerente}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      }),
    [projects, filters.unit, filters.year, filters.search, people],
  );

  const filtered = useMemo(
    () =>
      filters.status.length === 0
        ? filteredExceptStatus
        : filteredExceptStatus.filter((p) => filters.status.includes(STATUS_LABEL[p.status])),
    [filteredExceptStatus, filters.status],
  );

  const sorted = useMemo(() => {
    if (nameSort) {
      const ranked = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      return nameSort === 'desc' ? ranked.reverse() : ranked;
    }
    return sortProjectsByCriticality(filtered, today, safeHolidays);
  }, [filtered, today, safeHolidays, nameSort]);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-8 -mt-6 space-y-5 border-b border-border bg-page px-8 pt-6 pb-5">
        <PageHeader
          title="Status de Projetos"
          subtitle="Visão Geral - Automação"
          actions={
            <>
              <Button
                variant="primary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => navigate('/novo-projeto')}
                disabled={isAdmin !== true}
                title={isAdmin !== true ? 'Somente administrador pode criar projeto.' : undefined}
              >
                Novo Projeto
              </Button>
              <ProjectFilters filters={filters} units={units} years={years} onChange={setFilters} />
            </>
          }
        />

        <ProjectsHealthStrip
          projects={filteredExceptStatus}
          totalCount={filtered.length}
          activeStatuses={activeStatuses}
          onToggleStatus={toggleStatus}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <ProjectsTable
          projects={sorted}
          people={people}
          today={today}
          holidays={safeHolidays}
          isAdmin={isAdmin}
          nameSort={nameSort}
          onToggleNameSort={() => setNameSort((s) => (s === 'asc' ? 'desc' : s === 'desc' ? null : 'asc'))}
          onEdit={(project) => setEditingId(project.id)}
          onDelete={handleDelete}
          onUpdateTask={updateTaskActualDates}
          onDuplicate={handleDuplicate}
        />

        <div className="space-y-4">
          <AttentionPanel projects={projects} today={today} holidays={safeHolidays} />
        </div>
      </div>

      <ProjectDetailPanel
        project={editing}
        people={people}
        today={today}
        holidays={safeHolidays}
        isAdmin={isAdmin}
        onCreatePerson={createPerson}
        onSave={(patch) => {
          if (editing) updateProjectInfo(editing.id, patch);
        }}
        onAddActivity={() => setAddingActivityToId(editingId)}
        onUpdateTask={updateTaskActualDates}
        onClose={() => setEditingId(null)}
      />

      <AddActivityDialog
        open={Boolean(addingActivityTo)}
        projects={projects}
        initialProjectId={addingActivityTo?.id}
        catalog={catalog}
        categories={categories}
        people={people}
        onCreatePerson={createPerson}
        onAdd={(projectId, name) => {
          addActivity(projectId, name);
          setAddingActivityToId(null);
        }}
        onAddFromCatalog={(projectId, name, tasks) => {
          addActivityWithTasks(projectId, name, tasks, todayISO());
          setAddingActivityToId(null);
        }}
        onCancel={() => setAddingActivityToId(null)}
      />

      <UndoToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
