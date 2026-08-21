import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout';
import {
  AttentionPoints,
  AttentionSplitPanel,
  DashboardFilters,
  DelayedTasksByPerson,
  MonthlyStatusTrendChart,
  UnitDonutChart,
} from '../components/dashboard';
import { StatusDonutChart } from '../components/projects';
import { Card } from '../components/ui';
import { useHolidays, usePeople, useProjects } from '../hooks';
import { diffDays } from '../utils';
import { computeAttentionItems, computeStatusDistribution } from '../utils/portfolio';
import { STATUS_COLOR, STATUS_LABEL, type ProjectStatus } from '../types';

export function DashboardPage() {
  const navigate = useNavigate();
  const { projects, today, refetch } = useProjects();
  const { people } = usePeople();
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const safeHolidays = holidaysLoaded ? holidays : [];

  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState('');
  const [periodDays, setPeriodDays] = useState(90);
  const [unit, setUnit] = useState('');
  const [status, setStatus] = useState('');

  const years = useMemo(
    () => Array.from(new Set(projects.map((p) => p.plannedStart?.slice(0, 4)).filter((y): y is string => Boolean(y)))).sort(),
    [projects],
  );
  const units = useMemo(() => Array.from(new Set(projects.map((p) => p.unit).filter(Boolean))).sort(), [projects]);

  const filteredProjects = useMemo(
    () =>
      projects.filter((p) => {
        if (year && p.plannedStart?.slice(0, 4) !== year) return false;
        if (unit && p.unit !== unit) return false;
        if (status && STATUS_LABEL[p.status] !== status) return false;
        return true;
      }),
    [projects, year, unit, status],
  );

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  const distribution = useMemo(() => computeStatusDistribution(filteredProjects), [filteredProjects]);
  const attentionItems = useMemo(
    () => computeAttentionItems(filteredProjects, today, safeHolidays, periodDays),
    [filteredProjects, today, safeHolidays, periodDays],
  );

  const metrics = useMemo(() => {
    const referenceYear = year || today.slice(0, 4);

    const activeProjects = filteredProjects.filter((p) => p.status !== 'completed');
    const delayedProjects = filteredProjects.filter((p) => p.status === 'delayed');
    const delayedTasks = filteredProjects.flatMap((p) => p.activities.flatMap((a) => a.tasks)).filter((t) => t.status === 'delayed');
    const impactedResponsibles = new Set(delayedTasks.map((t) => t.responsavelId).filter(Boolean)).size;
    const completedThisYear = projects.filter((p) => p.status === 'completed' && p.actualEnd?.slice(0, 4) === referenceYear).length;

    const activeDurations = activeProjects
      .filter((p) => p.plannedStart && p.plannedEnd)
      .map((p) => diffDays(p.plannedStart!, p.plannedEnd!));
    const averageDuration = activeDurations.length
      ? Math.round(activeDurations.reduce((sum, d) => sum + d, 0) / activeDurations.length)
      : 0;

    const total = filteredProjects.length;
    const onTrackCount = filteredProjects.filter((p) => p.status !== 'delayed').length;
    const onTrackPct = total ? Math.round((onTrackCount / total) * 100) : 0;

    const byUnit = new Map<string, { count: number; delayed: number }>();
    for (const project of filteredProjects) {
      const key = project.unit || 'Sem unidade';
      const entry = byUnit.get(key) ?? { count: 0, delayed: 0 };
      entry.count += 1;
      if (project.status === 'delayed') entry.delayed += 1;
      byUnit.set(key, entry);
    }

    const semGerenteCount = filteredProjects.filter((p) => !p.gerenteId).length;

    return {
      activeCount: activeProjects.length,
      delayedCount: delayedProjects.length,
      delayedTaskCount: delayedTasks.length,
      impactedResponsibles,
      completedThisYear,
      averageDuration,
      onTrackPct,
      byUnit: Array.from(byUnit.entries()),
      semGerenteCount,
      total,
    };
  }, [filteredProjects, projects, today, year]);

  const attentionPoints = [
    ...(metrics.semGerenteCount > 0
      ? [
          {
            color: STATUS_COLOR.delayed,
            title: `${metrics.semGerenteCount} projeto${metrics.semGerenteCount === 1 ? '' : 's'} sem gerente definido`,
            subtitle: 'Atribuição recomendada',
          },
        ]
      : []),
    ...(metrics.completedThisYear > 0
      ? [
          {
            color: STATUS_COLOR.completed,
            title: `${metrics.completedThisYear} projeto${metrics.completedThisYear === 1 ? '' : 's'} concluído${metrics.completedThisYear === 1 ? '' : 's'} no ano`,
            subtitle: 'Dentro do planejamento atual',
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Visão geral dos projetos industriais" />

      <DashboardFilters
        year={year}
        years={years}
        onYearChange={setYear}
        periodDays={periodDays}
        onPeriodChange={setPeriodDays}
        unit={unit}
        units={units}
        onUnitChange={setUnit}
        status={status}
        onStatusChange={setStatus}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onClear={() => {
          setYear('');
          setPeriodDays(90);
          setUnit('');
          setStatus('');
        }}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Projetos ativos" value={metrics.activeCount} color={STATUS_COLOR.in_progress} />
        <MetricCard
          label="Projetos atrasados"
          value={metrics.delayedCount}
          subtitle={metrics.total ? `${Math.round((metrics.delayedCount / metrics.total) * 100)}% do total` : undefined}
          color={STATUS_COLOR.delayed}
        />
        <MetricCard
          label="Tarefas atrasadas"
          value={metrics.delayedTaskCount}
          subtitle={
            metrics.impactedResponsibles > 0
              ? `${metrics.impactedResponsibles} responsáve${metrics.impactedResponsibles === 1 ? 'l' : 'is'} impactado${metrics.impactedResponsibles === 1 ? '' : 's'}`
              : undefined
          }
          color={STATUS_COLOR.delayed}
        />
        <MetricCard
          label="Concluídos no ano"
          value={metrics.completedThisYear}
          subtitle="Referente ao ano selecionado"
          color={STATUS_COLOR.completed}
        />
        <MetricCard label="Prazo médio" value={`${metrics.averageDuration}d`} subtitle="Média dos projetos ativos" color="#334155" />
        <MetricCard
          label="Projetos no prazo"
          value={`${metrics.onTrackPct}%`}
          subtitle={`${metrics.total - metrics.delayedCount} de ${metrics.total} no prazo`}
          color={STATUS_COLOR.completed}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <UnitDonutChart
          data={metrics.byUnit.map(([unitName, entry]) => ({ unit: unitName, count: entry.count, delayed: entry.delayed }))}
          onSelectUnit={setUnit}
        />

        <StatusDonutChart
          distribution={distribution}
          onSelectStatus={(s: ProjectStatus) => navigate(`/projetos?status=${s}`)}
          subtitle={`Distribuição atual${year ? ` em ${year}` : ''}`}
        />

        <MonthlyStatusTrendChart projects={filteredProjects} year={year} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionSplitPanel items={attentionItems} />
        <DelayedTasksByPerson projects={filteredProjects} people={people} />
      </div>

      <AttentionPoints points={attentionPoints} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  color: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: color }}>
        {label}
      </div>
      <div className="p-3">
        <p className="text-2xl font-semibold text-text">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted2">{subtitle}</p>}
      </div>
    </Card>
  );
}
