import { describe, expect, it } from 'vitest';
import {
  computeLateCompletionDays,
  computeTaskBlocked,
  computeTaskStartDelayed,
  computeTaskStatus,
  isLateCompletion,
  rollUpBlockedCount,
  rollUpDates,
  rollUpLateCompletion,
  rollUpStartDelayedCount,
  rollUpStatus,
} from './status';
import type { Task, TaskView } from '../types';

// Funções puras (Fase 2.3) — sem Supabase, sem autenticação, `today`/`holidays` sempre
// injetados pelo teste, nunca lidos do relógio real.

const baseTask: Task = {
  id: 't1',
  rowNumber: 1,
  activityId: 'a1',
  name: 'Tarefa',
  category: 'eletrica',
  predecessorRowNumbers: [],
  plannedStart: '2026-08-01',
  plannedEnd: '2026-08-10',
};

function taskView(overrides: Partial<TaskView> = {}): TaskView {
  return {
    ...baseTask,
    status: 'planned',
    isBlocked: false,
    isStartDelayed: false,
    isLateCompletion: false,
    ...overrides,
  };
}

describe('computeTaskStatus', () => {
  it('completed quando tem actualEnd, mesmo com today bem depois', () => {
    const task: Task = { ...baseTask, actualEnd: '2026-08-05' };
    expect(computeTaskStatus(task, '2027-01-01')).toBe('completed');
  });

  it('delayed quando today > plannedEnd', () => {
    expect(computeTaskStatus(baseTask, '2026-08-11')).toBe('delayed');
  });

  it('não é delayed quando today === plannedEnd — comparação estrita', () => {
    expect(computeTaskStatus(baseTask, '2026-08-10')).toBe('planned');
  });

  it('in_progress quando tem actualStart sem actualEnd', () => {
    const task: Task = { ...baseTask, actualStart: '2026-08-02' };
    expect(computeTaskStatus(task, '2026-08-05')).toBe('in_progress');
  });

  it('planned quando nada real e dentro do prazo', () => {
    expect(computeTaskStatus(baseTask, '2026-08-05')).toBe('planned');
  });
});

describe('rollUpStatus', () => {
  it('planned quando não há filhos (atividade sem tarefas / projeto sem atividades)', () => {
    expect(rollUpStatus([])).toBe('planned');
  });

  it('delayed se ALGUMA filha é delayed', () => {
    expect(rollUpStatus([{ status: 'completed' }, { status: 'delayed' }, { status: 'planned' }])).toBe('delayed');
  });

  it('completed só se TODAS são completed', () => {
    expect(rollUpStatus([{ status: 'completed' }, { status: 'completed' }])).toBe('completed');
  });

  it('1 completed + 4 planned NÃO vira completed — vira in_progress', () => {
    const children = [
      { status: 'completed' as const },
      { status: 'planned' as const },
      { status: 'planned' as const },
      { status: 'planned' as const },
      { status: 'planned' as const },
    ];
    expect(rollUpStatus(children)).toBe('in_progress');
  });

  it('in_progress se ALGUMA já começou (in_progress ou completed), sem nenhuma delayed', () => {
    expect(rollUpStatus([{ status: 'in_progress' }, { status: 'planned' }])).toBe('in_progress');
  });

  it('planned quando nenhuma começou', () => {
    expect(rollUpStatus([{ status: 'planned' }, { status: 'planned' }])).toBe('planned');
  });
});

describe('computeTaskBlocked', () => {
  const predecessor = (status: 'completed' | 'planned'): Map<number, TaskView> =>
    new Map([[1, taskView({ rowNumber: 1, status })]]);

  it('não bloqueada antes de plannedStart, mesmo com predecessora pendente', () => {
    const task: Task = { ...baseTask, rowNumber: 2, predecessorRowNumbers: [1], plannedStart: '2026-08-15' };
    expect(computeTaskBlocked(task, predecessor('planned'), '2026-08-01')).toBe(false);
  });

  it('bloqueada depois de plannedStart, sem actualStart, com predecessora pendente', () => {
    const task: Task = { ...baseTask, rowNumber: 2, predecessorRowNumbers: [1] };
    expect(computeTaskBlocked(task, predecessor('planned'), '2026-08-05')).toBe(true);
  });

  it('não bloqueada quando a predecessora já concluiu', () => {
    const task: Task = { ...baseTask, rowNumber: 2, predecessorRowNumbers: [1] };
    expect(computeTaskBlocked(task, predecessor('completed'), '2026-08-05')).toBe(false);
  });
});

describe('isLateCompletion', () => {
  it('false sem actualEnd', () => {
    expect(isLateCompletion({ plannedEnd: '2026-08-10' })).toBe(false);
  });

  it('false quando actualEnd === plannedEnd', () => {
    expect(isLateCompletion({ plannedEnd: '2026-08-10', actualEnd: '2026-08-10' })).toBe(false);
  });

  it('true quando actualEnd > plannedEnd', () => {
    expect(isLateCompletion({ plannedEnd: '2026-08-10', actualEnd: '2026-08-13' })).toBe(true);
  });

  it('false quando plannedEnd está ausente — guarda explícita, não acidente de comparação', () => {
    expect(isLateCompletion({ actualEnd: '2026-08-13' })).toBe(false);
  });
});

describe('computeTaskStartDelayed', () => {
  it('false antes do prazo', () => {
    expect(computeTaskStartDelayed(baseTask, '2026-07-01')).toBe(false);
  });

  it('true depois do prazo sem nenhuma data real', () => {
    expect(computeTaskStartDelayed(baseTask, '2026-08-05')).toBe(true);
  });

  it('false quando actualStart já preenchido', () => {
    const task: Task = { ...baseTask, actualStart: '2026-08-02' };
    expect(computeTaskStartDelayed(task, '2026-08-05')).toBe(false);
  });

  it('false quando plannedStart está ausente — guarda explícita', () => {
    const task: Task = { ...baseTask, plannedStart: '' };
    expect(computeTaskStartDelayed(task, '2026-08-05')).toBe(false);
  });
});

describe('rollUpBlockedCount / rollUpStartDelayedCount / rollUpLateCompletion', () => {
  it('rollUpBlockedCount soma isBlocked nas tarefas-filhas', () => {
    expect(rollUpBlockedCount([{ isBlocked: true }, { isBlocked: false }, { isBlocked: true }])).toBe(2);
  });

  it('rollUpBlockedCount soma blockedCount já agregado nas atividades-filhas', () => {
    expect(rollUpBlockedCount([{ blockedCount: 3 }, { blockedCount: 1 }])).toBe(4);
  });

  it('rollUpBlockedCount com coleção vazia é 0', () => {
    expect(rollUpBlockedCount([])).toBe(0);
  });

  it('rollUpStartDelayedCount soma isStartDelayed nas tarefas-filhas', () => {
    expect(rollUpStartDelayedCount([{ isStartDelayed: true }, { isStartDelayed: true }])).toBe(2);
  });

  it('rollUpLateCompletion é true se ALGUMA filha é late', () => {
    expect(rollUpLateCompletion([{ isLateCompletion: false }, { isLateCompletion: true }])).toBe(true);
  });

  it('rollUpLateCompletion com coleção vazia é false', () => {
    expect(rollUpLateCompletion([])).toBe(false);
  });
});

describe('computeLateCompletionDays', () => {
  it('undefined quando holidays ainda não carregou (undefined ≠ [])', () => {
    const task: Task = { ...baseTask, plannedEnd: '2026-04-17', actualEnd: '2026-04-23' };
    expect(computeLateCompletionDays(task, undefined, 'Matriz')).toBeUndefined();
  });

  it('desconta feriado nacional dentro do intervalo (Tiradentes, 21/abr/2026)', () => {
    // plannedEnd sexta 17/abr; 1º dia útil seguinte = segunda 20/abr; actualEnd quinta 23/abr.
    // Dias úteis no intervalo: seg 20, ter 21 (Tiradentes — descontado), qua 22, qui 23 → 3, não 4.
    const task: Task = { ...baseTask, plannedEnd: '2026-04-17', actualEnd: '2026-04-23' };
    expect(computeLateCompletionDays(task, [], 'Matriz')).toBe(3);
  });
});

describe('rollUpDates', () => {
  it('plannedStart é o mínimo entre os filhos que têm a data', () => {
    const result = rollUpDates([{ plannedStart: '2026-08-10' }, { plannedStart: '2026-08-01' }, { plannedStart: '2026-08-20' }]);
    expect(result.plannedStart).toBe('2026-08-01');
  });

  it('plannedEnd é o máximo entre os filhos que têm a data', () => {
    const result = rollUpDates([{ plannedEnd: '2026-08-10' }, { plannedEnd: '2026-08-01' }, { plannedEnd: '2026-08-20' }]);
    expect(result.plannedEnd).toBe('2026-08-20');
  });

  it('actualStart é o mínimo entre os filhos que JÁ começaram — ANY, não todos', () => {
    const result = rollUpDates([{ actualStart: '2026-08-05' }, {}, { actualStart: '2026-08-01' }]);
    expect(result.actualStart).toBe('2026-08-01');
  });

  it('actualEnd fica undefined quando nem todos os filhos concluíram — 4 de 5 concluídas', () => {
    const children = [
      { actualEnd: '2026-08-01' },
      { actualEnd: '2026-08-02' },
      { actualEnd: '2026-08-03' },
      { actualEnd: '2026-08-04' },
      {}, // 5ª ainda não concluiu
    ];
    expect(rollUpDates(children).actualEnd).toBeUndefined();
  });

  it('actualEnd é o máximo só quando TODOS os filhos concluíram — 5 de 5', () => {
    const children = [
      { actualEnd: '2026-08-01' },
      { actualEnd: '2026-08-02' },
      { actualEnd: '2026-08-03' },
      { actualEnd: '2026-08-04' },
      { actualEnd: '2026-08-05' },
    ];
    expect(rollUpDates(children).actualEnd).toBe('2026-08-05');
  });

  it('coleção vazia retorna tudo undefined', () => {
    expect(rollUpDates([])).toEqual({
      plannedStart: undefined,
      plannedEnd: undefined,
      actualStart: undefined,
      actualEnd: undefined,
    });
  });
});
