import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { Card } from '../components/ui';
import { useProjects } from '../hooks';
import { diffDays, todayISO } from '../utils';

export function DashboardPage() {
  const { projects } = useProjects();

  const metrics = useMemo(() => {
    const today = todayISO();
    const currentMonth = today.slice(0, 7);

    const activeProjects = projects.filter((p) => p.status !== 'completed');
    const delayedProjects = projects.filter((p) => p.status === 'delayed');
    const delayedTasks = projects
      .flatMap((p) => p.activities.flatMap((a) => a.tasks))
      .filter((t) => t.status === 'delayed').length;
    const completedThisMonth = projects.filter(
      (p) => p.status === 'completed' && p.actualEnd?.slice(0, 7) === currentMonth,
    ).length;

    const durations = projects
      .filter((p) => p.plannedStart && p.plannedEnd)
      .map((p) => diffDays(p.plannedStart!, p.plannedEnd!));
    const averageDuration = durations.length
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : 0;

    const byUnit = new Map<string, number>();
    for (const project of projects) {
      const key = project.unit || 'Sem unidade';
      byUnit.set(key, (byUnit.get(key) ?? 0) + 1);
    }

    return {
      activeCount: activeProjects.length,
      delayedCount: delayedProjects.length,
      delayedTasks,
      completedThisMonth,
      averageDuration,
      byUnit: Array.from(byUnit.entries()),
    };
  }, [projects]);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Visão geral dos projetos industriais" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <MetricCard label="Projetos ativos" value={metrics.activeCount} />
        <MetricCard label="Projetos atrasados" value={metrics.delayedCount} />
        <MetricCard label="Tarefas atrasadas" value={metrics.delayedTasks} />
        <MetricCard label="Concluídos no mês" value={metrics.completedThisMonth} />
        <MetricCard label="Prazo médio (dias)" value={metrics.averageDuration} />
      </div>

      <Card className="p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">Projetos por unidade</p>
        <div className="space-y-2">
          {metrics.byUnit.map(([unit, count]) => (
            <div key={unit} className="flex items-center gap-3">
              <span className="w-24 text-sm text-text">{unit}</span>
              <div className="h-2 flex-1 rounded-full bg-page">
                <div
                  className="h-2 rounded-full bg-action"
                  style={{ width: `${(count / Math.max(1, projects.length)) * 100}%` }}
                />
              </div>
              <span className="w-6 text-right text-sm text-text-muted">{count}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col items-center justify-center gap-2 border-dashed p-10 text-center">
        <BarChart3 className="h-8 w-8 text-text-muted" />
        <p className="text-sm font-medium text-text">Espaço reservado para gráficos</p>
        <p className="text-xs text-text-muted">Curva S, distribuição de status e tendência de atrasos entram aqui.</p>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
    </Card>
  );
}
