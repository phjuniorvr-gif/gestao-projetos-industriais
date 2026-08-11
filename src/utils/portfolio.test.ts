import { describe, expect, it } from 'vitest';
import {
  computeActiveFilterCount,
  computeScheduleDeviationDays,
  computeStatusDistribution,
  computeWorstDeviation,
} from './portfolio';
import { EMPTY_FILTERS } from '../components/projects/ProjectFilters';

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
