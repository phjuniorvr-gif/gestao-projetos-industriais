import type { DependencyType } from '../../types';
import { offsetPx, type DateRange } from './ganttMath';

// Fase 4, Commit 4 — geometria das setas de dependência. Reaproveita `computeDependencyRuleDate`/
// `computeTaskDependencyViolated`/`isDependencyEdgeViolated` (Fase 2.7 + extração deste commit)
// pra decidir SE uma aresta está violada — este arquivo só desenha a regra que já está calculada,
// nenhuma regra de negócio nova.

export interface EndpointResolution {
  level: 'task' | 'activity' | 'project';
  id: string;
}

/**
 * Ancoragem por tipo (spec 2.7, reaproveitada aqui pro desenho):
 *   FS — sai do FIM da predecessora, entra no INÍCIO da sucessora
 *   SS — sai do INÍCIO da predecessora, entra no INÍCIO da sucessora
 *   FF — sai do FIM da predecessora, entra no FIM da sucessora
 *   SF — sai do INÍCIO da predecessora, entra no FIM da sucessora
 */
function outDate(tipo: DependencyType, predecessor: { plannedStart: string; plannedEnd: string }): string {
  return tipo === 'FS' || tipo === 'FF' ? predecessor.plannedEnd : predecessor.plannedStart;
}

function inDate(tipo: DependencyType, successor: { plannedStart: string; plannedEnd: string }): string {
  return tipo === 'FS' || tipo === 'SS' ? successor.plannedStart : successor.plannedEnd;
}

/**
 * Quando uma ponta da dependência está numa atividade/projeto recolhido, a seta ancora na linha
 * visível mais próxima (atividade-pai, ou projeto-pai se a atividade também estiver recolhida) —
 * nunca some, porque a página abre com tudo recolhido por padrão e isso esconderia a maioria das
 * dependências (decisão registrada no plano da Fase 4, revisão do Commit 4).
 */
export function resolveVisibleDependencyEndpoint(
  taskId: string,
  taskToActivityId: Map<string, string>,
  activityToProjectId: Map<string, string>,
  collapsedActivityIds: Set<string>,
  collapsedProjectIds: Set<string>,
): EndpointResolution {
  const activityId = taskToActivityId.get(taskId);
  if (!activityId) return { level: 'task', id: taskId };

  const projectId = activityToProjectId.get(activityId);
  if (projectId && collapsedProjectIds.has(projectId)) return { level: 'project', id: projectId };
  if (collapsedActivityIds.has(activityId)) return { level: 'activity', id: activityId };
  return { level: 'task', id: taskId };
}

export interface DependencyEdge {
  taskId: string;
  predecessorTaskId: string;
  tipo: DependencyType;
  folgaDias: number;
  violated: boolean;
}

export interface ArrowGroup {
  origem: EndpointResolution;
  destino: EndpointResolution;
  tipo: DependencyType;
  folgaDias: number;
  violada: boolean;
}

function endpointKey(endpoint: EndpointResolution): string {
  return `${endpoint.level}:${endpoint.id}`;
}

/**
 * Deduplica arestas por (origem resolvida, destino resolvida, tipo) — sem isso, 5 tarefas de uma
 * atividade A dependendo de 5 tarefas de uma atividade B (25 arestas) virariam 25 setas idênticas
 * sobrepostas assim que a página abre já recolhida. Um grupo é "violado" se QUALQUER aresta dele
 * estiver violada. Arestas cuja origem e destino resolvem pra mesma linha (dependência interna a
 * um mesmo nível recolhido) são descartadas — arco pra si mesmo não informa nada.
 */
export function computeArrowGroups(
  edges: DependencyEdge[],
  resolveEndpoint: (taskId: string) => EndpointResolution,
): ArrowGroup[] {
  const groups = new Map<string, ArrowGroup>();
  for (const edge of edges) {
    const origem = resolveEndpoint(edge.predecessorTaskId);
    const destino = resolveEndpoint(edge.taskId);
    if (endpointKey(origem) === endpointKey(destino)) continue;

    const key = `${endpointKey(origem)}>${endpointKey(destino)}:${edge.tipo}`;
    const existing = groups.get(key);
    if (existing) {
      existing.violada = existing.violada || edge.violated;
    } else {
      groups.set(key, { origem, destino, tipo: edge.tipo, folgaDias: edge.folgaDias, violada: edge.violated });
    }
  }
  return [...groups.values()];
}

export interface ArrowEndpoint {
  rowIndex: number;
  plannedStart: string;
  plannedEnd: string;
}

export interface ArrowGeometry {
  path: string;
  arrowheadPath: string;
  labelText: string;
  labelX: number;
  labelY: number;
}

const ELBOW_NUB = 10;
const ARROWHEAD_SIZE = 5;

/**
 * Geometria em coordenadas de pixel, relativas ao topo/esquerda da área de timeline (mesmo
 * referencial de `barRect`/`offsetPx` no eixo x; y é `rowIndex * rowHeight + rowHeight/2`, `rowIndex`
 * contando toda linha visível — projeto, atividade e tarefa — na ordem em que aparece na tabela).
 * Roteamento em cotovelo: 2 segmentos quando a sucessora está "à frente" (dobra no meio do
 * caminho horizontal); 3 segmentos quando está "atrás" (sai um pouco à direita da predecessora,
 * sobe/desce, entra um pouco à esquerda da sucessora) — sem isso a seta cruzaria a própria barra
 * da predecessora.
 */
export function computeDependencyArrowGeometry(
  tipo: DependencyType,
  folgaDias: number,
  predecessor: ArrowEndpoint,
  successor: ArrowEndpoint,
  range: DateRange,
  pxPerDay: number,
  rowHeight: number,
): ArrowGeometry {
  const x1 = offsetPx(range, outDate(tipo, predecessor), pxPerDay);
  const x2 = offsetPx(range, inDate(tipo, successor), pxPerDay);
  const y1 = predecessor.rowIndex * rowHeight + rowHeight / 2;
  const y2 = successor.rowIndex * rowHeight + rowHeight / 2;

  let path: string;
  let lastSegmentStartX: number;
  if (x2 >= x1) {
    const midX = (x1 + x2) / 2;
    path = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
    lastSegmentStartX = midX;
  } else {
    const outX = x1 + ELBOW_NUB;
    const inX = x2 - ELBOW_NUB;
    path = `M ${x1} ${y1} H ${outX} V ${y2} H ${inX} L ${x2} ${y2}`;
    lastSegmentStartX = inX;
  }

  const dir = x2 >= lastSegmentStartX ? 1 : -1;
  const arrowheadPath = `M ${x2} ${y2} L ${x2 - dir * ARROWHEAD_SIZE} ${y2 - ARROWHEAD_SIZE / 2} L ${x2 - dir * ARROWHEAD_SIZE} ${y2 + ARROWHEAD_SIZE / 2} Z`;

  // Rótulo (FS+2, etc.) só quando não for o caso mais comum (FS+0) — quantificador explícito.
  const labelText = tipo !== 'FS' || folgaDias !== 0 ? `${tipo}${folgaDias >= 0 ? '+' : ''}${folgaDias}` : '';

  return {
    path,
    arrowheadPath,
    labelText,
    labelX: (x1 + x2) / 2,
    labelY: Math.min(y1, y2) - 4,
  };
}

export interface VisibleRowEntry {
  rowIndex: number;
  plannedStart?: string;
  plannedEnd?: string;
}

interface VisibleRowProject {
  id: string;
  plannedStart?: string;
  plannedEnd?: string;
  activities: {
    id: string;
    plannedStart?: string;
    plannedEnd?: string;
    tasks: { id: string; plannedStart: string; plannedEnd: string }[];
  }[];
}

/**
 * Índice de linha (0-based, na ordem em que a tabela renderiza) de toda linha atualmente
 * visível — projeto e atividade SEMPRE têm entrada aqui (a linha-resumo deles nunca some, só os
 * filhos somem quando recolhidos); tarefa só entra quando toda a cadeia (projeto E atividade)
 * está expandida. Altura de linha fixa (34px, Fase 4 Commit 1) é o que torna viável calcular a
 * posição por índice em vez de medir o DOM.
 */
export function buildVisibleRowIndex(
  projects: VisibleRowProject[],
  collapsedProjectIds: Set<string>,
  collapsedActivityIds: Set<string>,
): Map<string, VisibleRowEntry> {
  const index = new Map<string, VisibleRowEntry>();
  let rowIndex = 0;
  for (const project of projects) {
    index.set(`project:${project.id}`, { rowIndex, plannedStart: project.plannedStart, plannedEnd: project.plannedEnd });
    rowIndex++;
    if (collapsedProjectIds.has(project.id)) continue;

    for (const activity of project.activities) {
      index.set(`activity:${activity.id}`, {
        rowIndex,
        plannedStart: activity.plannedStart,
        plannedEnd: activity.plannedEnd,
      });
      rowIndex++;
      if (collapsedActivityIds.has(activity.id)) continue;

      for (const task of activity.tasks) {
        index.set(`task:${task.id}`, { rowIndex, plannedStart: task.plannedStart, plannedEnd: task.plannedEnd });
        rowIndex++;
      }
    }
  }
  return index;
}
