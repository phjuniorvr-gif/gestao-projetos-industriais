import { describe, expect, it } from 'vitest';
import { buildTaskActualPayload } from './projectsRepo';

// Fase 5, Commit 2 — "informar real" precisa gravar SÓ actual_start/actual_end, nunca outra
// coluna: é o que torna essa ação segura pra quem não é administrador depois do Commit 4.
describe('buildTaskActualPayload', () => {
  it('só actualStart no patch: payload tem só actual_start', () => {
    expect(buildTaskActualPayload({ actualStart: '2026-08-12' })).toEqual({ actual_start: '2026-08-12' });
  });

  it('só actualEnd no patch: payload tem só actual_end', () => {
    expect(buildTaskActualPayload({ actualEnd: '2026-08-20' })).toEqual({ actual_end: '2026-08-20' });
  });

  it('os dois no patch: payload tem os dois, nenhuma chave a mais', () => {
    expect(buildTaskActualPayload({ actualStart: '2026-08-12', actualEnd: '2026-08-20' })).toEqual({
      actual_start: '2026-08-12',
      actual_end: '2026-08-20',
    });
    expect(Object.keys(buildTaskActualPayload({ actualStart: '2026-08-12', actualEnd: '2026-08-20' }))).toEqual([
      'actual_start',
      'actual_end',
    ]);
  });

  it('valor undefined explícito (limpar a data): vira null, não some do payload', () => {
    expect(buildTaskActualPayload({ actualStart: undefined })).toEqual({ actual_start: null });
  });

  it('patch vazio: payload vazio', () => {
    expect(buildTaskActualPayload({})).toEqual({});
  });
});
