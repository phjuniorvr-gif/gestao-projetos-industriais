import type { Category } from '../../types';

export interface DraftTask {
  key: string;
  name: string;
  category: Category;
  responsavelId?: string;
  durationDays: number;
  predecessorRowNumbers: number[];
}

export interface DraftActivity {
  key: string;
  name: string;
  origin: 'catalog' | 'manual';
  tasks: DraftTask[];
  expanded: boolean;
}
