// Fase 4 — lista única de colunas do painel esquerdo do Gantt. A spec avisa explicitamente pra
// não escrever a largura somada à mão (GanttTable.tsx tinha LINHA_COL_WIDTH/ESTRUTURA_COL_WIDTH/
// STATUS_COL_LEFT hardcoded, exatamente o bug descrito) — getGanttLeftWidth soma esta lista, e
// getColumnLeft deriva o `left` sticky de cada coluna a partir dela. Painel inteiro é sticky
// (não só Linha/Estrutura) — é o que o "painel esquerdo" da spec quer dizer: fica fixo enquanto
// o Gantt rola por baixo.

export type GanttColumnKey =
  | 'linha'
  | 'estrutura'
  | 'processo'
  | 'projeto'
  | 'responsavel'
  | 'inicioPrevisto'
  | 'fimPrevisto'
  | 'inicioReal'
  | 'fimReal'
  | 'duracao'
  | 'avanco'
  | 'status'
  | 'observacao';

export interface GanttColumn {
  key: GanttColumnKey;
  label: string;
  width: number;
  align?: 'right';
}

const COMPACT_COLUMNS: GanttColumn[] = [
  { key: 'linha', label: 'Linha', width: 64, align: 'right' },
  { key: 'estrutura', label: 'Estrutura', width: 480 },
  { key: 'avanco', label: 'Avanço', width: 150 },
  { key: 'status', label: 'Status', width: 90 },
];

// Datas em 4 colunas separadas (não intervalo único) — decisão do usuário, contra a sugestão
// original do protótipo: precisa ler início E fim previstos/reais lado a lado sem abrir a
// tarefa. Estrutura mais larga (580px — 480 + os 100px que a coluna Categoria usava antes de ser
// removida a pedido do usuário) pelo mesmo motivo — a descrição da tarefa precisa caber legível,
// não truncar cedo demais (mesmo assim, nome muito longo ainda corta com "…" — texto completo
// sempre disponível ao abrir a tarefa). Avanço em 150px (cabe "Em andamento" + selo inteiro sem
// cortar) e Duração por extenso — pedidos explícitos do usuário.
const FULL_COLUMNS: GanttColumn[] = [
  { key: 'linha', label: 'Linha', width: 64, align: 'right' },
  { key: 'estrutura', label: 'Estrutura', width: 580 },
  { key: 'responsavel', label: 'Responsável', width: 110 },
  { key: 'inicioPrevisto', label: 'Início prev.', width: 96 },
  { key: 'fimPrevisto', label: 'Fim prev.', width: 96 },
  { key: 'inicioReal', label: 'Início real', width: 96 },
  { key: 'fimReal', label: 'Fim real', width: 96 },
  { key: 'duracao', label: 'Duração', width: 80, align: 'right' },
  { key: 'avanco', label: 'Avanço', width: 150 },
  { key: 'status', label: 'Status', width: 90 },
  { key: 'observacao', label: 'Observação', width: 220 },
];

// Aba Importação (pedido do usuário) — sem Responsável (não importa pro comprador) nem Duração
// (pedido seguinte), com "Processo" (texto livre da atividade, preenchido só na criação — pedido
// seguinte) logo antes de "Projeto" (código curto, ex. "P59"), já que a linha do Projeto em si
// fica escondida nessa visão (GanttTable.tsx, prop `hideProjectRow`).
const IMPORTACAO_COLUMNS: GanttColumn[] = [
  { key: 'linha', label: 'Linha', width: 64, align: 'right' },
  { key: 'estrutura', label: 'Estrutura', width: 580 },
  { key: 'processo', label: 'Processo', width: 130 },
  { key: 'projeto', label: 'Projeto', width: 70 },
  { key: 'inicioPrevisto', label: 'Início prev.', width: 96 },
  { key: 'fimPrevisto', label: 'Fim prev.', width: 96 },
  { key: 'inicioReal', label: 'Início real', width: 96 },
  { key: 'fimReal', label: 'Fim real', width: 96 },
  { key: 'avanco', label: 'Avanço', width: 150 },
  { key: 'status', label: 'Status', width: 90 },
  { key: 'observacao', label: 'Observação', width: 220 },
];

export function getGanttColumns(mode: 'compact' | 'full' | 'importacao'): GanttColumn[] {
  if (mode === 'compact') return COMPACT_COLUMNS;
  if (mode === 'importacao') return IMPORTACAO_COLUMNS;
  return FULL_COLUMNS;
}

export function getGanttLeftWidth(columns: GanttColumn[]): number {
  return columns.reduce((sum, c) => sum + c.width, 0);
}

/** `left` (px) pra fixar a coluna `key` como sticky — soma as larguras de todas as colunas
 * anteriores a ela na lista. Retorna 0 se a coluna não existir na lista (não deveria acontecer). */
export function getColumnLeft(columns: GanttColumn[], key: GanttColumnKey): number {
  let left = 0;
  for (const column of columns) {
    if (column.key === key) return left;
    left += column.width;
  }
  return left;
}

/** Atalho pra quem monta uma célula: largura + left já resolvidos pra uma coluna. Retorna
 * width 0 se a coluna não fizer parte do modo atual (célula não deve ser renderizada). */
export function getColumnRect(columns: GanttColumn[], key: GanttColumnKey): { width: number; left: number } {
  const column = columns.find((c) => c.key === key);
  return { width: column?.width ?? 0, left: getColumnLeft(columns, key) };
}
