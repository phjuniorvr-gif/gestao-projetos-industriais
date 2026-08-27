import { describe, expect, it } from 'vitest';
import {
  computeCandidatePredecessors,
  computeDependencyRuleDate,
  computeTaskBlockedByDependencies,
  computeTaskDependencyViolated,
  countViolatedDependencyEdges,
  hasCycle,
  validateTaskDependencies,
} from './dependencies';
import type { DependencyType, Task, TaskDependency } from '../types';
import type { DependencyGraphNode } from './dependencies';
import { supabase } from '../services/supabaseClient';

// Funções puras (Fase 2.7) — sem Supabase. Datas de teste caem numa semana cheia sem feriado
// (seg 2026-08-03 a sex 2026-08-14, fim de semana em 08-08/09) pra manter a aritmética de dias
// úteis fácil de conferir de cabeça.

const baseTask: Task = {
  id: 't1',
  rowNumber: 1,
  activityId: 'a1',
  name: 'Tarefa',
  category: 'eletrica',
  dependencies: [],
  plannedStart: '2026-08-03',
  plannedEnd: '2026-08-10',
  baseStart: '2026-08-03',
  baseEnd: '2026-08-10',
  confirmedByAdmin: true,
  rejected: false,
  rejectionCount: 0,
};

describe('validateTaskDependencies', () => {
  function withPredecessors(rowNumber: number, predecessorRowNumbers: number[]): DependencyGraphNode {
    return { rowNumber, predecessorRowNumbers };
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

describe('computeCandidatePredecessors', () => {
  // A←B←C: B depende de A, C depende de B. D solta, sem relação com a cadeia.
  const chain: DependencyGraphNode[] = [
    { rowNumber: 1, predecessorRowNumbers: [] }, // A
    { rowNumber: 2, predecessorRowNumbers: [1] }, // B
    { rowNumber: 3, predecessorRowNumbers: [2] }, // C
    { rowNumber: 4, predecessorRowNumbers: [] }, // D
  ];

  it('a própria tarefa nunca aparece na lista dela mesma', () => {
    expect(computeCandidatePredecessors(1, chain, [])).not.toContain(1);
    expect(computeCandidatePredecessors(4, chain, [])).not.toContain(4);
  });

  it('quem depende dela direta ou indiretamente (ciclo) não aparece — só D sobra pra A', () => {
    // B depende de A; C depende de B (logo, de A também, transitivamente) — os dois criariam
    // ciclo se virassem predecessora de A. Só D (sem nenhuma relação) é candidata segura.
    expect(computeCandidatePredecessors(1, chain, [])).toEqual([4]);
  });

  it('sem risco de ciclo (D não participa da cadeia): todas as outras 3 são candidatas', () => {
    expect(computeCandidatePredecessors(4, chain, [])).toEqual([1, 2, 3]);
  });

  it('predecessora já ligada noutra linha do editor não aparece de novo, mas reaparece se a lista de exclusão não incluir aquela linha', () => {
    // Simula: tarefa D já tem a linha 1 (A) ligada. Uma linha NOVA do editor de D não deve
    // oferecer A de novo (já ligada). A própria linha que já tem A selecionado, ao recalcular
    // suas candidatas excluindo só as OUTRAS linhas (lista vazia aqui), continua vendo A.
    expect(computeCandidatePredecessors(4, chain, [1])).toEqual([2, 3]);
    expect(computeCandidatePredecessors(4, chain, [])).toEqual([1, 2, 3]);
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

describe('countViolatedDependencyEdges', () => {
  it('fixture de 3 tarefas/4 dependências, 2 violadas → 2', () => {
    const tasksById = new Map([['p1', { plannedStart: '2026-08-03', plannedEnd: '2026-08-05' }]]);
    const tasks = [
      {
        id: 'a',
        plannedStart: '2026-08-05',
        plannedEnd: '2026-08-12',
        dependencies: [
          { predecessorId: 'p1', tipo: 'FS' as const, folgaDias: 0 }, // violado: 05 < 06
          { predecessorId: 'p1', tipo: 'FS' as const, folgaDias: -1 }, // ok: 05 não é < 05
        ],
      },
      {
        id: 'b',
        plannedStart: '2026-08-06',
        plannedEnd: '2026-08-12',
        dependencies: [
          { predecessorId: 'p1', tipo: 'FS' as const, folgaDias: 0 }, // ok: 06 não é < 06
          { predecessorId: 'p1', tipo: 'SS' as const, folgaDias: 5 }, // violado: 06 < 10
        ],
      },
    ];
    const unitByTaskId = new Map([
      ['a', 'matriz'],
      ['b', 'matriz'],
    ]);
    expect(countViolatedDependencyEdges(tasks, tasksById, [], unitByTaskId)).toBe(2);
  });

  it('sem dependências: 0', () => {
    expect(countViolatedDependencyEdges([], new Map(), [], new Map())).toBe(0);
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

// Compara haveria_ciclo() (SQL, migration add_anti_ciclo_trigger_dependencias) contra hasCycle()
// (TS) pro mesmo grafo — mesmo remédio já usado pra pascoa()/feriados_nacionais() na Fase 2.6
// (dates.test.ts), pra duas implementações da mesma regra não divergirem sem ninguém perceber.
// haveria_ciclo() é liberada pra `anon` (grant na própria migration) justamente pra este teste
// rodar sem autenticar. Cada caso: um grafo-base (sem ciclo) + uma aresta candidata (no depende
// de predecessor); TS calcula com hasCycle() sobre o grafo hipotético (aresta já incluída), SQL
// calcula com haveria_ciclo() sobre o grafo-base + a aresta candidata como parâmetros separados.
describe('anti-ciclo de dependências — SQL vs TS', () => {
  interface Edge {
    no: string;
    predecessor: string;
  }

  function hypotheticalHasCycle(baseEdges: Edge[], no: string, predecessor: string): boolean {
    const nodeIds = new Set(baseEdges.flatMap((e) => [e.no, e.predecessor]));
    nodeIds.add(no);
    nodeIds.add(predecessor);
    const rowNumberById = new Map(Array.from(nodeIds).map((id, i) => [id, i + 1]));
    const nodes: DependencyGraphNode[] = Array.from(nodeIds).map((id) => ({
      rowNumber: rowNumberById.get(id)!,
      predecessorRowNumbers: baseEdges
        .filter((e) => e.no === id)
        .map((e) => rowNumberById.get(e.predecessor)!),
    }));
    return hasCycle(
      nodes.map((n) =>
        n.rowNumber === rowNumberById.get(no)
          ? { ...n, predecessorRowNumbers: [...n.predecessorRowNumbers, rowNumberById.get(predecessor)!] }
          : n,
      ),
    );
  }

  async function sqlHasCycle(baseEdges: Edge[], no: string, predecessor: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('haveria_ciclo', {
      p_no: no,
      p_predecessor: predecessor,
      p_arestas: baseEdges,
    });
    if (error) throw error;
    return data as boolean;
  }

  const cases: { name: string; baseEdges: Edge[]; no: string; predecessor: string; expected: boolean }[] = [
    {
      name: 'cadeia sem ciclo — candidata não fecha nada',
      baseEdges: [
        { no: '2', predecessor: '1' },
        { no: '3', predecessor: '2' },
      ],
      no: '4',
      predecessor: '1',
      expected: false,
    },
    {
      name: 'auto-referência — tarefa não pode depender dela mesma',
      baseEdges: [],
      no: '1',
      predecessor: '1',
      expected: true,
    },
    {
      name: 'triângulo — candidata fecha ciclo de 3 nós',
      baseEdges: [
        { no: '2', predecessor: '1' },
        { no: '3', predecessor: '2' },
      ],
      no: '1',
      predecessor: '3',
      expected: true,
    },
    {
      name: 'ciclo de 5 nós — candidata fecha a cadeia inteira',
      baseEdges: [
        { no: '2', predecessor: '1' },
        { no: '3', predecessor: '2' },
        { no: '4', predecessor: '3' },
        { no: '5', predecessor: '4' },
      ],
      no: '1',
      predecessor: '5',
      expected: true,
    },
    {
      name: 'diamante sem ciclo — candidata só adiciona aresta redundante',
      baseEdges: [
        { no: '2', predecessor: '1' },
        { no: '3', predecessor: '1' },
        { no: '4', predecessor: '2' },
        { no: '4', predecessor: '3' },
      ],
      no: '4',
      predecessor: '1',
      expected: false,
    },
  ];

  it.each(cases)('$name — TS e SQL concordam (esperado: $expected)', async ({ baseEdges, no, predecessor, expected }) => {
    expect(hypotheticalHasCycle(baseEdges, no, predecessor)).toBe(expected);
    await expect(sqlHasCycle(baseEdges, no, predecessor)).resolves.toBe(expected);
  });
});
