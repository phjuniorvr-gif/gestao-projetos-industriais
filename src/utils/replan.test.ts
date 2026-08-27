import { describe, expect, it } from 'vitest';
import { computeDateChanges, computeReplanCount, resolveActualDatesPatch, validateDateOrder, validateReplanMotivo } from './replan';

describe('computeReplanCount', () => {
  it('log vazio: 0', () => {
    expect(computeReplanCount('t1', [])).toBe(0);
  });

  it('conta só campo=previsto, ignora campo=base da mesma tarefa', () => {
    const log = [
      { tarefaId: 't1', campo: 'previsto' as const, porAdministrador: false },
      { tarefaId: 't1', campo: 'base' as const, porAdministrador: false },
      { tarefaId: 't1', campo: 'previsto' as const, porAdministrador: false },
    ];
    expect(computeReplanCount('t1', log)).toBe(2);
  });

  it('ignora entradas de outra tarefa', () => {
    const log = [
      { tarefaId: 't1', campo: 'previsto' as const, porAdministrador: false },
      { tarefaId: 't2', campo: 'previsto' as const, porAdministrador: false },
    ];
    expect(computeReplanCount('t1', log)).toBe(1);
  });

  it('ignora entradas feitas pelo administrador', () => {
    const log = [
      { tarefaId: 't1', campo: 'previsto' as const, porAdministrador: true },
      { tarefaId: 't1', campo: 'previsto' as const, porAdministrador: false },
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
  it('mudou e motivo vazio, não-admin: inválido', () => {
    const result = validateReplanMotivo({ previstoChanged: true, baseChanged: false }, '', false);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it('mudou e motivo só espaço, não-admin: inválido', () => {
    expect(validateReplanMotivo({ previstoChanged: false, baseChanged: true }, '   ', false).valid).toBe(false);
  });

  it('mudou e motivo preenchido: válido', () => {
    expect(validateReplanMotivo({ previstoChanged: true, baseChanged: false }, 'atraso do fornecedor', false).valid).toBe(
      true,
    );
  });

  it('nada mudou: válido mesmo sem motivo', () => {
    expect(validateReplanMotivo({ previstoChanged: false, baseChanged: false }, '', false).valid).toBe(true);
  });

  it('mudou e motivo vazio, administrador: válido (motivo é opcional pra admin)', () => {
    expect(validateReplanMotivo({ previstoChanged: true, baseChanged: false }, '', true).valid).toBe(true);
    expect(validateReplanMotivo({ previstoChanged: false, baseChanged: true }, '   ', true).valid).toBe(true);
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

// Fase 7+ — a RPC informar_data_real sempre recebe o par completo (start+end): é aqui, no
// cliente, que "chave não veio no patch" (mantém o valor atual) se distingue de "chave veio
// undefined" (limpa o campo).
describe('resolveActualDatesPatch', () => {
  const current = { actualStart: '2026-08-12', actualEnd: '2026-08-20' };

  it('só actualStart no patch: actualEnd mantém o valor atual', () => {
    expect(resolveActualDatesPatch(current, { actualStart: '2026-08-13' })).toEqual({
      actualStart: '2026-08-13',
      actualEnd: '2026-08-20',
    });
  });

  it('só actualEnd no patch: actualStart mantém o valor atual', () => {
    expect(resolveActualDatesPatch(current, { actualEnd: '2026-08-21' })).toEqual({
      actualStart: '2026-08-12',
      actualEnd: '2026-08-21',
    });
  });

  it('patch vazio: os dois mantêm o valor atual', () => {
    expect(resolveActualDatesPatch(current, {})).toEqual(current);
  });

  it('chave presente com undefined explícito: limpa o campo (não mantém o valor atual)', () => {
    expect(resolveActualDatesPatch(current, { actualStart: undefined })).toEqual({
      actualStart: undefined,
      actualEnd: '2026-08-20',
    });
  });

  it('tarefa sem nenhuma data real ainda (current vazio): patch parcial não inventa a outra', () => {
    expect(resolveActualDatesPatch({}, { actualStart: '2026-08-12' })).toEqual({
      actualStart: '2026-08-12',
      actualEnd: undefined,
    });
  });
});
