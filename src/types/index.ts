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

export interface Task {
  id: string;
  rowNumber: number;
  activityId: string;
  name: string;
  category: Category;
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
  responsible: string;
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
