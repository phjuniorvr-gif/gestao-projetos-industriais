import { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, X } from 'lucide-react';
import { MobileProjectSheet, ProjectCard, StatusGrid } from '../../components/projects';
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
  // Ordenação padrão continua por criticidade (sortProjectsByCriticality) — o botão "Ordenar"
  // alterna pra código crescente/decrescente e volta, mesmo ciclo de 3 estados do cabeçalho
  // "Projeto" no desktop (ProjectsPage.tsx), só que por código (P05, P10, ...) em vez de nome.
  const [codeSort, setCodeSort] = useState<'asc' | 'desc' | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const safeHolidays = holidaysLoaded ? holidays : [];
  // Sem o filtro de status — base pros chips contarem por status dentro do ano selecionado, sem
  // que escolher um status zere a contagem dos outros (mesmo raciocínio dos cards de saúde do
  // desktop, ProjectsHealthStrip.tsx).
  const projectsForDistribution = useMemo(
    () => (year ? projects.filter((p) => p.plannedStart?.slice(0, 4) === year) : projects),
    [projects, year],
  );
  const distribution = computeStatusDistribution(projectsForDistribution);

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

  const sorted = useMemo(() => {
    if (codeSort) {
      // Extrai o número do código ("P48" -> 48) em vez de comparar a string direto — string
      // ordenaria "P5" depois de "P48" se algum código não tivesse zero à esquerda.
      const codeNumber = (code: string) => parseInt(code.match(/\d+/)?.[0] ?? '0', 10);
      const ranked = [...filtered].sort((a, b) => codeNumber(a.code) - codeNumber(b.code));
      return codeSort === 'desc' ? ranked.reverse() : ranked;
    }
    return sortProjectsByCriticality(filtered, today, safeHolidays);
  }, [filtered, today, safeHolidays, codeSort]);

  const openProject = projects.find((p) => p.id === openProjectId) ?? null;

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por código, nome ou gerente"
        className="min-h-11 w-full"
      />

      <button
        type="button"
        onClick={() => setCodeSort((current) => (current === null ? 'asc' : current === 'asc' ? 'desc' : null))}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-semibold text-text-muted"
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        {codeSort === 'asc' ? 'Código: P01 → P99' : codeSort === 'desc' ? 'Código: P99 → P01' : 'Ordenado por criticidade'}
      </button>

      <StatusGrid
        distribution={distribution}
        isActive={(status) => activeStatus === status}
        onToggleStatus={(status) => setActiveStatus((current) => (current === status ? null : status))}
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
