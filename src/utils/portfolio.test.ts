import { describe, expect, it } from 'vitest';
import {
  computeActiveFilterCount,
  computeCriticality,
  computeExpectedProgress,
  computeFocusTask,
  computeProjectTeam,
  computeScheduleDeviationDays,
  computeStatusDistribution,
  computeWorstDeviation,
  sortProjectsByCriticality,
} from './portfolio';
import { EMPTY_FILTERS } from '../components/projects/ProjectFilters';
import type { Person, ProjectView, TaskView } from '../types';

function taskView(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: 't1',
    rowNumber: 1,
    activityId: 'a1',
    name: 'Tarefa',
    category: 'eletrica',
    predecessorRowNumbers: [],
    plannedStart: '2026-01-01',
    plannedEnd: '2026-01-10',
    status: 'planned',
    isBlocked: false,
    isStartDelayed: false,
    isLateCompletion: false,
    ...overrides,
  };
}

function baseProject(overrides: Partial<ProjectView> = {}): ProjectView {
  return {
    id: 'p1',
    code: 'P01',
    name: 'Projeto',
    unit: 'Matriz',
    sector: '',
    progress: 0,
    activities: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'planned',
    blockedCount: 0,
    startDelayedCount: 0,
    isLateCompletion: false,
    ...overrides,
  };
}

describe('computeActiveFilterCount', () => {
  it('sem filtros: 0', () => {
    expect(computeActiveFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it('busca só com espaços não conta', () => {
    expect(computeActiveFilterCount({ ...EMPTY_FILTERS, search: '   ' })).toBe(0);
  });

  it('cada filtro conta 1, combinados somam', () => {
    expect(computeActiveFilterCount({ ...EMPTY_FILTERS, search: 'p01' })).toBe(1);
    expect(computeActiveFilterCount({ ...EMPTY_FILTERS, unit: 'Matriz' })).toBe(1);
    expect(computeActiveFilterCount({ ...EMPTY_FILTERS, status: 'Atrasado' })).toBe(1);
    expect(computeActiveFilterCount({ ...EMPTY_FILTERS, year: '2026' })).toBe(1);
    expect(computeActiveFilterCount({ search: 'p01', unit: 'Matriz', status: 'Atrasado', year: '2026' })).toBe(4);
  });
});

describe('computeScheduleDeviationDays', () => {
  it('sem plannedEnd: 0', () => {
    expect(computeScheduleDeviationDays({ status: 'planned', unit: 'Matriz' }, '2026-08-11', [])).toBe(0);
  });

  it('planned/in_progress: sempre 0 (desvio só conta depois do prazo estourar)', () => {
    expect(
      computeScheduleDeviationDays({ status: 'planned', plannedEnd: '2026-01-01', unit: 'Matriz' }, '2026-08-11', []),
    ).toBe(0);
    expect(
      computeScheduleDeviationDays({ status: 'in_progress', plannedEnd: '2026-01-01', unit: 'Matriz' }, '2026-08-11', []),
    ).toBe(0);
  });

  it('completed no prazo (actualEnd <= plannedEnd): 0', () => {
    const project = { status: 'completed' as const, plannedEnd: '2026-08-10', actualEnd: '2026-08-10', unit: 'Matriz' };
    expect(computeScheduleDeviationDays(project, '2026-08-11', [])).toBe(0);
  });

  it('completed com atraso: desconta feriado nacional (mesmo par de datas já verificado em computeLateCompletionDays)', () => {
    const project = { status: 'completed' as const, plannedEnd: '2026-04-17', actualEnd: '2026-04-23', unit: 'Matriz' };
    expect(computeScheduleDeviationDays(project, '2026-08-11', [])).toBe(3);
  });

  it('delayed, prazo já passou: mesma conta de dias úteis, usando "today" como referência', () => {
    const project = { status: 'delayed' as const, plannedEnd: '2026-04-17', unit: 'Matriz' };
    expect(computeScheduleDeviationDays(project, '2026-04-23', [])).toBe(3);
  });

  it('delayed, mas o prazo GERAL do projeto ainda não passou (atraso vem de uma tarefa interna antecipada): 0', () => {
    const project = { status: 'delayed' as const, plannedEnd: '2026-12-31', unit: 'Matriz' };
    expect(computeScheduleDeviationDays(project, '2026-08-11', [])).toBe(0);
  });
});

describe('computeStatusDistribution', () => {
  it('conta por status, na ordem fixa delayed/in_progress/completed/planned', () => {
    const projects = [
      { status: 'planned' as const },
      { status: 'delayed' as const },
      { status: 'delayed' as const },
      { status: 'completed' as const },
    ];
    expect(computeStatusDistribution(projects)).toEqual([
      { status: 'delayed', count: 2 },
      { status: 'in_progress', count: 0 },
      { status: 'completed', count: 1 },
      { status: 'planned', count: 1 },
    ]);
  });
});

describe('computeWorstDeviation', () => {
  it('sem projetos atrasados: 0', () => {
    expect(computeWorstDeviation([{ status: 'planned', unit: 'Matriz' }], '2026-08-11', [])).toBe(0);
  });

  it('pega o maior desvio entre os atrasados', () => {
    const projects = [
      { status: 'delayed' as const, plannedEnd: '2026-08-01', unit: 'Matriz' }, // desvio pequeno
      { status: 'delayed' as const, plannedEnd: '2026-04-17', unit: 'Matriz' }, // desvio maior (verificado: 3)
    ];
    expect(computeWorstDeviation(projects, '2026-04-23', [])).toBe(3);
  });
});

describe('computeExpectedProgress', () => {
  // Pesos reaproveitados de status.test.ts (já verificados contra businessDaysBetween real):
  //   2026-01-05..2026-01-16 → peso 10 ; 2026-01-19..2026-02-03 → peso 12 ; 2026-02-04..2026-03-13 → peso 27
  const tasks = [
    { plannedStart: '2026-01-05', plannedEnd: '2026-01-16' }, // peso 10
    { plannedStart: '2026-01-19', plannedEnd: '2026-02-03' }, // peso 12
    { plannedStart: '2026-02-04', plannedEnd: '2026-03-13' }, // peso 27
  ];

  it('sem tarefas: 0', () => {
    expect(computeExpectedProgress([], '2026-08-11', [], 'Matriz')).toBe(0);
  });

  it('antes do prazo de qualquer tarefa: 0', () => {
    expect(computeExpectedProgress(tasks, '2026-01-01', [], 'Matriz')).toBe(0);
  });

  it('depois do prazo de todas: 100', () => {
    expect(computeExpectedProgress(tasks, '2026-12-31', [], 'Matriz')).toBe(100);
  });

  it('no meio — só os pesos das tarefas cujo prazo já passou contam, não é reta por tempo decorrido', () => {
    // today 2026-02-10: passou o prazo de A(10) e B(12), não passou o de C(27) → 22/49
    expect(computeExpectedProgress(tasks, '2026-02-10', [], 'Matriz')).toBe(Math.round((22 / 49) * 100));
  });
});

describe('computeCriticality', () => {
  it('delayed: 1000 + dias de desvio', () => {
    expect(computeCriticality({ status: 'delayed', progress: 0, startDelayedCount: 0, isLateCompletion: false }, 7, 0)).toBe(1007);
  });

  it('in_progress com defasagem ≥ 10 p.p.: 600 + defasagem', () => {
    const project = { status: 'in_progress' as const, progress: 40, startDelayedCount: 0, isLateCompletion: false };
    expect(computeCriticality(project, 0, 55)).toBe(615); // defasagem 15
  });

  it('in_progress com defasagem < 10 p.p.: não entra na faixa 600, cai pra 0 (nenhuma outra faixa bate)', () => {
    const project = { status: 'in_progress' as const, progress: 50, startDelayedCount: 0, isLateCompletion: false };
    expect(computeCriticality(project, 0, 55)).toBe(0); // defasagem 5, abaixo do limiar
  });

  it('planned com alguma parte já devendo ter começado: 450', () => {
    const project = { status: 'planned' as const, progress: 0, startDelayedCount: 2, isLateCompletion: false };
    expect(computeCriticality(project, 0, 0)).toBe(450);
  });

  it('planned sem nada atrasado pra começar: 200', () => {
    const project = { status: 'planned' as const, progress: 0, startDelayedCount: 0, isLateCompletion: false };
    expect(computeCriticality(project, 0, 0)).toBe(200);
  });

  it('completed com atraso: 100', () => {
    const project = { status: 'completed' as const, progress: 100, startDelayedCount: 0, isLateCompletion: true };
    expect(computeCriticality(project, 3, 100)).toBe(100);
  });

  it('completed no prazo: 0', () => {
    const project = { status: 'completed' as const, progress: 100, startDelayedCount: 0, isLateCompletion: false };
    expect(computeCriticality(project, 0, 100)).toBe(0);
  });
});

describe('sortProjectsByCriticality', () => {
  it('ordena por score desc entre faixas diferentes', () => {
    const delayed = baseProject({ id: 'a', status: 'delayed', plannedEnd: '2026-01-01' });
    const planned = baseProject({ id: 'b', status: 'planned' });
    const completedOnTime = baseProject({ id: 'c', status: 'completed', isLateCompletion: false });
    const sorted = sortProjectsByCriticality([completedOnTime, planned, delayed], '2026-08-11', []);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('empate de score: desempata por plannedEnd mais próximo primeiro', () => {
    const later = baseProject({ id: 'a', status: 'planned', startDelayedCount: 1, plannedEnd: '2026-12-01' });
    const sooner = baseProject({ id: 'b', status: 'planned', startDelayedCount: 1, plannedEnd: '2026-09-01' });
    const sorted = sortProjectsByCriticality([later, sooner], '2026-08-11', []);
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('empate total (score, desvio e plannedEnd iguais): desempata por id, estável', () => {
    const b = baseProject({ id: 'b', status: 'planned' });
    const a = baseProject({ id: 'a', status: 'planned' });
    const sorted = sortProjectsByCriticality([b, a], '2026-08-11', []);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('computeProjectTeam', () => {
  const people: Person[] = [
    { id: 'joao', name: 'João', active: true },
    { id: 'maria', name: 'Maria', active: true },
  ];

  it('deriva de Task.responsavelId, não de atividade — uma entrada por pessoa distinta, sem duplicar', () => {
    const project = baseProject({
      activities: [
        {
          id: 'a1',
          projectId: 'p1',
          name: 'Atividade',
          tasks: [
            { id: 't1', rowNumber: 1, activityId: 'a1', name: 'T1', category: 'eletrica', predecessorRowNumbers: [], plannedStart: '2026-01-01', plannedEnd: '2026-01-02', responsavelId: 'joao', status: 'planned', isBlocked: false, isStartDelayed: false, isLateCompletion: false },
            { id: 't2', rowNumber: 2, activityId: 'a1', name: 'T2', category: 'eletrica', predecessorRowNumbers: [], plannedStart: '2026-01-01', plannedEnd: '2026-01-02', responsavelId: 'joao', status: 'delayed', isBlocked: false, isStartDelayed: false, isLateCompletion: false },
          ],
          status: 'delayed',
          blockedCount: 0,
          startDelayedCount: 0,
          isLateCompletion: false,
          progress: 0,
        },
      ],
    });
    const team = computeProjectTeam(project, people);
    expect(team).toHaveLength(1);
    expect(team[0].person.name).toBe('João');
    expect(team[0].hasDelayedTask).toBe(true); // t2 está delayed
  });

  it('tarefa sem responsavelId não entra na equipe', () => {
    const project = baseProject({
      activities: [
        {
          id: 'a1',
          projectId: 'p1',
          name: 'Atividade',
          tasks: [
            { id: 't1', rowNumber: 1, activityId: 'a1', name: 'T1', category: 'eletrica', predecessorRowNumbers: [], plannedStart: '2026-01-01', plannedEnd: '2026-01-02', status: 'planned', isBlocked: false, isStartDelayed: false, isLateCompletion: false },
          ],
          status: 'planned',
          blockedCount: 0,
          startDelayedCount: 0,
          isLateCompletion: false,
          progress: 0,
        },
      ],
    });
    expect(computeProjectTeam(project, people)).toEqual([]);
  });
});

describe('computeFocusTask', () => {
  it('sem tarefas: null', () => {
    expect(computeFocusTask([])).toBeNull();
  });

  it('todas concluídas: null', () => {
    const tasks = [taskView({ id: 't1', status: 'completed' }), taskView({ id: 't2', status: 'completed' })];
    expect(computeFocusTask(tasks)).toBeNull();
  });

  it('pega a não concluída com plannedEnd mais próximo/vencido', () => {
    const tasks = [
      taskView({ id: 't1', rowNumber: 1, plannedEnd: '2026-03-01', status: 'planned' }),
      taskView({ id: 't2', rowNumber: 2, plannedEnd: '2026-01-15', status: 'delayed' }), // mais vencida
      taskView({ id: 't3', rowNumber: 3, plannedEnd: '2026-02-01', status: 'in_progress' }),
    ];
    expect(computeFocusTask(tasks)?.id).toBe('t2');
  });

  it('ignora tarefas já concluídas mesmo com plannedEnd mais cedo', () => {
    const tasks = [
      taskView({ id: 't1', rowNumber: 1, plannedEnd: '2026-01-01', status: 'completed' }),
      taskView({ id: 't2', rowNumber: 2, plannedEnd: '2026-02-01', status: 'planned' }),
    ];
    expect(computeFocusTask(tasks)?.id).toBe('t2');
  });

  it('empate de plannedEnd: desempata por rowNumber', () => {
    const tasks = [
      taskView({ id: 't2', rowNumber: 2, plannedEnd: '2026-01-01', status: 'planned' }),
      taskView({ id: 't1', rowNumber: 1, plannedEnd: '2026-01-01', status: 'planned' }),
    ];
    expect(computeFocusTask(tasks)?.id).toBe('t1');
  });
});
