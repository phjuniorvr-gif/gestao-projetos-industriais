import { useEffect, useState, type CSSProperties } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Person, TaskView } from '../../types';
import { calendarDaysBetween, formatDatePtBr, formatDuration } from '../../utils';
import { StatusBadge } from '../shared/StatusBadge';
import { StatusEmoji } from '../shared/StatusEmoji';
import { Input } from '../ui';
import { getColumnRect, type GanttColumn } from './ganttColumns';
import { totalWidth, type DateRange } from './ganttMath';
import { GanttBars } from './GanttBars';
import { LabelColumn } from './LabelColumn';
import { RowTypeBadge } from './RowTypeBadge';
import { TodayLine } from './TodayLine';

interface GanttRowProps {
  task: TaskView;
  /** Código do projeto dono da tarefa (aba Importação, coluna "Projeto") — zero-width fora do
   * conjunto `IMPORTACAO_COLUMNS`, então sempre repassado sem custo pras outras telas. */
  projectCode: string;
  /** "Processo" da atividade dona da tarefa (aba Importação, coluna "Processo") — mesmo
   * raciocínio de `projectCode`: texto livre preenchido só na criação da atividade, sem edição
   * aqui; zero-width fora de `IMPORTACAO_COLUMNS`. */
  activityProcesso?: string;
  range: DateRange;
  pxPerDay: number;
  timelineBackground: CSSProperties;
  people: Person[];
  columns: GanttColumn[];
  compact: boolean;
  /** "Visão completa" sem Gantt (a pedido do usuário) — quando falso, não desenha a célula de
   * barras/timeline desta linha. Independente de `compact` (que só decide quantas colunas
   * aparecem); ver comentário equivalente em `GanttTable.tsx`. */
  showGantt: boolean;
  /** Preenchimento depois da última data — quando o intervalo (mais o zoom) renderiza uma
   * timeline mais estreita que o card, evita um vão em branco à direita. Medido em
   * `GanttTable.tsx` via `ResizeObserver`; 0 quando a timeline já cobre (ou excede) a largura
   * disponível, caso em que a tabela simplesmente rola horizontalmente como sempre. */
  ganttFillerWidth: number;
  /** Ver `BarLabel.tsx` — repassado direto pra `GanttBars`. */
  leftWidth: number;
  onClick: () => void;
  onHover: (task: TaskView, x: number, y: number) => void;
  onHoverEnd: () => void;
  /** Observação (pedido do usuário, aba Importação) — edição inline, sem `disabled`: igual
   * Início/Fim real, editável por qualquer papel (o trigger no banco já decide quem pode). */
  onChangeObservacao: (taskId: string, observacao: string) => void;
}

const cellClass = 'h-[34px] overflow-hidden truncate px-2 py-0 text-center align-middle text-xs text-text-muted';

export function GanttRow({
  task,
  projectCode,
  activityProcesso,
  range,
  pxPerDay,
  timelineBackground,
  people,
  columns,
  compact,
  showGantt,
  ganttFillerWidth,
  leftWidth,
  onClick,
  onHover,
  onHoverEnd,
  onChangeObservacao,
}: GanttRowProps) {
  const width = totalWidth(range, pxPerDay);
  const responsavel = people.find((p) => p.id === task.responsavelId);
  const estrutura = getColumnRect(columns, 'estrutura');
  const avanco = getColumnRect(columns, 'avanco');
  const statusCol = getColumnRect(columns, 'status');
  // Rascunho local — sincronizado por `task.id` (não por `task.observacao`), mesmo cuidado que os
  // campos de data em `TaskPanel.tsx` já tomam: um re-render por outro motivo (ex.: outra pessoa
  // editando outro campo) não deve apagar o que a pessoa está digitando nesta célula.
  const [draftObservacao, setDraftObservacao] = useState(task.observacao ?? '');
  useEffect(() => {
    setDraftObservacao(task.observacao ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ressincroniza quando a LINHA muda
  }, [task.id]);

  return (
    <tr className="border-b border-border/70 bg-card hover:bg-page/60">
      <td
        className="sticky z-25 h-[34px] truncate bg-card px-2 py-0 text-center align-middle text-xs text-text-muted"
        style={{ left: getColumnRect(columns, 'linha').left, width: getColumnRect(columns, 'linha').width }}
      >
        {task.rowNumber}
      </td>
      <td
        className={`sticky z-25 h-[34px] overflow-hidden bg-card py-0 pl-14 pr-4 align-middle ${compact ? '' : 'border-r border-border'}`}
        style={{ left: estrutura.left, width: estrutura.width }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <RowTypeBadge type="task" />
          <button
            type="button"
            onClick={onClick}
            className="min-w-0 flex-1 text-left text-sm text-text hover:text-action hover:underline"
          >
            {/* Sempre trunca (não só compact) — nome sem limite quebrava em 2 linhas no modo
                completo, esticando a linha além dos 34px. Nome inteiro sempre disponível ao abrir
                a tarefa. */}
            <span className="block truncate">{task.name}</span>
          </button>
          {!!task.replanCount && (
            <span
              title={`Previsto replanejado ${task.replanCount} ${task.replanCount === 1 ? 'vez' : 'vezes'}`}
              className="inline-flex shrink-0 items-center rounded-full bg-action/10 px-2 py-0.5 text-[10px] font-semibold text-action"
            >
              R{task.replanCount}
            </span>
          )}
          {task.hasDependencyViolation && (
            <span title="Previsto em conflito com a regra de alguma dependência">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-delayed" aria-hidden="true" />
            </span>
          )}
        </div>
      </td>
      {!compact && (
        <>
          {columns.some((c) => c.key === 'processo') && (
            <td className={cellClass} style={{ width: getColumnRect(columns, 'processo').width }}>
              {activityProcesso ?? '—'}
            </td>
          )}
          {/* "Projeto"/"Responsável" nunca coexistem no mesmo conjunto de colunas (`IMPORTACAO_COLUMNS`
              troca um pelo outro) — só uma das duas células deve existir aqui, senão o corpo da
              tabela fica com uma célula a mais que o cabeçalho e desalinha tudo depois dela. */}
          {columns.some((c) => c.key === 'projeto') ? (
            <td className={cellClass} style={{ width: getColumnRect(columns, 'projeto').width }}>
              {projectCode}
            </td>
          ) : (
            <td className={cellClass} style={{ width: getColumnRect(columns, 'responsavel').width }}>
              {responsavel?.name ?? '—'}
            </td>
          )}
          <td className={cellClass} style={{ width: getColumnRect(columns, 'inicioPrevisto').width }}>
            {formatDatePtBr(task.plannedStart)}
          </td>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'fimPrevisto').width }}>
            {formatDatePtBr(task.plannedEnd)}
          </td>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'inicioReal').width }}>
            {formatDatePtBr(task.actualStart)}
          </td>
          <td className={cellClass} style={{ width: getColumnRect(columns, 'fimReal').width }}>
            {formatDatePtBr(task.actualEnd)}
          </td>
          {columns.some((c) => c.key === 'duracao') && (
            <td className={cellClass} style={{ width: getColumnRect(columns, 'duracao').width }}>
              {formatDuration(calendarDaysBetween(task.plannedStart, task.plannedEnd))}
            </td>
          )}
        </>
      )}
      <td
        className={`h-[34px] overflow-hidden whitespace-nowrap px-2 py-0 text-center align-middle ${
          compact ? 'sticky z-25 bg-card' : ''
        }`}
        style={compact ? { left: avanco.left, width: avanco.width } : { width: avanco.width }}
      >
        <StatusBadge
          status={task.status}
          blocked={task.isBlocked}
          startDelayed={task.isStartDelayed}
          lateCompletion={task.isLateCompletion}
          lateCompletionDays={task.lateCompletionDays}
          pendingConfirmation={task.pendingConfirmation}
          rejected={task.rejected}
        />
      </td>
      <td
        className={`h-[34px] overflow-hidden px-2 py-0 align-middle border-r border-border ${
          compact ? 'sticky z-25 bg-card' : ''
        }`}
        style={compact ? { left: statusCol.left, width: statusCol.width } : { width: statusCol.width }}
      >
        <div className="flex items-center justify-center">
          <StatusEmoji status={task.status} />
        </div>
      </td>
      <td className="h-[34px] overflow-hidden px-1 py-0 align-middle" style={{ width: getColumnRect(columns, 'observacao').width }}>
        {getColumnRect(columns, 'observacao').width > 0 && (
          <Input
            value={draftObservacao}
            onChange={(e) => setDraftObservacao(e.target.value)}
            onBlur={() => {
              if (draftObservacao !== (task.observacao ?? '')) onChangeObservacao(task.id, draftObservacao);
            }}
            placeholder="Observação"
            className="h-7 w-full border-transparent bg-transparent px-1.5 py-0 text-xs focus:border-action focus:bg-white"
          />
        )}
      </td>
      {showGantt && (
        <>
          <LabelColumn left={leftWidth} showReal={Boolean(task.actualStart)} realTop={16} />
          <td
            className="relative h-[34px] px-4 py-0 align-middle"
            style={{ width, ...timelineBackground }}
            onMouseMove={(e) => onHover(task, e.clientX, e.clientY)}
            onMouseLeave={onHoverEnd}
          >
            <TodayLine range={range} pxPerDay={pxPerDay} />
            <GanttBars
              range={range}
              pxPerDay={pxPerDay}
              status={task.status}
              plannedStart={task.plannedStart}
              plannedEnd={task.plannedEnd}
              baseStart={task.baseStart}
              baseEnd={task.baseEnd}
              actualStart={task.actualStart}
              actualEnd={task.actualEnd}
            />
          </td>
          <td className="h-[34px]" style={{ width: ganttFillerWidth }} />
        </>
      )}
    </tr>
  );
}
