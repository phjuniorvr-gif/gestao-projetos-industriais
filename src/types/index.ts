export type ProjectStatus =
  | 'planned'
  | 'to_start'
  | 'in_progress'
  | 'completed'
  | 'completed_late'
  | 'delayed'
  | 'blocked';

export type TaskStatus = ProjectStatus;

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planned: 'Planejado',
  to_start: 'À iniciar',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  completed_late: 'Concluído com atraso',
  delayed: 'Atrasado',
  blocked: 'Bloqueado',
};

// Cores dos 4 status que sobrevivem ao modelo da Fase 2 (planejado/andamento/atrasado/concluído),
// já na paleta do design.md. to_start/completed_late/blocked ficam com a cor antiga por ora —
// viram selo/ícone derivado na Fase 2, não fazem mais parte do valor de status em si.
export const STATUS_COLOR: Record<ProjectStatus, string> = {
  planned: '#7C3AED',
  to_start: '#A3A3A3',
  in_progress: '#2563EB',
  completed: '#15803D',
  completed_late: '#F97316',
  delayed: '#C2410C',
  blocked: '#7C3AED',
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

export interface Task {
  id: string;
  rowNumber: number;
  activityId: string;
  name: string;
  category: Category;
  /** Quem executa a tarefa — Person.id, opcional (sem dado de origem migrado). */
  responsavelId?: string;
  predecessorRowNumbers: number[];
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: TaskStatus;
}

export interface Activity {
  id: string;
  projectId: string;
  name: string;
  tasks: Task[];
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  status: TaskStatus;
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
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  progress: number;
  status: ProjectStatus;
  activities: Activity[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
}

export interface ActivityTemplate {
  id: string;
  name: string;
  category: Category;
  tasks: TaskTemplate[];
  active: boolean;
}
