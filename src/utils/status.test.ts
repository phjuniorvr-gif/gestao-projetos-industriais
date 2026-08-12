import { describe, expect, it } from 'vitest';
import {
  computeLateCompletionDays,
  computeProgress,
  computeProgressRatio,
  computeTaskStartDelayed,
  computeTaskStatus,
  isLateCompletion,
  rollUpBlockedCount,
  rollUpDates,
  rollUpLateCompletion,
  rollUpStartDelayedCount,
  rollUpStatus,
  taskWeight,
} from './status';
import type { Task, TaskView } from '../types';

// Funções puras (Fase 2.3) — sem Supabase, sem autenticação, `today`/`holidays` sempre
// injetados pelo teste, nunca lidos do relógio real. computeTaskBlockedByDependencies (bloqueio
// por FS/SS) e computeTaskDependencyViolated moraram pra dependencies.test.ts na Fase 2.7 —
// dependency é assunto daquele arquivo, não deste.

const baseTask: Task = {
  id: 't1',
  rowNumber: 1,
  activityId: 'a1',
  name: 'Tarefa',
  category: 'eletrica',
  dependencies: [],
  plannedStart: '2026-08-01',
  plannedEnd: '2026-08-10',
  baseStart: '2026-08-01',
  baseEnd: '2026-08-10',
};

function taskView(overrides: Partial<TaskView> = {}): TaskView {
  return {
    ...baseTask,
    status: 'planned',
    isBlocked: false,
    isStartDelayed: false,
    isLateCompletion: false,
    hasDependencyViolation: false,
    predecessorRowNumbers: [],
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
      baseStart: undefined,
      baseEnd: undefined,
      actualStart: undefined,
      actualEnd: undefined,
    });
  });

  it('baseStart é o mínimo entre os filhos que têm a data — mesma regra de extremos de plannedStart', () => {
    const result = rollUpDates([{ baseStart: '2026-08-10' }, { baseStart: '2026-08-01' }, { baseStart: '2026-08-20' }]);
    expect(result.baseStart).toBe('2026-08-01');
  });

  it('baseEnd é o máximo entre os filhos que têm a data — mesma regra de extremos de plannedEnd', () => {
    const result = rollUpDates([{ baseEnd: '2026-08-10' }, { baseEnd: '2026-08-01' }, { baseEnd: '2026-08-20' }]);
    expect(result.baseEnd).toBe('2026-08-20');
  });

  it('base não segue a assimetria de actual — some() com só 1 filho preenchido já dá o valor, sem exigir every()', () => {
    // Diferente de actualEnd (que exige TODOS terem valor), baseEnd aparece assim que QUALQUER
    // filho tem baseEnd — porque base é sempre seedada nos dois lados juntos, nunca parcial.
    const children = [{ baseStart: '2026-08-01', baseEnd: '2026-08-05' }, {}, {}];
    expect(rollUpDates(children).baseEnd).toBe('2026-08-05');
  });
});

describe('taskWeight', () => {
  it('início e fim no mesmo dia útil: peso 1 direto da contagem (não é o Math.max entrando em ação)', () => {
    const task = { plannedStart: '2026-08-10', plannedEnd: '2026-08-10' }; // segunda-feira
    expect(taskWeight(task, [], 'Matriz')).toBe(1);
  });

  it('intervalo cai inteiro num fim de semana: contagem daria 0, Math.max força o mínimo 1', () => {
    const task = { plannedStart: '2026-08-01', plannedEnd: '2026-08-02' }; // sábado a domingo
    expect(taskWeight(task, [], 'Matriz')).toBe(1);
  });

  it('desconta feriado nacional dentro do intervalo (Tiradentes, 21/abr/2026)', () => {
    // segunda 20/abr a quinta 23/abr: 4 dias úteis de calendário, mas terça é Tiradentes → 3.
    const task = { plannedStart: '2026-04-20', plannedEnd: '2026-04-23' };
    expect(taskWeight(task, [], 'Matriz')).toBe(3);
  });

  it('plannedStart/plannedEnd ausentes: 0 — guarda explícita, peso neutro', () => {
    expect(taskWeight({}, [], 'Matriz')).toBe(0);
    expect(taskWeight({ plannedStart: '2026-08-10' }, [], 'Matriz')).toBe(0);
    expect(taskWeight({ plannedEnd: '2026-08-10' }, [], 'Matriz')).toBe(0);
  });
});

describe('computeProgress', () => {
  it('sem tarefas: 0', () => {
    expect(computeProgress([], [], 'Matriz')).toBe(0);
  });

  it('nenhuma tarefa concluída: 0', () => {
    const tasks = [taskView({ status: 'planned' }), taskView({ status: 'in_progress' })];
    expect(computeProgress(tasks, [], 'Matriz')).toBe(0);
  });

  it('todas concluídas: 100', () => {
    const tasks = [taskView({ status: 'completed' }), taskView({ status: 'completed' })];
    expect(computeProgress(tasks, [], 'Matriz')).toBe(100);
  });

  it('exemplo exato da spec: 2 de 5 tarefas concluídas somando 22 de 114 dias úteis de peso → 19%, não os 40% que a contagem simples daria', () => {
    // Pesos conferidos rodando businessDaysBetween de verdade (não conta de calendário à mão —
    // a função desconta feriado nacional sempre, então uma conta manual bateria errado):
    //   concluída A: 2026-01-05 a 2026-01-16 → peso 10
    //   concluída B: 2026-01-19 a 2026-02-03 → peso 12   (soma concluído = 22)
    //   pendente C:  2026-02-04 a 2026-03-13 → peso 27
    //   pendente D:  2026-03-16 a 2026-04-24 → peso 28
    //   pendente E:  2026-04-27 a 2026-06-18 → peso 37   (soma total = 114)
    const tasks = [
      taskView({ status: 'completed', plannedStart: '2026-01-05', plannedEnd: '2026-01-16' }),
      taskView({ status: 'completed', plannedStart: '2026-01-19', plannedEnd: '2026-02-03' }),
      taskView({ status: 'planned', plannedStart: '2026-02-04', plannedEnd: '2026-03-13' }),
      taskView({ status: 'planned', plannedStart: '2026-03-16', plannedEnd: '2026-04-24' }),
      taskView({ status: 'planned', plannedStart: '2026-04-27', plannedEnd: '2026-06-18' }),
    ];
    expect(computeProgress(tasks, [], 'Matriz')).toBe(19);
  });

  it('arredondamento nunca sobe pra 100 sem 100% concluído', () => {
    // peso 199 (concluída) + peso 1 (pendente) = 200 → 99,5% → Math.round ingênuo daria 100.
    const tasks = [
      taskView({ status: 'completed', plannedStart: '2026-01-05', plannedEnd: '2026-10-19' }), // peso 199
      taskView({ status: 'planned', plannedStart: '2026-10-20', plannedEnd: '2026-10-20' }), // peso 1
    ];
    expect(computeProgress(tasks, [], 'Matriz')).toBe(99);
  });
});

describe('computeProgressRatio', () => {
  it('sem tarefas: tudo zero', () => {
    expect(computeProgressRatio([], [], 'Matriz')).toEqual({ qtdOk: 0, qtd: 0, duOk: 0, du: 0 });
  });

  it('mesmo exemplo da spec usado em computeProgress: 2/5 tarefas, 22/114 dias úteis', () => {
    const tasks = [
      taskView({ status: 'completed', plannedStart: '2026-01-05', plannedEnd: '2026-01-16' }),
      taskView({ status: 'completed', plannedStart: '2026-01-19', plannedEnd: '2026-02-03' }),
      taskView({ status: 'planned', plannedStart: '2026-02-04', plannedEnd: '2026-03-13' }),
      taskView({ status: 'planned', plannedStart: '2026-03-16', plannedEnd: '2026-04-24' }),
      taskView({ status: 'planned', plannedStart: '2026-04-27', plannedEnd: '2026-06-18' }),
    ];
    expect(computeProgressRatio(tasks, [], 'Matriz')).toEqual({ qtdOk: 2, qtd: 5, duOk: 22, du: 114 });
  });
});
