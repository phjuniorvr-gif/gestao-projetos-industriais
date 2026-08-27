// new Date().toISOString() é UTC — às 21h em São Paulo já é meia-noite UTC do dia seguinte,
// então "hoje" reportaria amanhã. Usa o fuso de São Paulo explicitamente; formatToParts em vez
// de confiar que 'en-CA' sempre formata como AAAA-MM-DD (padrão observado, não garantia formal).
export function todayISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateISO: string, days: number): string {
  const date = new Date(dateISO);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

export function diffDays(startISO: string, endISO: string): number {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

export function formatDatePtBr(dateISO?: string): string {
  if (!dateISO) return '—';
  const [year, month, day] = dateISO.split('-');
  return `${day}/${month}/${year}`;
}

export function formatPeriod(startISO?: string, endISO?: string): string {
  if (!startISO && !endISO) return '—';
  return `${formatDatePtBr(startISO)} até ${formatDatePtBr(endISO)}`;
}

// ============================================================
// Calendário de dias úteis (Fase 2.6).
// Espelha as funções SQL pascoa/feriados_nacionais/dias_uteis/soma_dias_uteis
// (migration add_business_day_calendar) para não depender de round-trip ao banco
// a cada recálculo local. Se mudar a lista de feriados fixos/móveis aqui,
// muda também na migration — src/utils/dates.test.ts compara os dois.
// ============================================================

interface HolidayLike {
  date: string;
  unit?: string;
}

/** Data da Páscoa no ano informado (algoritmo de Meeus/Jones/Butcher). */
export function easterDate(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = b - d - Math.floor((b - f + 1) / 3);
  const h = (19 * a + g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const numerator = h + l - 7 * m + 114;
  const month = Math.floor(numerator / 31);
  const day = (numerator % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 9 feriados fixos + 3 móveis (derivados de easterDate) — mesma lista da função SQL feriados_nacionais. */
export function nationalHolidays(year: number): { date: string; description: string }[] {
  const easter = easterDate(year);
  return [
    { date: `${year}-01-01`, description: 'Confraternização Universal' },
    { date: `${year}-04-21`, description: 'Tiradentes' },
    { date: `${year}-05-01`, description: 'Dia do Trabalho' },
    { date: `${year}-09-07`, description: 'Independência do Brasil' },
    { date: `${year}-10-12`, description: 'Nossa Senhora Aparecida' },
    { date: `${year}-11-02`, description: 'Finados' },
    { date: `${year}-11-15`, description: 'Proclamação da República' },
    { date: `${year}-11-20`, description: 'Consciência Negra' },
    { date: `${year}-12-25`, description: 'Natal' },
    { date: addDays(easter, -47), description: 'Carnaval' },
    { date: addDays(easter, -2), description: 'Sexta-feira Santa' },
    { date: addDays(easter, 60), description: 'Corpus Christi' },
  ];
}

function isHoliday(dateISO: string, holidays: HolidayLike[], unit?: string): boolean {
  const year = Number(dateISO.slice(0, 4));
  if (nationalHolidays(year).some((h) => h.date === dateISO)) return true;
  return holidays.some((h) => h.date === dateISO && (h.unit === undefined || h.unit === unit));
}

/** Dia útil = não é fim de semana nem feriado (nacional calculado + feriados da tabela). */
export function isBusinessDay(dateISO: string, holidays: HolidayLike[] = [], unit?: string): boolean {
  const dayOfWeek = new Date(dateISO).getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  return !isHoliday(dateISO, holidays, unit);
}

/** Dias úteis entre start e end inclusive. Equivalente à função SQL dias_uteis. */
export function businessDaysBetween(
  startISO: string,
  endISO: string,
  holidays: HolidayLike[] = [],
  unit?: string,
): number {
  let count = 0;
  let current = startISO;
  while (current <= endISO) {
    if (isBusinessDay(current, holidays, unit)) count++;
    current = addDays(current, 1);
  }
  return count;
}

/** Soma (ou subtrai, se n negativo) n dias úteis a partir de dateISO. Equivalente a soma_dias_uteis. */
export function addBusinessDays(dateISO: string, n: number, holidays: HolidayLike[] = [], unit?: string): string {
  if (n === 0) {
    let current = dateISO;
    while (!isBusinessDay(current, holidays, unit)) current = addDays(current, 1);
    return current;
  }
  let current = dateISO;
  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    current = addDays(current, step);
    if (isBusinessDay(current, holidays, unit)) remaining--;
  }
  return current;
}

/** Dias CORRIDOS entre start e end, inclusive (mesma convenção de `businessDaysBetween`, mas sem
 * descontar fim de semana/feriado) — Fase 7+, pedido do usuário: a coluna "Duração" (Gantt/painel
 * de projeto) passou a mostrar dia corrido, não mais dia útil. Escopo deliberadamente estreito:
 * peso de tarefa/avanço ponderado (Fase 2.2, `taskWeight`/`computeProgress`) e o cálculo de fim
 * previsto a partir de duração (wizard/`AddTaskPanel`, `computeDatesFromDuration`) continuam em
 * dias úteis — o pedido foi só sobre o rótulo de duração exibido. */
export function calendarDaysBetween(startISO: string, endISO: string): number {
  return diffDays(startISO, endISO) + 1;
}

/** Exibe duração em dias corridos com o sufixo "d" (ex.: "10d") — ver `calendarDaysBetween`. */
export function formatDuration(days: number): string {
  return `${days}d`;
}
