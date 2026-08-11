import { describe, expect, it } from 'vitest';
import { computeTaskBarSegments, type DateRange } from './ganttMath';

// PX_PER_DAY = 8. Range fixo (agosto/2026 inteiro) pra todo teste — offsetPx/width em pixel
// literal, não descrição ("mais larga", "desloca pra direita").
const range: DateRange = { start: '2026-08-01', end: '2026-08-31' };
const TODAY = '2026-08-08';

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
      TODAY,
    );
    expect(segments.baseline).toEqual({ left: 0, width: 40, dashed: true });
  });
});
