import { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { MobileProjectSheet, ProjectCard, StatusChipRow } from '../../components/projects';
import { EmptyState, Input, UndoToast } from '../../components/ui';
import type { MobileOutletContext } from '../../components/layout';
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
  const { year, setYear } = useOutletContext<MobileOutletContext>();
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
        if (year && p.plannedStart?.slice(0, 4) !== year) return false;
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          const gerente = people.find((person) => person.id === p.gerenteId)?.name ?? '';
          const haystack = `${p.code} ${p.name} ${gerente}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      }),
    [projects, activeStatus, year, search, people],
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

      <div className="flex flex-wrap items-center gap-2">
        <StatusChipRow
          distribution={distribution}
          activeStatus={activeStatus}
          onToggleStatus={(status) => setActiveStatus((current) => (current === status ? null : status))}
          size="touch"
        />
        {(activeStatus || year || search.trim()) && (
          <button
            type="button"
            onClick={() => {
              setActiveStatus(null);
              setYear('');
              setSearch('');
            }}
            className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-action"
          >
            <X className="h-3.5 w-3.5" /> Limpar filtro
          </button>
        )}
      </div>

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
