import { describe, expect, it } from 'vitest';
import { getColumnLeft, getColumnRect, getGanttColumns, getGanttLeftWidth } from './ganttColumns';

describe('getGanttColumns', () => {
  it('modo compacto: Linha 64 + Estrutura 480 + Avanço 150 + Status 90 = 784px', () => {
    const columns = getGanttColumns(false);
    expect(columns.map((c) => c.key)).toEqual(['linha', 'estrutura', 'avanco', 'status']);
    expect(getGanttLeftWidth(columns)).toBe(784);
  });

  it('modo completo: soma das 11 colunas (datas em 4 colunas separadas) = 1458px', () => {
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
      'status',
    ]);
    expect(getGanttLeftWidth(columns)).toBe(1458);
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
    // linha(64) + estrutura(480) + categoria(100) + responsavel(110) = 754
    expect(getColumnLeft(columns, 'inicioPrevisto')).toBe(754);
  });

  it('soma as larguras de todas as colunas anteriores', () => {
    const columns = getGanttColumns(false);
    // linha(64) + estrutura(480) = 544
    expect(getColumnLeft(columns, 'avanco')).toBe(544);
  });
});

describe('getColumnRect', () => {
  it('resolve width e left juntos', () => {
    const columns = getGanttColumns(false);
    expect(getColumnRect(columns, 'estrutura')).toEqual({ width: 480, left: 64 });
  });

  it('width 0 quando a coluna não existe no modo atual', () => {
    expect(getColumnRect(getGanttColumns(false), 'categoria')).toEqual({ width: 0, left: 784 });
  });
});
