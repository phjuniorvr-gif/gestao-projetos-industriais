export function todayISO(): string {
  return toISODate(new Date());
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
