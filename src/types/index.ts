// 4 valores (Fase 2.3). blocked/completed_late/to_start não são mais valor de status — viram
// condição derivada exibida ao lado (TaskView.isBlocked, .isLateCompletion, .isStartDelayed).
export type ProjectStatus = 'planned' | 'in_progress' | 'delayed' | 'completed';

export type TaskStatus = ProjectStatus;

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: 'Planejado',
  in_progress: 'Em andamento',
  delayed: 'Atrasado',
  completed: 'Concluído',
};

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  planned: '#7C3AED',
  in_progress: '#CA8A04',
  delayed: '#C2410C',
  completed: '#15803D',
};

// Categorias agora são dados dinâmicos (tabela `categories` no Supabase, geridas via useCategories()),
// não mais um union fixo — o tipo abaixo só documenta que é um id de categoria.
export type Category = string;

export interface CategoryEntry {
  id: string;
  label: string;
  color: string;
  position: number;
}

// Feriado NÃO calculável (municipal, ponto facultativo, parada de fábrica).
// Feriado nacional não mora aqui — é calculado em src/utils/dates.ts (nationalHolidays),
// espelhando a função SQL feriados_nacionais(). Ver design.md / CLAUDE.md (Fase 2.6).
export type HolidayType = 'municipal' | 'ponto_facultativo' | 'parada_fabrica';

export interface Holiday {
  id: string;
  date: string;
  unit?: string;
  type: HolidayType;
  description?: string;
}

// Gerente de projeto e responsável de tarefa (Fase 2.1) — dois papéis, uma tabela.
// user_id opcional: pessoa não precisa ter login no sistema.
export interface Person {
  id: string;
  name: string;
  active: boolean;
  userId?: string;
}

// Papel de acesso (Fase 5, tabela `perfis`) — login + permissão, diferente de `Person`
// (que é só "quem é referenciado em tarefa/projeto", nem sempre tem login).
export type Papel = 'usuario' | 'administrador';

export interface Usuario {
  userId: string;
  email: string;
  papel: Papel;
  createdAt: string;
}

// Task/Activity/Project (abaixo) são a forma PERSISTIDA — sem status nem nenhum campo
// derivado. É o que projectsRepo.ts lê/escreve. TaskView/ActivityView/ProjectView (mais
// abaixo) são o que recomputeProject produz — status e condições derivadas anexadas —
// e é o que useProjects() devolve e todo componente de UI consome. Ver CLAUDE.md (Fase 2.3):
// nada calculável fica no tipo persistido, então não existe placeholder de status pra mentir.
// Mesma regra vale pras datas de Activity/Project (Fase 2.4): não têm data própria — só Task
// tem, e Activity/Project recebem plannedStart/plannedEnd/actualStart/actualEnd só em
// ActivityView/ProjectView, via rollUpDates (extremos das tarefas/atividades filhas).
export interface Task {
  id: string;
  rowNumber: number;
  activityId: string;
  name: string;
  category: Category;
  /** Quem executa a tarefa — Person.id, opcional (sem dado de origem migrado). */
  responsavelId?: string;
  /** Dependências tipadas (Fase 2.7) — substitui o antigo predecessorRowNumbers (renomeado pra
   * predecessor_row_numbers_legacy no banco, Commit 4) como fonte de verdade persistida.
   * projectsRepo.ts (fetchProjectsWhere/saveProjectTree) garante sempre preenchido, mesmo padrão
   * de baseStart/baseEnd na Fase 2.5. Número de linha continua sendo como o usuário escolhe/vê a
   * predecessora — só TaskView.predecessorRowNumbers (derivado) traduz de volta pra exibição. */
  dependencies: TaskDependency[];
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  /** Linha de base (Fase 2.5) — congelada no instante de criação da tarefa (seed =
   * plannedStart/plannedEnd nesse momento), só muda via replanTask() com motivo obrigatório.
   * Obrigatório: projectsRepo.ts (fetchProjectsWhere/saveProjectTree) e useProjects.ts
   * (createProject/addTask) garantem os dois sempre preenchidos. */
  baseStart: string;
  baseEnd: string;
  /** Fase 7+ — `true` quando o real (se houver) não precisa de confirmação do administrador.
   * Fica `false` só quando um usuário comum informa data real (RPC `informar_data_real`); volta
   * a `true` quando o administrador confirma ou edita a data real ele mesmo. Default `true` no
   * banco (`NOT NULL DEFAULT true`) — cobre tarefa sem data real (irrelevante) e tarefa
   * concluída pelo próprio administrador (não precisa confirmar a si mesmo). Só a RPC escreve
   * esta coluna — `saveProjectTree` nunca inclui no upsert, pra não sobrescrever com um valor
   * desatualizado do estado local quando o administrador edita outra coisa da tarefa. */
  confirmedByAdmin: boolean;
}

/** Os quatro tipos de dependência (Fase 2.7, spec 2.7) — regra em dias úteis de cada um em
 * `computeDependencyRuleDate` (src/utils/dependencies.ts). */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface TaskDependency {
  /** Task.id da predecessora — não é número de linha (esse é só como o usuário escolhe/vê na
   * UI); id sobrevive a exclusão/renumeração de outras tarefas sem precisar remapear nada. */
  predecessorId: string;
  tipo: DependencyType;
  /** Folga em dias úteis — pode ser negativa (antecipação/lead time), spec não restringe o sinal. */
  folgaDias: number;
}

export interface Activity {
  id: string;
  projectId: string;
  name: string;
  tasks: Task[];
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  sector: string;
  /** Quem responde pelo prazo do projeto — Person.id. Nullable: trava "obrigatório" é Fase 7. */
  gerenteId?: string;
  activities: Activity[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Condições derivadas (Fase 2.3, decisão no CLAUDE.md): blocked/completed_late/to_start não
// desaparecem — viram selo ao lado do status. No nível de tarefa são booleanos simples; no
// nível de atividade/projeto, isBlocked/isStartDelayed viram CONTAGEM (não booleano — some()
// sobre 50+ tarefas satura e sempre fica "ligado", sem informar nada). isLateCompletion continua
// booleano em todo nível (mais raro, some() ainda é informativo).
export interface TaskView extends Task {
  status: TaskStatus;
  isBlocked: boolean;
  isStartDelayed: boolean;
  isLateCompletion: boolean;
  /** Dias úteis de atraso na conclusão — só definido quando os feriados já carregaram. */
  lateCompletionDays?: number;
  /** Nº de vezes que o PREVISTO foi empurrado (replanejamentos com campo='previsto') — Fase 2.5.
   * undefined enquanto o histórico ainda não carregou (mesmo padrão de lateCompletionDays: não
   * adivinha 0 antes de saber de verdade). */
  replanCount?: number;
  /** Alguma dependência (dos 4 tipos) tem a data PREVISTA da tarefa violando a regra da tabela
   * FS/SS/FF/SF (Fase 2.7) — sinaliza, nunca bloqueia salvar (spec 2.7). Sempre calculado (não
   * depende de fetch assíncrono próprio — feriados incompletos usam fallback [], mesmo padrão
   * tolerante de computeProgress/taskWeight), por isso não é opcional como replanCount. */
  hasDependencyViolation: boolean;
  /** Número de linha de cada dependência, derivado de `dependencies` só pra exibição (GanttRow,
   * "Predecessora(s)", editor) — `dependencies` (id) continua a fonte de verdade persistida. */
  predecessorRowNumbers: number[];
  /** Fase 7+ — tem data real preenchida mas ainda não foi confirmada pelo administrador (pedido
   * do usuário: "quando eles concluírem... o adm confirme a finalização"). Enquanto `true`,
   * `status` NÃO é 'completed' (`computeTaskStatus` volta a calcular como se `actualEnd` não
   * existisse) — o selo é o que explica pra quem olha por que uma tarefa com data real ainda não
   * aparece como Concluída. */
  pendingConfirmation: boolean;
}

export interface ActivityView extends Omit<Activity, 'tasks'> {
  status: ProjectStatus;
  blockedCount: number;
  startDelayedCount: number;
  isLateCompletion: boolean;
  /** Roll-up das tarefas filhas (rollUpDates) — Activity (persistida) não tem data própria. */
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  /** Roll-up da linha de base das tarefas filhas (Fase 2.5) — mesma regra de extremos de
   * plannedStart/plannedEnd (não a assimetria de actualStart/actualEnd: base nunca é parcial,
   * os dois são sempre seedados juntos na criação da tarefa). */
  baseStart?: string;
  baseEnd?: string;
  /** Avanço ponderado por dias úteis (computeProgress, Fase 2.2) — Activity não tem % própria. */
  progress: number;
  tasks: TaskView[];
}

export interface ProjectView extends Omit<Project, 'activities'> {
  status: ProjectStatus;
  blockedCount: number;
  startDelayedCount: number;
  isLateCompletion: boolean;
  /** Roll-up das atividades filhas (rollUpDates) — Project (persistido) não tem data própria. */
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  /** Roll-up da linha de base das atividades filhas (Fase 2.5) — mesma regra de extremos,
   * ver comentário equivalente em ActivityView. */
  baseStart?: string;
  baseEnd?: string;
  /** Avanço ponderado por dias úteis (computeProgress, Fase 2.2) — Project não tem % própria. */
  progress: number;
  activities: ActivityView[];
}

export interface TaskTemplate {
  id: string;
  name: string;
  durationDays: number;
}

export interface ActivityTemplate {
  id: string;
  name: string;
  category: Category;
  tasks: TaskTemplate[];
  active: boolean;
}

// Auditoria de replanejamento (Fase 2.5) — toda mudança de previsto OU de linha de base grava
// uma linha aqui, com motivo obrigatório. campo diz qual conceito mudou (previsto/base/real —
// 'real' desde a Fase 7+, RPC informar_data_real); campoData diz qual das duas datas
// (início/fim) — sem essa segunda dimensão uma linha do log não diz o que exatamente mudou.
export type ReplanCampo = 'previsto' | 'base' | 'real';
export type ReplanCampoData = 'inicio' | 'fim';

export interface Replanejamento {
  id: string;
  tarefaId: string;
  quando: string;
  quemUserId: string;
  campo: ReplanCampo;
  campoData: ReplanCampoData;
  /** Opcional só pra campo='real' — "informar real" pode logar a partir de/pra null (tarefa sem
   * data real ainda, ou data real removida). previsto/base sempre têm valor dos dois lados. */
  de?: string;
  para?: string;
  motivo: string;
  /** `true` quando quem gerou a linha era administrador no momento — `computeReplanCount`
   * (`replan.ts`) ignora essas linhas no selo R{n} (edição do administrador não conta como
   * "replanejamento" pro selo, só o log continua registrando normalmente). */
  porAdministrador: boolean;
}
