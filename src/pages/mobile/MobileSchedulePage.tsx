import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowUpDown, X } from 'lucide-react';
import { FilterSelect, MobileProjectSheet, StatusGrid } from '../../components/projects';
import { MiniGantt } from '../../components/projects/MiniGantt';
import { Card, EmptyState, Input, UndoToast } from '../../components/ui';
import type { MobileOutletContext } from '../../components/layout';
import { useHolidays, usePeople, useProjects, useUndoToast } from '../../hooks';
import { computeStatusDistribution, formatPeriod, sortProjectsByCriticality } from '../../utils';
import type { ProjectStatus, ProjectView } from '../../types';

function ScheduleListCard({ project, today, onOpen }: { project: ProjectView; today: string; onOpen: (p: ProjectView) => void }) {
  return (
    <Card className="min-h-11 cursor-pointer space-y-1.5 p-3" onClick={() => onOpen(project)}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-text">
          {project.code} — {project.name}
        </p>
        {project.unit && (
          <span className="shrink-0 rounded-full bg-page px-2 py-0.5 text-[11px] font-medium text-text-muted">
            {project.unit}
          </span>
        )}
      </div>
      <MiniGantt
        plannedStart={project.plannedStart}
        plannedEnd={project.plannedEnd}
        actualStart={project.actualStart}
        actualEnd={project.actualEnd}
        status={project.status}
        today={today}
        size="compact"
      />
      <div className="space-y-0.5 text-xs text-text-muted">
        <p>Previsto: {formatPeriod(project.plannedStart, project.plannedEnd)}</p>
        <p>Real: {project.actualStart ? formatPeriod(project.actualStart, project.actualEnd) : 'Não iniciado'}</p>
      </div>
    </Card>
  );
}

/**
 * Aba Cronograma (Fase 6/mobile) — lista de projetos com mini-gantt compacto cada, NÃO o
 * `GanttTable.tsx` reduzido (painel esquerdo do Gantt desktop sozinho passa de 700px, medido na
 * Fase 4 — não cabe em tela de celular). Toque abre o mesmo `MobileProjectSheet` da aba Projetos.
 */
export function MobileSchedulePage() {
  const { year, setYear } = useOutletContext<MobileOutletContext>();
  const { projects, today, updateTaskActualDates } = useProjects();
  const { people } = usePeople();
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const { toast, show, dismiss } = useUndoToast();
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<ProjectStatus | null>(null);
  const [unitFilter, setUnitFilter] = useState('');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  // Ordenação padrão continua por criticidade (sortProjectsByCriticality) — o botão "Ordenar"
  // alterna pra nome A→Z/Z→A e volta, mesmo ciclo de 3 estados já usado em MobileProjectsPage.tsx
  // (lá por código; aqui por nome, a pedido do usuário).
  const [nameSort, setNameSort] = useState<'asc' | 'desc' | null>(null);

  const safeHolidays = holidaysLoaded ? holidays : [];
  // Sem o filtro de status — base pros chips contarem por status dentro do ano selecionado, sem
  // que escolher um status zere a contagem dos outros (mesmo raciocínio dos cards de saúde do
  // desktop, ProjectsHealthStrip.tsx).
  const projectsForDistribution = useMemo(
    () => (year ? projects.filter((p) => p.plannedStart?.slice(0, 4) === year) : projects),
    [projects, year],
  );
  const distribution = computeStatusDistribution(projectsForDistribution);
  const units = useMemo(() => Array.from(new Set(projects.map((p) => p.unit).filter(Boolean))).sort(), [projects]);

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        // Sem chip de status selecionado, concluído fica escondido por padrão (a pedido do
        // usuário — 36 dos 50 projetos concluídos poluíam a lista). Selecionar "Concluído" (ou
        // qualquer outro chip) sobrepõe isso — o filtro explícito decide sozinho quem aparece.
        // Mesmo raciocínio (e mesma preferência, confirmada pelo usuário) de `MobileScheduleList.tsx`.
        if (activeStatus) {
          if (p.status !== activeStatus) return false;
        } else if (p.status === 'completed') {
          return false;
        }
        if (year && p.plannedStart?.slice(0, 4) !== year) return false;
        if (unitFilter && p.unit !== unitFilter) return false;
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          const gerente = people.find((person) => person.id === p.gerenteId)?.name ?? '';
          const haystack = `${p.code} ${p.name} ${gerente}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      }),
    [projects, activeStatus, year, unitFilter, search, people],
  );

  const sorted = useMemo(() => {
    if (nameSort) {
      const ranked = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      return nameSort === 'desc' ? ranked.reverse() : ranked;
    }
    return sortProjectsByCriticality(filtered, today, safeHolidays);
  }, [filtered, today, safeHolidays, nameSort]);

  const openProject = projects.find((p) => p.id === openProjectId) ?? null;

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por código, nome ou gerente"
        className="min-h-11 w-full"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setNameSort((current) => (current === null ? 'asc' : current === 'asc' ? 'desc' : null))}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-semibold text-text-muted"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {nameSort === 'asc' ? 'Nome: A → Z' : nameSort === 'desc' ? 'Nome: Z → A' : 'Ordenado por criticidade'}
        </button>
        <FilterSelect label="Unidade" value={unitFilter} onChange={setUnitFilter} options={units} className="min-h-11 flex-1" />
      </div>

      <StatusGrid
        distribution={distribution}
        isActive={(status) => activeStatus === status}
        onToggleStatus={(status) => setActiveStatus((current) => (current === status ? null : status))}
      />
      {(activeStatus || year || unitFilter || search.trim()) && (
        <button
          type="button"
          onClick={() => {
            setActiveStatus(null);
            setYear('');
            setUnitFilter('');
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
            <ScheduleListCard key={project.id} project={project} today={today} onOpen={(p) => setOpenProjectId(p.id)} />
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
        readOnly
      />

      <UndoToast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
