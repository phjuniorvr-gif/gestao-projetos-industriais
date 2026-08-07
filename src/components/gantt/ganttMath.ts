import type { Project, Task } from '../../types';
import { diffDays, toISODate } from '../../utils';

export const PX_PER_DAY = 8;

/** Largura reservada para os rótulos "Prev."/"Real" antes de cada trilha de barras. */
export const LABEL_COLUMN_WIDTH = 40;

export interface DateRange {
  start: string;
  end: string;
}

/** Intervalo do Gantt: do 1º dia do mês da menor data prevista ao último dia do mês da maior. */
function calculateRangeFromTasks(tasks: Task[]): DateRange {
  const today = new Date().toISOString().slice(0, 10);
  const starts = tasks.map((t) => t.plannedStart);
  const ends = tasks.map((t) => t.plannedEnd);
  const minStart = starts.length ? starts.sort()[0] : today;
  const maxEnd = ends.length ? ends.sort().at(-1)! : today;

  const s = new Date(minStart);
  const e = new Date(maxEnd);
  const rangeStart = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
  const rangeEnd = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 0));
  return { start: toISODate(rangeStart), end: toISODate(rangeEnd) };
}

export function calculateProjectRange(project: Project): DateRange {
  return calculateRangeFromTasks(project.activities.flatMap((a) => a.tasks));
}

/** Mesmo cálculo, mas cobrindo várias visões de projeto ao mesmo tempo (Cronograma de Projetos). */
export function calculatePortfolioRange(projects: Project[]): DateRange {
  return calculateRangeFromTasks(projects.flatMap((p) => p.activities.flatMap((a) => a.tasks)));
}

export interface MonthTick {
  key: string;
  label: string;
  offsetDays: number;
  days: number;
}

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function getMonthTicks(range: DateRange): MonthTick[] {
  const ticks: MonthTick[] = [];
  const end = new Date(range.end);
  const rangeStart = new Date(range.start);
  let cursor = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), 1));

  while (cursor <= end) {
    const days = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
    ticks.push({
      key: `${cursor.getUTCFullYear()}-${cursor.getUTCMonth() + 1}`,
      label: MONTH_LABELS[cursor.getUTCMonth()],
      offsetDays: diffDays(range.start, toISODate(cursor)),
      days,
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return ticks;
}

export interface YearTick {
  key: string;
  label: string;
  days: number;
}

/** Agrupa os meses do intervalo por ano, para uma linha de cabeçalho "2026 | 2027". */
export function getYearTicks(range: DateRange): YearTick[] {
  const months = getMonthTicks(range);
  const years: YearTick[] = [];
  for (const month of months) {
    const year = month.key.split('-')[0];
    const last = years.at(-1);
    if (last && last.key === year) {
      last.days += month.days;
    } else {
      years.push({ key: year, label: year, days: month.days });
    }
  }
  return years;
}

export interface WeekTick {
  key: string;
  label: string;
  days: number;
}

/** Divisão semanal (início na segunda-feira) usada como subgrade abaixo dos meses. */
export function getWeekTicks(range: DateRange): WeekTick[] {
  const ticks: WeekTick[] = [];
  const rangeStart = new Date(range.start);
  const rangeEnd = new Date(range.end);

  const dayOfWeek = rangeStart.getUTCDay();
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const cursor = new Date(rangeStart);
  cursor.setUTCDate(cursor.getUTCDate() + offsetToMonday);

  while (cursor <= rangeEnd) {
    const weekEnd = new Date(cursor);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    const segmentStart = cursor < rangeStart ? rangeStart : cursor;
    const segmentEnd = weekEnd > rangeEnd ? rangeEnd : weekEnd;
    const days = diffDays(toISODate(segmentStart), toISODate(segmentEnd)) + 1;
    if (days > 0) {
      const day = String(cursor.getUTCDate()).padStart(2, '0');
      const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
      ticks.push({ key: toISODate(segmentStart), label: `${day}/${month}`, days });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return ticks;
}

export function totalWidth(range: DateRange): number {
  return (diffDays(range.start, range.end) + 1) * PX_PER_DAY;
}

export function offsetPx(range: DateRange, dateISO: string): number {
  return diffDays(range.start, dateISO) * PX_PER_DAY;
}

export function barRect(range: DateRange, startISO: string, endISO: string) {
  const left = offsetPx(range, startISO);
  const width = Math.max(PX_PER_DAY, (diffDays(startISO, endISO) + 1) * PX_PER_DAY);
  return { left, width };
}
