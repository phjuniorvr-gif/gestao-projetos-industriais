import { useEffect, useState } from 'react';
import { fetchHolidays } from '../services/holidaysRepo';
import type { Holiday } from '../types';

// Feriados não-calculáveis (municipal/ponto facultativo/parada de fábrica), vindos do Supabase.
// Feriado nacional não está aqui — ver nationalHolidays() em src/utils/dates.ts.
export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    fetchHolidays()
      .then(setHolidays)
      .catch((err) => console.error('Falha ao carregar feriados do Supabase', err));
  }, []);

  return { holidays };
}
