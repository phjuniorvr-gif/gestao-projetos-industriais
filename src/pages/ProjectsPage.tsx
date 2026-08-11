import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/layout';
import {
  EMPTY_FILTERS,
  EditProjectDialog,
  ProjectCard,
  ProjectFilters,
  ProjectsHealthStrip,
  type ProjectFiltersState,
} from '../components/projects';
import { Button, ConfirmDialog, EmptyState } from '../components/ui';
import { useHolidays, usePeople, useProjects } from '../hooks';
import { STATUS_LABEL, type Project, type ProjectStatus } from '../types';

export function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, today, removeProject, updateProjectInfo } = useProjects();
  const { people, createPerson } = usePeople();
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const [filters, setFilters] = useState<ProjectFiltersState>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

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

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum projeto encontrado" description="Ajuste os filtros para encontrar o que procura." />
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} people={people} onEdit={setEditing} onDelete={setDeleting} />
          ))}
        </div>
      )}

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

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir projeto"
        message={deleting ? `Tem certeza que deseja excluir ${deleting.code} — ${deleting.name}?` : ''}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeProject(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
