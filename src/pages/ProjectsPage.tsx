import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/layout';
import {
  EMPTY_FILTERS,
  EditProjectDialog,
  ProjectFilters,
  ProjectsHealthStrip,
  ProjectsTable,
  type ProjectFiltersState,
} from '../components/projects';
import { Button, UndoToast } from '../components/ui';
import { useHolidays, usePeople, useProjects, useUndoToast } from '../hooks';
import { sortProjectsByCriticality } from '../utils';
import { STATUS_LABEL, type Project, type ProjectStatus, type ProjectView } from '../types';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, today, removeProject, restoreProject, updateProjectInfo } = useProjects();
  const { people, createPerson } = usePeople();
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const { toast, show, dismiss } = useUndoToast();
  const [filters, setFilters] = useState<ProjectFiltersState>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Project | null>(null);

  const handleDelete = (project: ProjectView) => {
    removeProject(project.id);
    show(`${project.code} movido para Excluídos`, () => restoreProject(project));
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

      <ProjectsTable
        projects={sorted}
        people={people}
        today={today}
        holidays={safeHolidays}
        onEdit={setEditing}
        onDelete={handleDelete}
      />

      <EditProjectDialog
        key={editing?.id ?? 'closed'}
        project={editing}
        people={people}
        onCreatePerson={createPerson}
        onCancel={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) updateProjectInfo(editing.id, patch);
          setEditing(null);
        }}
      />

      <UndoToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
