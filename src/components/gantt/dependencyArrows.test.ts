import { describe, expect, it } from 'vitest';
import {
  buildVisibleRowIndex,
  computeArrowGroups,
  computeDependencyArrowGeometry,
  resolveVisibleDependencyEndpoint,
  type DependencyEdge,
} from './dependencyArrows';
import type { DateRange } from './ganttMath';

const range: DateRange = { start: '2026-08-01', end: '2026-08-31' };
const PX_PER_DAY = 8;
const ROW_HEIGHT = 34;

describe('resolveVisibleDependencyEndpoint', () => {
  const taskToActivityId = new Map([
    ['t1', 'a1'],
    ['t2', 'a1'],
  ]);
  const activityToProjectId = new Map([['a1', 'p1']]);

  it('tarefa visível (nada recolhido): resolve nela mesma', () => {
    const result = resolveVisibleDependencyEndpoint('t1', taskToActivityId, activityToProjectId, new Set(), new Set());
    expect(result).toEqual({ level: 'task', id: 't1' });
  });

  it('atividade-pai recolhida: resolve na atividade', () => {
    const result = resolveVisibleDependencyEndpoint(
      't1',
      taskToActivityId,
      activityToProjectId,
      new Set(['a1']),
      new Set(),
    );
    expect(result).toEqual({ level: 'activity', id: 'a1' });
  });

  it('projeto inteiro recolhido: resolve no projeto (mesmo com a atividade também recolhida)', () => {
    const result = resolveVisibleDependencyEndpoint(
      't1',
      taskToActivityId,
      activityToProjectId,
      new Set(['a1']),
      new Set(['p1']),
    );
    expect(result).toEqual({ level: 'project', id: 'p1' });
  });

  it('duas tarefas da mesma atividade recolhida resolvem pro mesmo id (gatilho pra suprimir a seta)', () => {
    const r1 = resolveVisibleDependencyEndpoint('t1', taskToActivityId, activityToProjectId, new Set(['a1']), new Set());
    const r2 = resolveVisibleDependencyEndpoint('t2', taskToActivityId, activityToProjectId, new Set(['a1']), new Set());
    expect(r1).toEqual(r2);
  });
});

describe('computeArrowGroups', () => {
  const resolveIdentity = (taskId: string) => ({ level: 'task' as const, id: taskId });

  it('3 dependências que resolvem pro mesmo par (origem, destino, tipo) viram 1 grupo só', () => {
    const edges: DependencyEdge[] = [
      { taskId: 'b1', predecessorTaskId: 'a1', tipo: 'FS', folgaDias: 0, violated: false },
      { taskId: 'b2', predecessorTaskId: 'a2', tipo: 'FS', folgaDias: 0, violated: false },
      { taskId: 'b3', predecessorTaskId: 'a3', tipo: 'FS', folgaDias: 0, violated: false },
    ];
    const resolveToGroup = (taskId: string) =>
      taskId.startsWith('a') ? { level: 'activity' as const, id: 'A' } : { level: 'activity' as const, id: 'B' };

    const groups = computeArrowGroups(edges, resolveToGroup);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ origem: { level: 'activity', id: 'A' }, destino: { level: 'activity', id: 'B' }, tipo: 'FS' });
  });

  it('grupo sai violado se QUALQUER aresta do grupo estiver violada', () => {
    const edges: DependencyEdge[] = [
      { taskId: 'b1', predecessorTaskId: 'a1', tipo: 'FS', folgaDias: 0, violated: false },
      { taskId: 'b2', predecessorTaskId: 'a2', tipo: 'FS', folgaDias: 0, violated: true },
      { taskId: 'b3', predecessorTaskId: 'a3', tipo: 'FS', folgaDias: 0, violated: false },
    ];
    const resolveToGroup = (taskId: string) =>
      taskId.startsWith('a') ? { level: 'activity' as const, id: 'A' } : { level: 'activity' as const, id: 'B' };

    const groups = computeArrowGroups(edges, resolveToGroup);
    expect(groups).toHaveLength(1);
    expect(groups[0].violada).toBe(true);
  });

  it('origem e destino resolvendo pra mesma linha (mesmo nível recolhido) não gera grupo', () => {
    const edges: DependencyEdge[] = [{ taskId: 't2', predecessorTaskId: 't1', tipo: 'FS', folgaDias: 0, violated: false }];
    const groups = computeArrowGroups(edges, () => ({ level: 'activity', id: 'A' }));
    expect(groups).toHaveLength(0);
  });

  it('tipos diferentes entre o mesmo par de nós não se fundem — 2 grupos', () => {
    const edges: DependencyEdge[] = [
      { taskId: 'b1', predecessorTaskId: 'a1', tipo: 'FS', folgaDias: 0, violated: false },
      { taskId: 'b1', predecessorTaskId: 'a1', tipo: 'SS', folgaDias: 0, violated: false },
    ];
    const groups = computeArrowGroups(edges, resolveIdentity);
    expect(groups).toHaveLength(2);
  });
});

describe('computeDependencyArrowGeometry', () => {
  const predecessor = { rowIndex: 0, plannedStart: '2026-08-03', plannedEnd: '2026-08-10' };
  const successor = { rowIndex: 1, plannedStart: '2026-08-12', plannedEnd: '2026-08-18' };

  it('FS: sai do fim da predecessora (80px), entra no início da sucessora (88px)', () => {
    const geometry = computeDependencyArrowGeometry('FS', 0, predecessor, successor, range, PX_PER_DAY, ROW_HEIGHT);
    expect(geometry.path).toBe('M 72 17 H 80 V 51 H 88');
    expect(geometry.labelText).toBe('');
  });

  it('SS: sai do início da predecessora, entra no início da sucessora', () => {
    const geometry = computeDependencyArrowGeometry('SS', 2, predecessor, successor, range, PX_PER_DAY, ROW_HEIGHT);
    expect(geometry.path).toBe('M 16 17 H 52 V 51 H 88');
    expect(geometry.labelText).toBe('SS+2');
  });

  it('FF: sai do fim da predecessora, entra no fim da sucessora', () => {
    const geometry = computeDependencyArrowGeometry('FF', 0, predecessor, successor, range, PX_PER_DAY, ROW_HEIGHT);
    expect(geometry.path).toBe('M 72 17 H 104 V 51 H 136');
  });

  it('SF: sai do início da predecessora, entra no fim da sucessora', () => {
    const geometry = computeDependencyArrowGeometry('SF', -1, predecessor, successor, range, PX_PER_DAY, ROW_HEIGHT);
    expect(geometry.path).toBe('M 16 17 H 76 V 51 H 136');
    expect(geometry.labelText).toBe('SF-1');
  });

  it('sucessora "atrás" da predecessora: roteamento de 3 segmentos', () => {
    const earlySuccessor = { rowIndex: 1, plannedStart: '2026-08-04', plannedEnd: '2026-08-06' };
    const geometry = computeDependencyArrowGeometry('FS', 0, predecessor, earlySuccessor, range, PX_PER_DAY, ROW_HEIGHT);
    // x1 = 72 (fim previsto em 10/08), x2 = 24 (início previsto em 04/08) — x2 < x1.
    expect(geometry.path).toBe('M 72 17 H 82 V 51 H 14 L 24 51');
  });
});

describe('buildVisibleRowIndex', () => {
  const projects = [
    {
      id: 'p1',
      plannedStart: '2026-08-01',
      plannedEnd: '2026-08-20',
      activities: [
        {
          id: 'a1',
          plannedStart: '2026-08-01',
          plannedEnd: '2026-08-10',
          tasks: [
            { id: 't1', plannedStart: '2026-08-01', plannedEnd: '2026-08-05' },
            { id: 't2', plannedStart: '2026-08-06', plannedEnd: '2026-08-10' },
          ],
        },
        {
          id: 'a2',
          plannedStart: '2026-08-11',
          plannedEnd: '2026-08-20',
          tasks: [{ id: 't3', plannedStart: '2026-08-11', plannedEnd: '2026-08-20' }],
        },
      ],
    },
  ];

  it('tudo expandido: projeto(0), atividade a1(1), t1(2), t2(3), atividade a2(4), t3(5)', () => {
    const index = buildVisibleRowIndex(projects, new Set(), new Set());
    expect(index.get('project:p1')?.rowIndex).toBe(0);
    expect(index.get('activity:a1')?.rowIndex).toBe(1);
    expect(index.get('task:t1')?.rowIndex).toBe(2);
    expect(index.get('task:t2')?.rowIndex).toBe(3);
    expect(index.get('activity:a2')?.rowIndex).toBe(4);
    expect(index.get('task:t3')?.rowIndex).toBe(5);
    expect(index.size).toBe(6);
  });

  it('atividade a1 recolhida: t1/t2 somem do índice, a2 e t3 continuam, sem furo nos índices', () => {
    const index = buildVisibleRowIndex(projects, new Set(), new Set(['a1']));
    expect(index.has('task:t1')).toBe(false);
    expect(index.get('activity:a2')?.rowIndex).toBe(2);
    expect(index.get('task:t3')?.rowIndex).toBe(3);
    expect(index.size).toBe(4);
  });

  it('projeto recolhido: só a linha do projeto entra no índice', () => {
    const index = buildVisibleRowIndex(projects, new Set(['p1']), new Set());
    expect(index.size).toBe(1);
    expect(index.get('project:p1')?.rowIndex).toBe(0);
  });
});
