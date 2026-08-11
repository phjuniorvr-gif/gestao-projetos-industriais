import type { Project, Task } from '../../types';
import { addDays, diffDays, toISODate } from '../../utils';

export type GanttZoom = 'dia' | 'semana' | 'mes';

/** Pixels por dia, por zoom — explícito, não "proporcional" (Fase 4, Commit 3). `semana` mantém
 * o valor que já era hardcoded (8) antes do zoom existir, pra não mudar a escala de quem nunca
 * trocar de zoom. */
export const ZOOM_PX_PER_DAY: Record<GanttZoom, number> = {
  dia: 24,
  semana: 8,
  mes: 3,
};

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
  offsetDays: number;
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
      ticks.push({
        key: toISODate(segmentStart),
        label: `${day}/${month}`,
        offsetDays: diffDays(range.start, toISODate(segmentStart)),
        days,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return ticks;
}

export interface DayTick {
  key: string;
  label: string;
  offsetDays: number;
  /** Sábado ou domingo — sempre via `getUTCDay()` (nunca `getDay()`, que roda em fuso local e
   * sombrearia o dia errado em UTC-3: meia-noite UTC de sábado já é sexta 21h local). */
  isWeekend: boolean;
  isToday: boolean;
}

/** Um tick por dia do intervalo — usado no cabeçalho do zoom "dia" e pro sombreamento de fim de
 * semana nos zooms "dia"/"semana". `today` é injetado (nunca lido do relógio aqui), mesmo padrão
 * do resto do app (`computeTaskStatus`, etc.) — determinístico e testável. */
export function getDayTicks(range: DateRange, today: string): DayTick[] {
  const totalDays = diffDays(range.start, range.end) + 1;
  const ticks: DayTick[] = [];
  for (let i = 0; i < totalDays; i++) {
    const dateISO = addDays(range.start, i);
    const dayOfWeek = new Date(dateISO).getUTCDay();
    ticks.push({
      key: dateISO,
      label: String(new Date(dateISO).getUTCDate()).padStart(2, '0'),
      offsetDays: i,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isToday: dateISO === today,
    });
  }
  return ticks;
}

export function totalWidth(range: DateRange, pxPerDay: number): number {
  return (diffDays(range.start, range.end) + 1) * pxPerDay;
}

export function offsetPx(range: DateRange, dateISO: string, pxPerDay: number): number {
  return diffDays(range.start, dateISO) * pxPerDay;
}

export interface BarRect {
  left: number;
  width: number;
}

// Largura mínima FIXA (não derivada de pxPerDay) — no zoom mês (pxPerDay=3), uma tarefa de 1 dia
// sem piso independente vira 3px, quase invisível, e é justamente o zoom de panorama onde mais
// se olha o portfólio inteiro. Medido: 12 das 66 tarefas reais têm plannedStart===plannedEnd.
const MIN_BAR_WIDTH = 6;

export function barRect(range: DateRange, startISO: string, endISO: string, pxPerDay: number): BarRect {
  const left = offsetPx(range, startISO, pxPerDay);
  const width = Math.max(MIN_BAR_WIDTH, (diffDays(startISO, endISO) + 1) * pxPerDay);
  return { left, width };
}

export interface TaskBarSegments {
  /** Linha de base — sempre existe (baseStart/baseEnd são obrigatórios em Task desde a Fase
   * 2.5), `dashed` quando o previsto já não bate mais com ela (foi replanejado). */
  baseline: BarRect & { dashed: boolean };
  /** Barra do PREVISTO — cor por status, sempre em [plannedStart, plannedEnd], fixa (não muda
   * com o real). Pedido explícito do usuário: previsto e real ficam sempre os dois visíveis,
   * não um substituindo o outro. */
  previsto: BarRect;
  /** Barra do REAL — só existe quando `actualStart` existe. Fim: `actualEnd` quando concluiu,
   * `today` quando já começou mas não terminou ("cresce" até agora). */
  real?: BarRect;
  /** Só existe quando o fim do REAL passa do previsto — overlay hachurado sobre a cauda de
   * `real` (não de `previsto`, que é fixo e nunca "excede" a si mesmo). */
  excesso?: BarRect;
}

/**
 * Geometria da barra de TAREFA (Fase 4) — projeto/atividade usam a barra-resumo (navy + cunha +
 * preenchimento de avanço), não esta função. Previsto e real são duas barras sempre visíveis
 * (não uma substituindo a outra) — decisão do usuário no checkpoint visual, ajustando o desenho
 * original da spec/protótipo (que só desenhava previsto vs. base, sem trilha de real).
 */
export function computeTaskBarSegments(
  task: {
    plannedStart: string;
    plannedEnd: string;
    baseStart: string;
    baseEnd: string;
    actualStart?: string;
    actualEnd?: string;
  },
  range: DateRange,
  pxPerDay: number,
  today: string,
): TaskBarSegments {
  const previsto = barRect(range, task.plannedStart, task.plannedEnd, pxPerDay);
  const dashed = task.baseStart !== task.plannedStart || task.baseEnd !== task.plannedEnd;
  const baseline = { ...barRect(range, task.baseStart, task.baseEnd, pxPerDay), dashed };

  if (!task.actualStart) {
    return { baseline, previsto };
  }

  const realEnd = task.actualEnd ?? today;
  const real = barRect(range, task.actualStart, realEnd, pxPerDay);
  const excesso = realEnd > task.plannedEnd ? barRect(range, task.plannedEnd, realEnd, pxPerDay) : undefined;

  return { baseline, previsto, real, excesso };
}
