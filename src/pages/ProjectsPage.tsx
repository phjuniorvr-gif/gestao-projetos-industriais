import { useMemo, useState } from 'react';
import { PageHeader } from '../components/layout';
import {
  EMPTY_FILTERS,
  EditProjectDialog,
  Legend,
  ProjectCard,
  ProjectFilters,
  StatusCard,
  type ProjectFiltersState,
} from '../components/projects';
import { ConfirmDialog, EmptyState } from '../components/ui';
import { useProjects } from '../hooks';
import { STATUS_LABEL, type Project } from '../types';

export function ProjectsPage() {
  const { projects, removeProject, updateProjectInfo } = useProjects();
  const [filters, setFilters] = useState<ProjectFiltersState>(EMPTY_FILTERS);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const units = useMemo(
    () => Array.from(new Set(projects.map((p) => p.unit).filter(Boolean))).sort(),
    [projects],
  );
  const years = useMemo(
    () =>
      Array.from(new Set(projects.map((p) => p.plannedStart?.slice(0, 4)).filter((y): y is string => Boolean(y)))).sort(),
    [projects],
  );

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (filters.unit && p.unit !== filters.unit) return false;
        if (filters.status && STATUS_LABEL[p.status] !== filters.status) return false;
        if (filters.year && p.plannedStart?.slice(0, 4) !== filters.year) return false;
        return true;
      }),
    [projects, filters],
  );

  const counts = useMemo(
    () => ({
      total: projects.length,
      completed: projects.filter((p) => p.status === 'completed' || p.status === 'completed_late').length,
      inProgress: projects.filter((p) => p.status === 'in_progress').length,
      delayed: projects.filter((p) => p.status === 'delayed').length,
      toStart: projects.filter((p) => p.status === 'to_start').length,
      planned: projects.filter((p) => p.status === 'planned').length,
    }),
    [projects],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Status de Projetos"
        subtitle="Visão Geral - Automação"
        actions={<ProjectFilters filters={filters} units={units} years={years} onChange={setFilters} />}
      />

      <div className="flex flex-wrap gap-3">
        <StatusCard label="Total de Projetos" value={counts.total} color="#111827" />
        <StatusCard label="Concluído" value={counts.completed} color="#166534" />
        <StatusCard label="Em Andamento" value={counts.inProgress} color="#FDE000" />
        <StatusCard label="Atrasado" value={counts.delayed} color="#F43F5E" />
        <StatusCard label="À Iniciar" value={counts.toStart} color="#A3A3A3" />
        <StatusCard label="Planejado" value={counts.planned} color="#39BDF2" />
      </div>

      <Legend />

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum projeto encontrado" description="Ajuste os filtros para encontrar o que procura." />
      ) : (
        <div className="space-y-2">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} onEdit={setEditing} onDelete={setDeleting} />
          ))}
        </div>
      )}

      <EditProjectDialog
        key={editing?.id ?? 'closed'}
        project={editing}
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
