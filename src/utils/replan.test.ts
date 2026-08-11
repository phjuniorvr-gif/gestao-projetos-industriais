import { describe, expect, it } from 'vitest';
import { buildReplanEntries, computeDateChanges, computeReplanCount, validateReplanMotivo } from './replan';

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

describe('buildReplanEntries', () => {
  const oldTask = { plannedStart: '2026-01-01', plannedEnd: '2026-01-10', baseStart: '2026-01-01', baseEnd: '2026-01-10' };
  const quando = '2026-08-11T10:00:00Z';

  it('patch vazio: 0 entradas', () => {
    expect(buildReplanEntries(oldTask, {}, 't1', 'u1', 'motivo', quando)).toEqual([]);
  });

  it('valor igual ao antigo: 0 entradas, mesmo presente no patch', () => {
    expect(buildReplanEntries(oldTask, { plannedStart: '2026-01-01' }, 't1', 'u1', 'motivo', quando)).toEqual([]);
  });

  it('1 campo de data muda: 1 entrada, com campo/campoData/de/para corretos', () => {
    const entries = buildReplanEntries(oldTask, { plannedEnd: '2026-01-15' }, 't1', 'u1', 'atraso', quando);
    expect(entries).toEqual([
      { tarefaId: 't1', quando, quemUserId: 'u1', campo: 'previsto', campoData: 'fim', de: '2026-01-10', para: '2026-01-15', motivo: 'atraso' },
    ]);
  });

  it('previsto e base mudam juntos: até 4 entradas', () => {
    const entries = buildReplanEntries(
      oldTask,
      { plannedStart: '2026-01-02', plannedEnd: '2026-01-16', baseStart: '2026-01-03', baseEnd: '2026-01-17' },
      't1',
      'u1',
      'replanejamento geral',
      quando,
    );
    expect(entries).toHaveLength(4);
    expect(entries.map((e) => `${e.campo}/${e.campoData}`).sort()).toEqual(['base/fim', 'base/inicio', 'previsto/fim', 'previsto/inicio']);
  });

  it('base ausente no oldTask (tarefa anterior à Fase 2.5, ainda não migrada): não grava "de" mentiroso', () => {
    const withoutBase = { plannedStart: '2026-01-01', plannedEnd: '2026-01-10', baseStart: undefined, baseEnd: undefined };
    const entries = buildReplanEntries(withoutBase, { baseStart: '2026-01-01' }, 't1', 'u1', 'motivo', quando);
    expect(entries).toEqual([]);
  });
});
