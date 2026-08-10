import { supabase } from './supabaseClient';
import type { Holiday, HolidayType } from '../types';

interface HolidayRow {
  id: string;
  data: string;
  unidade: string | null;
  tipo: HolidayType;
  descricao: string | null;
}

function fromRow(row: HolidayRow): Holiday {
  return {
    id: row.id,
    date: row.data,
    unit: row.unidade ?? undefined,
    type: row.tipo,
    description: row.descricao ?? undefined,
  };
}

// Só o que não é calculável (municipal, ponto facultativo, parada de fábrica).
// Feriado nacional não vem daqui — é calculado em src/utils/dates.ts (nationalHolidays).
export async function fetchHolidays(): Promise<Holiday[]> {
  const { data, error } = await supabase.from('feriados').select('*').order('data');
  if (error) throw error;
  return (data ?? []).map(fromRow);
}
