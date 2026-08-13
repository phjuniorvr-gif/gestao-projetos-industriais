import { describe, expect, it } from 'vitest';
import { computeDatesFromDuration } from './schedule';
import type { DurationTaskInput } from './schedule';

// Fase 7 (Parte A) — cobre literalmente os "dados extremos" do checklist de QA da spec (Fase 7,
// item 3): projeto sem atividade, atividade sem tarefa, tarefa de 1 dia, cadeia de 5
// dependências, tarefa com início = fim. Mesma semana de referência sem feriado já usada em
// dependencies.test.ts (seg 2026-08-03 a sex 2026-08-14, fim de semana em 08-08/09).

describe('computeDatesFromDuration', () => {
  it('projeto sem atividade / atividade sem tarefa: lista vazia devolve mapa vazio, sem erro', () => {
    const result = computeDatesFromDuration([], '2026-08-03');
    expect(result.size).toBe(0);
  });

  it('tarefa de 1 dia, sem predecessora: previsto início e fim iguais', () => {
    const tasks: DurationTaskInput[] = [{ key: 't1', durationDays: 1, predecessorRowNumbers: [] }];
    const result = computeDatesFromDuration(tasks, '2026-08-03');
    expect(result.get('t1')).toEqual({ plannedStart: '2026-08-03', plannedEnd: '2026-08-03' });
  });

  it('tarefa com início = fim também quando encadeada depois de uma predecessora de 3 dias', () => {
    const tasks: DurationTaskInput[] = [
      { key: 'a', durationDays: 3, predecessorRowNumbers: [] },
      { key: 'b', durationDays: 1, predecessorRowNumbers: [1] },
    ];
    const result = computeDatesFromDuration(tasks, '2026-08-03');
    expect(result.get('a')).toEqual({ plannedStart: '2026-08-03', plannedEnd: '2026-08-05' });
    expect(result.get('b')).toEqual({ plannedStart: '2026-08-06', plannedEnd: '2026-08-06' });
  });

  it('cadeia de 5 dependências: cada tarefa começa no 1º dia útil depois do fim da anterior, atravessando 1 fim de semana', () => {
    const tasks: DurationTaskInput[] = Array.from({ length: 5 }, (_, i) => ({
      key: `t${i + 1}`,
      durationDays: 2,
      predecessorRowNumbers: i === 0 ? [] : [i],
    }));
    const result = computeDatesFromDuration(tasks, '2026-08-03');
    expect(result.get('t1')).toEqual({ plannedStart: '2026-08-03', plannedEnd: '2026-08-04' });
    expect(result.get('t2')).toEqual({ plannedStart: '2026-08-05', plannedEnd: '2026-08-06' });
    // t3 começa numa sexta (08-07) e sua duração de 2 dias úteis atravessa o fim de semana
    // (sábado/domingo 08-08/09 não contam), terminando na segunda seguinte (08-10).
    expect(result.get('t3')).toEqual({ plannedStart: '2026-08-07', plannedEnd: '2026-08-10' });
    expect(result.get('t4')).toEqual({ plannedStart: '2026-08-11', plannedEnd: '2026-08-12' });
    expect(result.get('t5')).toEqual({ plannedStart: '2026-08-13', plannedEnd: '2026-08-14' });
  });
});
