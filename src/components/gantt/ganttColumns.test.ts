import { describe, expect, it } from 'vitest';
import { getColumnLeft, getColumnRect, getGanttColumns, getGanttLeftWidth } from './ganttColumns';

describe('getGanttColumns', () => {
  it('modo compacto: Linha 64 + Estrutura 480 + Avanço 150 + Status 90 = 784px', () => {
    const columns = getGanttColumns('compact');
    expect(columns.map((c) => c.key)).toEqual(['linha', 'estrutura', 'avanco', 'status']);
    expect(getGanttLeftWidth(columns)).toBe(784);
  });

  it('modo completo: soma das 11 colunas (datas em 4 colunas separadas, sem Categoria, com Observação) = 1678px', () => {
    const columns = getGanttColumns('full');
    expect(columns.map((c) => c.key)).toEqual([
      'linha',
      'estrutura',
      'responsavel',
      'inicioPrevisto',
      'fimPrevisto',
      'inicioReal',
      'fimReal',
      'duracao',
      'avanco',
      'status',
      'observacao',
    ]);
    // Estrutura (580) absorveu os 100px que a coluna Categoria usava antes de ser removida a
    // pedido do usuário; Observação (220) foi acrescentada no fim — soma total 1678.
    expect(getGanttLeftWidth(columns)).toBe(1678);
  });

  it('modo importação: sem Responsável nem Duração, com Processo+Projeto (logo após Estrutura) e Observação no fim = 1688px', () => {
    const columns = getGanttColumns('importacao');
    expect(columns.map((c) => c.key)).toEqual([
      'linha',
      'estrutura',
      'processo',
      'projeto',
      'inicioPrevisto',
      'fimPrevisto',
      'inicioReal',
      'fimReal',
      'avanco',
      'status',
      'observacao',
    ]);
    expect(getGanttLeftWidth(columns)).toBe(1688);
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
    expect(getColumnLeft(getGanttColumns('compact'), 'linha')).toBe(0);
  });

  it('acumula a largura das colunas anteriores', () => {
    const columns = getGanttColumns('full');
    // linha(64) + estrutura(580) + responsavel(110) = 754
    expect(getColumnLeft(columns, 'inicioPrevisto')).toBe(754);
  });

  it('soma as larguras de todas as colunas anteriores', () => {
    const columns = getGanttColumns('compact');
    // linha(64) + estrutura(480) = 544
    expect(getColumnLeft(columns, 'avanco')).toBe(544);
  });
});

describe('getColumnRect', () => {
  it('resolve width e left juntos', () => {
    const columns = getGanttColumns('compact');
    expect(getColumnRect(columns, 'estrutura')).toEqual({ width: 480, left: 64 });
  });

  it('width 0 quando a coluna não existe no modo atual', () => {
    expect(getColumnRect(getGanttColumns('compact'), 'responsavel')).toEqual({ width: 0, left: 784 });
  });
});
