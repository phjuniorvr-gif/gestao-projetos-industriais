import { useCallback, useEffect, useState } from 'react';
import { SEED_PROJECTS } from '../data/seed';
import { getItem, setItem, STORAGE_KEYS } from '../services/storage';
import type { Activity, Project, Task } from '../types';
import { nextProjectCode, recomputeProject, todayISO, validateTaskDependencies } from '../utils';
import type { DependencyValidation } from '../utils';

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export interface NewProjectInput {
  name: string;
  description?: string;
  unit: string;
  sector?: string;
  responsible?: string;
  activities: { name: string }[];
}

export interface NewTaskInput {
  name: string;
  category: Task['category'];
  plannedStart: string;
  plannedEnd: string;
  predecessorRowNumbers?: number[];
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = getItem<Project[] | null>(STORAGE_KEYS.projects, null);
    if (stored) {
      setProjects(stored);
    } else {
      setProjects(SEED_PROJECTS);
      setItem(STORAGE_KEYS.projects, SEED_PROJECTS);
    }
    setLoaded(true);
  }, []);

  const persist = useCallback((next: Project[]) => {
    setProjects(next);
    setItem(STORAGE_KEYS.projects, next);
  }, []);

  const updateProject = useCallback(
    (projectId: string, updater: (project: Project) => Project) => {
      setProjects((current) => {
        const next = current.map((p) => (p.id === projectId ? recomputeProject(updater(p)) : p));
        setItem(STORAGE_KEYS.projects, next);
        return next;
      });
    },
    [],
  );

  const createProject = useCallback(
    (input: NewProjectInput): Project => {
      const id = uid('project');
      const now = new Date().toISOString();
      const activities: Activity[] = input.activities.map((a) => ({
        id: uid('activity'),
        projectId: id,
        name: a.name,
        tasks: [],
        status: 'planned',
      }));
      const project = recomputeProject({
        id,
        code: nextProjectCode(projects.map((p) => p.code)),
        name: input.name,
        description: input.description,
        unit: input.unit,
        sector: input.sector ?? '',
        responsible: input.responsible ?? '',
        progress: 0,
        status: 'planned',
        activities,
        createdAt: now,
        updatedAt: now,
      });
      persist([...projects, project]);
      return project;
    },
    [projects, persist],
  );

  const removeProject = useCallback(
    (projectId: string) => {
      persist(projects.filter((p) => p.id !== projectId));
    },
    [projects, persist],
  );

  const updateProjectInfo = useCallback(
    (projectId: string, patch: Partial<Pick<Project, 'name' | 'description' | 'unit' | 'sector' | 'responsible'>>) => {
      updateProject(projectId, (project) => ({ ...project, ...patch }));
    },
    [updateProject],
  );

  const addActivity = useCallback(
    (projectId: string, name: string) => {
      updateProject(projectId, (project) => ({
        ...project,
        activities: [
          ...project.activities,
          { id: uid('activity'), projectId, name, tasks: [], status: 'planned' },
        ],
      }));
    },
    [updateProject],
  );

  const addTask = useCallback(
    (projectId: string, activityId: string, input: NewTaskInput) => {
      updateProject(projectId, (project) => {
        const allRowNumbers = project.activities.flatMap((a) => a.tasks.map((t) => t.rowNumber));
        const nextRowNumber = allRowNumbers.length > 0 ? Math.max(...allRowNumbers) + 1 : 1;
        const task: Task = {
          id: uid('task'),
          rowNumber: nextRowNumber,
          activityId,
          name: input.name,
          category: input.category,
          predecessorRowNumbers: input.predecessorRowNumbers ?? [],
          plannedStart: input.plannedStart,
          plannedEnd: input.plannedEnd,
          status: 'planned',
        };
        return {
          ...project,
          activities: project.activities.map((a) =>
            a.id === activityId ? { ...a, tasks: [...a.tasks, task] } : a,
          ),
        };
      });
    },
    [updateProject],
  );

  const updateTask = useCallback(
    (projectId: string, taskId: string, patch: Partial<Omit<Task, 'id' | 'rowNumber' | 'activityId' | 'status'>>) => {
      updateProject(projectId, (project) => ({
        ...project,
        activities: project.activities.map((a) => ({
          ...a,
          tasks: a.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        })),
      }));
    },
    [updateProject],
  );

  const removeTask = useCallback(
    (projectId: string, taskId: string) => {
      updateProject(projectId, (project) => ({
        ...project,
        activities: project.activities.map((a) => ({ ...a, tasks: a.tasks.filter((t) => t.id !== taskId) })),
      }));
    },
    [updateProject],
  );

  const reorderTask = useCallback(
    (projectId: string, activityId: string, taskId: string, direction: -1 | 1) => {
      updateProject(projectId, (project) => ({
        ...project,
        activities: project.activities.map((a) => {
          if (a.id !== activityId) return a;
          const index = a.tasks.findIndex((t) => t.id === taskId);
          const target = index + direction;
          if (index === -1 || target < 0 || target >= a.tasks.length) return a;
          const tasks = [...a.tasks];
          [tasks[index], tasks[target]] = [tasks[target], tasks[index]];
          return { ...a, tasks };
        }),
      }));
    },
    [updateProject],
  );

  /** Valida e aplica as predecessoras de uma tarefa; não persiste se inválido. */
  const setTaskPredecessors = useCallback(
    (projectId: string, taskId: string, predecessorRowNumbers: number[]): DependencyValidation => {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return { valid: false, errors: ['Projeto não encontrado.'] };

      const allTasks = project.activities.flatMap((a) => a.tasks);
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return { valid: false, errors: ['Tarefa não encontrada.'] };

      const candidateTasks = allTasks.map((t) => (t.id === taskId ? { ...t, predecessorRowNumbers } : t));
      const validation = validateTaskDependencies(task.rowNumber, candidateTasks);
      if (validation.valid) {
        updateTask(projectId, taskId, { predecessorRowNumbers });
      }
      return validation;
    },
    [projects, updateTask],
  );

  return {
    projects,
    loaded,
    today: todayISO(),
    createProject,
    removeProject,
    updateProjectInfo,
    addActivity,
    addTask,
    updateTask,
    removeTask,
    reorderTask,
    setTaskPredecessors,
  };
}
