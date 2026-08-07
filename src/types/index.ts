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

export const STATUS_COLOR: Record<ProjectStatus, string> = {
  planned: '#39BDF2',
  to_start: '#A3A3A3',
  in_progress: '#FDE000',
  completed: '#166534',
  completed_late: '#F97316',
  delayed: '#F43F5E',
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
