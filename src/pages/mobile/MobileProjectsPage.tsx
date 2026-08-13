import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MobileProjectSheet, ProjectCard, StatusChipRow } from '../../components/projects';
import { EmptyState, Input, UndoToast } from '../../components/ui';
import { useHolidays, usePeople, useProjects, useUndoToast } from '../../hooks';
import { computeStatusDistribution, sortProjectsByCriticality } from '../../utils';
import { STATUS_LABEL, type ProjectStatus } from '../../types';

function readStatusParam(value: string | null): ProjectStatus | null {
  return value && (Object.keys(STATUS_LABEL) as ProjectStatus[]).includes(value as ProjectStatus)
    ? (value as ProjectStatus)
    : null;
}

export function MobileProjectsPage() {
  const [searchParams] = useSearchParams();
  const { projects, today, updateTaskActualDates } = useProjects();
  const { people } = usePeople();
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const { toast, show, dismiss } = useUndoToast();
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<ProjectStatus | null>(() => readStatusParam(searchParams.get('status')));
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const safeHolidays = holidaysLoaded ? holidays : [];
  const distribution = computeStatusDistribution(projects);

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (activeStatus && p.status !== activeStatus) return false;
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          const gerente = people.find((person) => person.id === p.gerenteId)?.name ?? '';
          const haystack = `${p.code} ${p.name} ${gerente}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      }),
    [projects, activeStatus, search, people],
  );

  const sorted = useMemo(
    () => sortProjectsByCriticality(filtered, today, safeHolidays),
    [filtered, today, safeHolidays],
  );

  const openProject = projects.find((p) => p.id === openProjectId) ?? null;

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por código, nome ou gerente"
        className="min-h-11 w-full"
      />

      <StatusChipRow
        distribution={distribution}
        activeStatus={activeStatus}
        onToggleStatus={(status) => setActiveStatus((current) => (current === status ? null : status))}
        size="touch"
      />

      {sorted.length === 0 ? (
        <EmptyState title="Nenhum projeto com esse filtro" />
      ) : (
        <div className="space-y-2">
          {sorted.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              people={people}
              today={today}
              holidays={safeHolidays}
              onOpen={(p) => setOpenProjectId(p.id)}
            />
          ))}
        </div>
      )}

      <MobileProjectSheet
        project={openProject}
        today={today}
        holidays={safeHolidays}
        onClose={() => setOpenProjectId(null)}
        onUpdateTask={(taskId, patch) => {
          if (openProject) updateTaskActualDates(openProject.id, taskId, patch);
        }}
        onShowUndo={(message, onUndo) => show(message, onUndo)}
      />

      <UndoToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
