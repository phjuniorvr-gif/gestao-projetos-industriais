import { describe, expect, it } from 'vitest';
import { barRect, computeTaskBarSegments, getDayTicks, type DateRange } from './ganttMath';

// Range fixo (agosto/2026 inteiro) pra todo teste — offsetPx/width em pixel literal, não
// descrição ("mais larga", "desloca pra direita"). pxPerDay=8, valor que era hardcoded antes do
// zoom existir (zoom "semana").
const range: DateRange = { start: '2026-08-01', end: '2026-08-31' };
const TODAY = '2026-08-08';
const PX_PER_DAY = 8;

describe('computeTaskBarSegments', () => {
  it('não iniciada: só previsto + base, sem real nem excesso', () => {
    const segments = computeTaskBarSegments(
      {
        plannedStart: '2026-08-03',
        plannedEnd: '2026-08-10',
        baseStart: '2026-08-03',
        baseEnd: '2026-08-10',
      },
      range,
      PX_PER_DAY,
      TODAY,
    );
    expect(segments.previsto).toEqual({ left: 16, width: 64 });
    expect(segments.baseline).toEqual({ left: 16, width: 64, dashed: false });
    expect(segments.real).toBeUndefined();
    expect(segments.excesso).toBeUndefined();
  });

  it('concluída no prazo: previsto e real com a mesma geometria, sem excesso', () => {
    const segments = computeTaskBarSegments(
      {
        plannedStart: '2026-08-03',
        plannedEnd: '2026-08-10',
        baseStart: '2026-08-03',
        baseEnd: '2026-08-10',
        actualStart: '2026-08-03',
        actualEnd: '2026-08-10',
      },
      range,
      PX_PER_DAY,
      TODAY,
    );
    expect(segments.previsto).toEqual({ left: 16, width: 64 });
    expect(segments.real).toEqual({ left: 16, width: 64 });
    expect(segments.excesso).toBeUndefined();
  });

  it('concluída com atraso: real mais largo que previsto, excesso cobre exatamente a diferença', () => {
    const segments = computeTaskBarSegments(
      {
        plannedStart: '2026-08-03',
        plannedEnd: '2026-08-10',
        baseStart: '2026-08-03',
        baseEnd: '2026-08-10',
        actualStart: '2026-08-03',
        actualEnd: '2026-08-13',
      },
      range,
      PX_PER_DAY,
      TODAY,
    );
    expect(segments.previsto).toEqual({ left: 16, width: 64 });
    expect(segments.real).toEqual({ left: 16, width: 88 });
    expect(segments.excesso).toEqual({ left: 72, width: 32 });
  });

  it('em andamento sem actualEnd: real vai até "hoje", não até plannedEnd', () => {
    const segments = computeTaskBarSegments(
      {
        plannedStart: '2026-08-03',
        plannedEnd: '2026-08-15',
        baseStart: '2026-08-03',
        baseEnd: '2026-08-15',
        actualStart: '2026-08-05',
      },
      range,
      PX_PER_DAY,
      TODAY,
    );
    expect(segments.real).toEqual({ left: 32, width: 32 });
    expect(segments.excesso).toBeUndefined();
  });

  it('base movida: tracejada quando baseStart/baseEnd difere do previsto atual', () => {
    const segments = computeTaskBarSegments(
      {
        plannedStart: '2026-08-03',
        plannedEnd: '2026-08-10',
        baseStart: '2026-08-01',
        baseEnd: '2026-08-05',
        actualStart: '2026-08-03',
        actualEnd: '2026-08-10',
      },
      range,
      PX_PER_DAY,
      TODAY,
    );
    expect(segments.baseline).toEqual({ left: 0, width: 40, dashed: true });
  });
});

describe('barRect', () => {
  it('zoom mês (pxPerDay=3): tarefa de 1 dia usa o piso de 6px, não 3px', () => {
    const rect = barRect(range, '2026-08-10', '2026-08-10', 3);
    expect(rect.width).toBe(6);
  });

  it('zoom semana (pxPerDay=8): tarefa de 1 dia já passa do piso, usa a largura real', () => {
    const rect = barRect(range, '2026-08-10', '2026-08-10', 8);
    expect(rect.width).toBe(8);
  });

  it('zoom dia (pxPerDay=24): tarefa de 5 dias não é afetada pelo piso', () => {
    const rect = barRect(range, '2026-08-10', '2026-08-14', 24);
    expect(rect.width).toBe(120);
  });
});

describe('getDayTicks', () => {
  // 2026-08-08 é sábado, 2026-08-09 é domingo (datas conhecidas, não "um fim de semana genérico").
  const weekRange: DateRange = { start: '2026-08-03', end: '2026-08-09' };

  it('marca exatamente sábado (08) e domingo (09) como fim de semana, mais nenhum outro dia', () => {
    const ticks = getDayTicks(weekRange, '2026-08-03');
    const weekendKeys = ticks.filter((t) => t.isWeekend).map((t) => t.key);
    expect(weekendKeys).toEqual(['2026-08-08', '2026-08-09']);
  });

  it('gera 7 ticks com offsetDays sequencial de 0 a 6', () => {
    const ticks = getDayTicks(weekRange, '2026-08-03');
    expect(ticks.map((t) => t.offsetDays)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('isToday marca só o dia informado como today', () => {
    const ticks = getDayTicks(weekRange, '2026-08-08');
    const todayKeys = ticks.filter((t) => t.isToday).map((t) => t.key);
    expect(todayKeys).toEqual(['2026-08-08']);
  });
});
