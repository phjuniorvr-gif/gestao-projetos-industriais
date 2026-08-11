// Fase 4 — lista única de colunas do painel esquerdo do Gantt. A spec avisa explicitamente pra
// não escrever a largura somada à mão (GanttTable.tsx tinha LINHA_COL_WIDTH/ESTRUTURA_COL_WIDTH/
// STATUS_COL_LEFT hardcoded, exatamente o bug descrito) — getGanttLeftWidth soma esta lista, e
// getColumnLeft deriva o `left` sticky de cada coluna a partir dela. Painel inteiro é sticky
// (não só Linha/Estrutura) — é o que o "painel esquerdo" da spec quer dizer: fica fixo enquanto
// o Gantt rola por baixo.

export type GanttColumnKey =
  | 'linha'
  | 'estrutura'
  | 'categoria'
  | 'responsavel'
  | 'inicioPrevisto'
  | 'fimPrevisto'
  | 'inicioReal'
  | 'fimReal'
  | 'duracao'
  | 'avanco';

export interface GanttColumn {
  key: GanttColumnKey;
  label: string;
  width: number;
  align?: 'right';
}

const COMPACT_COLUMNS: GanttColumn[] = [
  { key: 'linha', label: 'Linha', width: 64, align: 'right' },
  { key: 'estrutura', label: 'Estrutura', width: 520 },
  { key: 'avanco', label: 'Avanço', width: 150 },
];

// Datas em 4 colunas separadas (não intervalo único) — decisão do usuário, contra a sugestão
// original do protótipo: precisa ler início E fim previstos/reais lado a lado sem abrir a
// tarefa. Estrutura bem mais larga (520px) pelo mesmo motivo — a descrição da tarefa precisa
// caber legível, não truncar cedo demais (mesmo assim, nome muito longo ainda corta com "…" —
// texto completo sempre disponível ao abrir a tarefa). Avanço em 150px (cabe "Em andamento" +
// selo inteiro sem cortar) e Duração por extenso — pedidos explícitos do usuário.
const FULL_COLUMNS: GanttColumn[] = [
  { key: 'linha', label: 'Linha', width: 64, align: 'right' },
  { key: 'estrutura', label: 'Estrutura', width: 520 },
  { key: 'categoria', label: 'Categoria', width: 100 },
  { key: 'responsavel', label: 'Responsável', width: 110 },
  { key: 'inicioPrevisto', label: 'Início prev.', width: 96 },
  { key: 'fimPrevisto', label: 'Fim prev.', width: 96 },
  { key: 'inicioReal', label: 'Início real', width: 96 },
  { key: 'fimReal', label: 'Fim real', width: 96 },
  { key: 'duracao', label: 'Duração', width: 80, align: 'right' },
  { key: 'avanco', label: 'Avanço', width: 150 },
];

/** `fullMode` = modo completo (checkbox "Colunas"/toggle "Visão completa" já existente). */
export function getGanttColumns(fullMode: boolean): GanttColumn[] {
  return fullMode ? FULL_COLUMNS : COMPACT_COLUMNS;
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
