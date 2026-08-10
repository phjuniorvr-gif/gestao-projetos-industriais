import { describe, expect, it } from 'vitest';
import { supabase } from '../services/supabaseClient';
import { easterDate, nationalHolidays } from './dates';

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
