import { describe, expect, it } from 'vitest';
import { supabase } from '../services/supabaseClient';
import { calendarDaysBetween, easterDate, formatDuration, nationalHolidays } from './dates';

// Compara pascoa()/feriados_nacionais() (SQL, migration add_business_day_calendar) contra
// easterDate()/nationalHolidays() (TS) — é onde mora o risco de divergência entre as duas
// implementações do calendário de dias úteis (Fase 2.6). As duas funções SQL têm `execute`
// liberado pra `anon` justamente pra este teste poder rodar sem autenticar.
//
// dias_uteis/soma_dias_uteis (que leem a tabela `feriados`, protegida por RLS) ficam de fora
// deste teste automático — verificação manual via SQL até existir um usuário de teste.
const YEARS = [2026, 2027, 2028, 2030];

describe('calendário de dias úteis — SQL vs TS', () => {
  it.each(YEARS)('pascoa(%i) bate entre SQL e TS', async (year) => {
    const { data, error } = await supabase.rpc('pascoa', { ano: year });
    expect(error).toBeNull();
    expect(data).toBe(easterDate(year));
  });

  it.each(YEARS)('feriados_nacionais(%i) bate entre SQL e TS', async (year) => {
    const { data, error } = await supabase.rpc('feriados_nacionais', { ano: year });
    expect(error).toBeNull();
    const sqlDates = ((data ?? []) as { data: string }[]).map((row) => row.data).sort();
    const tsDates = nationalHolidays(year)
      .map((h) => h.date)
      .sort();
    expect(sqlDates).toEqual(tsDates);
  });
});

// Fase 7+ — pedido do usuário: coluna "Duração" (Gantt/painel de projeto) passou a mostrar dia
// CORRIDO (início a fim previsto), não mais dia útil — escopo deliberadamente estreito, só esse
// rótulo (peso/avanço ponderado continuam em dias úteis, sem mudança).
describe('calendarDaysBetween', () => {
  it('mesma data (tarefa de 1 dia): 1, não 0 — inclusiva nos dois extremos', () => {
    expect(calendarDaysBetween('2026-08-10', '2026-08-10')).toBe(1);
  });

  it('conta fim de semana e feriado — diferente de businessDaysBetween de propósito', () => {
    // 2026-08-10 (segunda) a 2026-08-17 (segunda seguinte): 8 dias corridos, incluindo o fim de
    // semana do meio — businessDaysBetween descontaria sábado/domingo, este não.
    expect(calendarDaysBetween('2026-08-10', '2026-08-17')).toBe(8);
  });
});

describe('formatDuration', () => {
  it('sufixo "d" (dia corrido), não mais "du" (dia útil)', () => {
    expect(formatDuration(10)).toBe('10d');
  });
});
