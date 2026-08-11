import { describe, expect, it } from 'vitest';
import {
  computeDependencyRuleDate,
  computeTaskBlockedByDependencies,
  computeTaskDependencyViolated,
  validateTaskDependencies,
} from './dependencies';
import type { DependencyType, Task, TaskDependency } from '../types';

// Funções puras (Fase 2.7) — sem Supabase. Datas de teste caem numa semana cheia sem feriado
// (seg 2026-08-03 a sex 2026-08-14, fim de semana em 08-08/09) pra manter a aritmética de dias
// úteis fácil de conferir de cabeça.

const baseTask: Task = {
  id: 't1',
  rowNumber: 1,
  activityId: 'a1',
  name: 'Tarefa',
  category: 'eletrica',
  predecessorRowNumbers: [],
  plannedStart: '2026-08-03',
  plannedEnd: '2026-08-10',
  baseStart: '2026-08-03',
  baseEnd: '2026-08-10',
};

describe('validateTaskDependencies', () => {
  function withPredecessors(rowNumber: number, predecessorRowNumbers: number[]): Task {
    return { ...baseTask, id: `t${rowNumber}`, rowNumber, predecessorRowNumbers };
  }

  it('inválida quando a tarefa depende dela mesma', () => {
    const tasks = [withPredecessors(1, [1])];
    expect(validateTaskDependencies(1, tasks)).toEqual({
      valid: false,
      errors: ['Uma tarefa não pode depender dela mesma.'],
    });
  });

  it('inválida quando a predecessora não existe', () => {
    const tasks = [withPredecessors(1, [9])];
    expect(validateTaskDependencies(1, tasks)).toEqual({ valid: false, errors: ['A tarefa 9 não existe.'] });
  });

  it('inválida quando a mesma predecessora é informada duas vezes', () => {
    const tasks = [withPredecessors(1, [2, 2]), withPredecessors(2, [])];
    expect(validateTaskDependencies(1, tasks)).toEqual({
      valid: false,
      errors: ['A mesma predecessora foi informada mais de uma vez.'],
    });
  });

  it('inválida quando cria ciclo (direto)', () => {
    const tasks = [withPredecessors(1, [2]), withPredecessors(2, [1])];
    expect(validateTaskDependencies(1, tasks)).toEqual({
      valid: false,
      errors: ['Esta dependência cria um ciclo entre tarefas.'],
    });
  });

  it('inválida quando cria ciclo (indireto, cadeia de 3)', () => {
    const tasks = [withPredecessors(1, [2]), withPredecessors(2, [3]), withPredecessors(3, [1])];
    expect(validateTaskDependencies(1, tasks)).toEqual({
      valid: false,
      errors: ['Esta dependência cria um ciclo entre tarefas.'],
    });
  });

  it('válida sem nenhum problema', () => {
    const tasks = [withPredecessors(1, [2, 3]), withPredecessors(2, []), withPredecessors(3, [])];
    expect(validateTaskDependencies(1, tasks)).toEqual({ valid: true, errors: [] });
  });
});

describe('computeDependencyRuleDate', () => {
  const predecessor = { plannedStart: '2026-08-03', plannedEnd: '2026-08-05' };

  it('FS: fim da predecessora + 1 dia útil + folga', () => {
    expect(computeDependencyRuleDate({ tipo: 'FS', folgaDias: 0 }, predecessor, [], 'matriz')).toBe('2026-08-06');
    expect(computeDependencyRuleDate({ tipo: 'FS', folgaDias: 2 }, predecessor, [], 'matriz')).toBe('2026-08-10');
  });

  it('SS: início da predecessora + folga', () => {
    expect(computeDependencyRuleDate({ tipo: 'SS', folgaDias: 0 }, predecessor, [], 'matriz')).toBe('2026-08-03');
    expect(computeDependencyRuleDate({ tipo: 'SS', folgaDias: 2 }, predecessor, [], 'matriz')).toBe('2026-08-05');
  });

  it('FF: fim da predecessora + folga', () => {
    expect(computeDependencyRuleDate({ tipo: 'FF', folgaDias: 0 }, predecessor, [], 'matriz')).toBe('2026-08-05');
    expect(computeDependencyRuleDate({ tipo: 'FF', folgaDias: 3 }, predecessor, [], 'matriz')).toBe('2026-08-10');
  });

  it('SF: início da predecessora + folga', () => {
    expect(computeDependencyRuleDate({ tipo: 'SF', folgaDias: 0 }, predecessor, [], 'matriz')).toBe('2026-08-03');
    expect(computeDependencyRuleDate({ tipo: 'SF', folgaDias: 2 }, predecessor, [], 'matriz')).toBe('2026-08-05');
  });

  it('folga negativa (antecipação) volta dias úteis em vez de avançar', () => {
    // predecessor.plannedStart é segunda (2026-08-03); 1 dia útil pra trás pula o fim de semana
    // e cai na sexta anterior (2026-07-31), não no sábado/domingo.
    expect(computeDependencyRuleDate({ tipo: 'SS', folgaDias: -1 }, predecessor, [], 'matriz')).toBe('2026-07-31');
  });
});

describe('computeTaskDependencyViolated', () => {
  const predecessorId = 'p1';
  const predecessor = { plannedStart: '2026-08-03', plannedEnd: '2026-08-05' };
  const tasksById = new Map([[predecessorId, predecessor]]);

  function withDependency(dep: TaskDependency, plannedStart: string, plannedEnd: string) {
    return { plannedStart, plannedEnd, dependencies: [dep] };
  }

  it('FS violado quando início previsto da sucessora é antes da regra', () => {
    const dep: TaskDependency = { predecessorId, tipo: 'FS', folgaDias: 0 };
    expect(computeTaskDependencyViolated(withDependency(dep, '2026-08-05', '2026-08-10'), tasksById, [], 'matriz')).toBe(
      true,
    );
    expect(computeTaskDependencyViolated(withDependency(dep, '2026-08-06', '2026-08-10'), tasksById, [], 'matriz')).toBe(
      false,
    );
  });

  it('FF violado quando fim previsto da sucessora é antes da regra', () => {
    const dep: TaskDependency = { predecessorId, tipo: 'FF', folgaDias: 0 };
    expect(computeTaskDependencyViolated(withDependency(dep, '2026-08-01', '2026-08-04'), tasksById, [], 'matriz')).toBe(
      true,
    );
    expect(computeTaskDependencyViolated(withDependency(dep, '2026-08-01', '2026-08-05'), tasksById, [], 'matriz')).toBe(
      false,
    );
  });

  it('não violado quando a predecessora não é encontrada (defensivo)', () => {
    const dep: TaskDependency = { predecessorId: 'inexistente', tipo: 'FS', folgaDias: 0 };
    expect(computeTaskDependencyViolated(withDependency(dep, '2026-08-01', '2026-08-04'), tasksById, [], 'matriz')).toBe(
      false,
    );
  });

  it('não violado sem nenhuma dependência', () => {
    expect(
      computeTaskDependencyViolated({ plannedStart: '2026-08-01', plannedEnd: '2026-08-04' }, tasksById, [], 'matriz'),
    ).toBe(false);
  });
});

describe('computeTaskBlockedByDependencies', () => {
  const predecessorId = 'p1';

  function successor(dep: TaskDependency, plannedStart = '2026-08-03', overrides: Partial<Task> = {}): Task {
    return { ...baseTask, id: 't2', rowNumber: 2, plannedStart, dependencies: [dep], ...overrides };
  }

  function tasksByIdWith(predecessorOverrides: Partial<Task>): Map<string, Task> {
    return new Map([[predecessorId, { ...baseTask, id: predecessorId, rowNumber: 1, ...predecessorOverrides }]]);
  }

  it('não bloqueada antes de plannedStart, mesmo com predecessora FS pendente', () => {
    const task = successor({ predecessorId, tipo: 'FS', folgaDias: 0 }, '2026-08-15');
    expect(computeTaskBlockedByDependencies(task, tasksByIdWith({}), '2026-08-01', [], 'matriz')).toBe(false);
  });

  it('não bloqueada quando a própria tarefa já começou', () => {
    const task = successor({ predecessorId, tipo: 'FS', folgaDias: 0 }, '2026-08-03', { actualStart: '2026-08-03' });
    expect(computeTaskBlockedByDependencies(task, tasksByIdWith({}), '2026-08-05', [], 'matriz')).toBe(false);
  });

  it.each([
    ['FS', 0 as const, 'actualEnd' as const, '2026-08-03', '2026-08-03', true],
    ['FS', 0 as const, 'actualEnd' as const, '2026-08-03', '2026-08-04', false],
    ['FS', 2 as const, 'actualEnd' as const, '2026-08-03', '2026-08-05', true],
    ['FS', 2 as const, 'actualEnd' as const, '2026-08-03', '2026-08-06', false],
    ['FS', -1 as const, 'actualEnd' as const, '2026-08-03', '2026-08-03', false],
    ['SS', 0 as const, 'actualStart' as const, '2026-08-03', '2026-08-03', false],
    ['SS', 2 as const, 'actualStart' as const, '2026-08-03', '2026-08-04', true],
    ['SS', 2 as const, 'actualStart' as const, '2026-08-03', '2026-08-05', false],
    ['SS', -1 as const, 'actualStart' as const, '2026-08-04', '2026-08-04', false],
  ])(
    'tipo=%s folga=%i (%s=%s), today=%s → bloqueada=%s',
    (tipo, folgaDias, anchorField, anchorValue, today, expected) => {
      const dep: TaskDependency = { predecessorId, tipo: tipo as DependencyType, folgaDias };
      const task = successor(dep);
      const predecessor = tasksByIdWith({ [anchorField]: anchorValue });
      expect(computeTaskBlockedByDependencies(task, predecessor, today, [], 'matriz')).toBe(expected);
    },
  );

  it.each(['FS', 'SS'] as const)(
    '%s: bloqueada enquanto a predecessora não tem a data real que a regra pede, independente de folga',
    (tipo) => {
      const dep: TaskDependency = { predecessorId, tipo, folgaDias: 5 };
      const task = successor(dep);
      expect(computeTaskBlockedByDependencies(task, tasksByIdWith({}), '2026-08-05', [], 'matriz')).toBe(true);
    },
  );

  it.each(['FF', 'SF'] as const)(
    '%s nunca bloqueia o início, mesmo sem nenhuma data real da predecessora',
    (tipo) => {
      const dep: TaskDependency = { predecessorId, tipo, folgaDias: 0 };
      const task = successor(dep);
      expect(computeTaskBlockedByDependencies(task, tasksByIdWith({}), '2026-08-05', [], 'matriz')).toBe(false);
    },
  );

  it('não bloqueada quando a predecessora não é encontrada (defensivo)', () => {
    const dep: TaskDependency = { predecessorId: 'inexistente', tipo: 'FS', folgaDias: 0 };
    const task = successor(dep);
    expect(computeTaskBlockedByDependencies(task, tasksByIdWith({}), '2026-08-05', [], 'matriz')).toBe(false);
  });
});
