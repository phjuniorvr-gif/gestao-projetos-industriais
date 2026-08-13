import { describe, expect, it } from 'vitest';
import { nextProjectCode } from './code';

describe('nextProjectCode', () => {
  it('sem projetos: P01', () => {
    expect(nextProjectCode([])).toBe('P01');
  });

  it('sequencial simples: maior código + 1', () => {
    expect(nextProjectCode(['P01', 'P02', 'P03'])).toBe('P04');
  });

  it('considera o MAIOR número usado, não a quantidade — cobre projeto excluído no meio', () => {
    expect(nextProjectCode(['P01', 'P05'])).toBe('P06');
  });

  it('ignora código fora do padrão P<número>', () => {
    expect(nextProjectCode(['P01', 'XYZ', 'P02'])).toBe('P03');
  });

  it('case-insensitive no prefixo P', () => {
    expect(nextProjectCode(['p07'])).toBe('P08');
  });

  it('preenche com zero à esquerda até 2 dígitos, mas não trunca números maiores', () => {
    expect(nextProjectCode(['P09'])).toBe('P10');
    expect(nextProjectCode(['P99'])).toBe('P100');
  });
});
