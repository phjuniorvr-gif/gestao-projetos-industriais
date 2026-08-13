import { describe, expect, it } from 'vitest';
import { computeDateChanges, computeReplanCount, validateDateOrder, validateReplanMotivo } from './replan';

describe('computeReplanCount', () => {
  it('log vazio: 0', () => {
    expect(computeReplanCount('t1', [])).toBe(0);
  });

  it('conta só campo=previsto, ignora campo=base da mesma tarefa', () => {
    const log = [
      { tarefaId: 't1', campo: 'previsto' as const },
      { tarefaId: 't1', campo: 'base' as const },
      { tarefaId: 't1', campo: 'previsto' as const },
    ];
    expect(computeReplanCount('t1', log)).toBe(2);
  });

  it('ignora entradas de outra tarefa', () => {
    const log = [
      { tarefaId: 't1', campo: 'previsto' as const },
      { tarefaId: 't2', campo: 'previsto' as const },
    ];
    expect(computeReplanCount('t1', log)).toBe(1);
  });
});

describe('computeDateChanges', () => {
  const oldTask = { plannedStart: '2026-01-01', plannedEnd: '2026-01-10', baseStart: '2026-01-01', baseEnd: '2026-01-10' };

  it('patch vazio: nada mudou', () => {
    expect(computeDateChanges(oldTask, {})).toEqual({ previstoChanged: false, baseChanged: false });
  });

  it('valor do patch igual ao antigo: não conta como mudança (onBlur sem edição real)', () => {
    expect(computeDateChanges(oldTask, { plannedStart: '2026-01-01' })).toEqual({
      previstoChanged: false,
      baseChanged: false,
    });
  });

  it('plannedStart OU plannedEnd diferente: previstoChanged true', () => {
    expect(computeDateChanges(oldTask, { plannedStart: '2026-01-02' }).previstoChanged).toBe(true);
    expect(computeDateChanges(oldTask, { plannedEnd: '2026-01-11' }).previstoChanged).toBe(true);
  });

  it('baseStart OU baseEnd diferente: baseChanged true', () => {
    expect(computeDateChanges(oldTask, { baseStart: '2026-01-02' }).baseChanged).toBe(true);
    expect(computeDateChanges(oldTask, { baseEnd: '2026-01-11' }).baseChanged).toBe(true);
  });
});

describe('validateReplanMotivo', () => {
  it('mudou e motivo vazio: inválido', () => {
    const result = validateReplanMotivo({ previstoChanged: true, baseChanged: false }, '');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('mudou e motivo só espaço: inválido', () => {
    expect(validateReplanMotivo({ previstoChanged: false, baseChanged: true }, '   ').valid).toBe(false);
  });

  it('mudou e motivo preenchido: válido', () => {
    expect(validateReplanMotivo({ previstoChanged: true, baseChanged: false }, 'atraso do fornecedor').valid).toBe(true);
  });

  it('nada mudou: válido mesmo sem motivo', () => {
    expect(validateReplanMotivo({ previstoChanged: false, baseChanged: false }, '').valid).toBe(true);
  });
});

describe('validateDateOrder', () => {
  it('fim antes do início: inválido', () => {
    const result = validateDateOrder('2026-01-10', '2026-01-05');
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('fim igual ao início: válido (tarefa de 1 dia)', () => {
    expect(validateDateOrder('2026-01-10', '2026-01-10').valid).toBe(true);
  });

  it('fim depois do início: válido', () => {
    expect(validateDateOrder('2026-01-01', '2026-01-10').valid).toBe(true);
  });

  it('início ou fim vazio: válido (nada a comparar ainda)', () => {
    expect(validateDateOrder('', '2026-01-10').valid).toBe(true);
    expect(validateDateOrder('2026-01-10', '').valid).toBe(true);
  });
});
