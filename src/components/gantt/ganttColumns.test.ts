import { describe, expect, it } from 'vitest';
import { getColumnLeft, getColumnRect, getGanttColumns, getGanttLeftWidth } from './ganttColumns';

describe('getGanttColumns', () => {
  it('modo compacto: Linha 64 + Estrutura 520 + Avanço 150 = 734px', () => {
    const columns = getGanttColumns(false);
    expect(columns.map((c) => c.key)).toEqual(['linha', 'estrutura', 'avanco']);
    expect(getGanttLeftWidth(columns)).toBe(734);
  });

  it('modo completo: soma das 10 colunas (datas em 4 colunas separadas) = 1408px', () => {
    const columns = getGanttColumns(true);
    expect(columns.map((c) => c.key)).toEqual([
      'linha',
      'estrutura',
      'categoria',
      'responsavel',
      'inicioPrevisto',
      'fimPrevisto',
      'inicioReal',
      'fimReal',
      'duracao',
      'avanco',
    ]);
    expect(getGanttLeftWidth(columns)).toBe(1408);
  });
});

describe('getGanttLeftWidth', () => {
  it('soma genérica — não depende das colunas reais do Gantt', () => {
    expect(getGanttLeftWidth([{ key: 'linha', label: 'x', width: 10 }, { key: 'estrutura', label: 'y', width: 25 }])).toBe(
      35,
    );
    expect(getGanttLeftWidth([])).toBe(0);
  });
});

describe('getColumnLeft', () => {
  it('primeira coluna começa em 0', () => {
    expect(getColumnLeft(getGanttColumns(false), 'linha')).toBe(0);
  });

  it('acumula a largura das colunas anteriores', () => {
    const columns = getGanttColumns(true);
    // linha(64) + estrutura(520) + categoria(100) + responsavel(110) = 794
    expect(getColumnLeft(columns, 'inicioPrevisto')).toBe(794);
  });

  it('última coluna soma tudo antes dela', () => {
    const columns = getGanttColumns(false);
    // linha(64) + estrutura(520) = 584
    expect(getColumnLeft(columns, 'avanco')).toBe(584);
  });
});

describe('getColumnRect', () => {
  it('resolve width e left juntos', () => {
    const columns = getGanttColumns(false);
    expect(getColumnRect(columns, 'estrutura')).toEqual({ width: 520, left: 64 });
  });

  it('width 0 quando a coluna não existe no modo atual', () => {
    expect(getColumnRect(getGanttColumns(false), 'categoria')).toEqual({ width: 0, left: 734 });
  });
});
