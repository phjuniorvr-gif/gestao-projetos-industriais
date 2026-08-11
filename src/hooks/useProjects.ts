import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchProjects, saveProjectTree, softDeleteProjectRemote } from '../services/projectsRepo';
import type { Activity, Category, Project, ProjectView, Task } from '../types';
import { nextProjectCode, recomputeProject, todayISO, validateTaskDependencies } from '../utils';
import type { DependencyValidation } from '../utils';
import { useHolidays } from './useHolidays';

// IDs precisam ser UUIDs válidos: são gravados direto nas colunas `uuid` do Supabase.
function uid(): string {
  return crypto.randomUUID();
}

export interface NewActivityInput {
  name: string;
  tasks: {
    name: string;
    category: Category;
    responsavelId?: string;
    plannedStart: string;
    plannedEnd: string;
    predecessorRowNumbers: number[];
  }[];
}

export interface NewProjectInput {
  name: string;
  description?: string;
  unit: string;
  sector?: string;
  gerenteId?: string;
  activities: NewActivityInput[];
}

export interface NewTaskInput {
  name: string;
  category: Task['category'];
  responsavelId?: string;
  plannedStart: string;
  plannedEnd: string;
  predecessorRowNumbers?: number[];
}

/**
 * `rawProjects` (estado) é a forma persistida — nunca tem status. `projects` (retornado) é
 * derivado via `useMemo` + `recomputeProject`, uma vez só, num lugar só — nem o repo nem os
 * updaters recalculam nada (ver CLAUDE.md, Fase 2.3: recompute só aqui, nunca no repo).
 */
export function useProjects() {
  const [rawProjects, setRawProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { holidays, loaded: holidaysLoaded } = useHolidays();

  useEffect(() => {
    fetchProjects()
      .then(setRawProjects)
      .catch((err) => console.error('Falha ao carregar projetos do Supabase', err))
      .finally(() => setLoaded(true));
  }, []);

  // Estado (não const recalculada a cada render): sem um trigger de re-render, uma aba aberta
  // durante a virada da meia-noite (ou muito tempo em segundo plano) ficaria com "hoje" parado
  // no valor de quando montou. Recalcula ao voltar o foco/visibilidade da aba.
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const recomputeToday = () => {
      if (document.visibilityState === 'visible') setToday(todayISO());
    };
    document.addEventListener('visibilitychange', recomputeToday);
    window.addEventListener('focus', recomputeToday);
    return () => {
      document.removeEventListener('visibilitychange', recomputeToday);
      window.removeEventListener('focus', recomputeToday);
    };
  }, []);
  // holidays undefined (não []) enquanto não carregou — ver computeLateCompletionDays em
  // status.ts: undefined é "não sei ainda", não "não há feriado".
  const projects: ProjectView[] = useMemo(
    () => rawProjects.map((p) => recomputeProject(p, today, holidaysLoaded ? holidays : undefined)),
    [rawProjects, today, holidays, holidaysLoaded],
  );

  const updateProject = useCallback(
    (projectId: string, updater: (project: Project) => Project) => {
      setRawProjects((current) => {
        const next = current.map((p) => (p.id === projectId ? updater(p) : p));
        const updated = next.find((p) => p.id === projectId);
        if (updated) saveProjectTree(updated).catch((err) => console.error('Falha ao salvar projeto no Supabase', err));
        return next;
      });
    },
    [],
  );

  const createProject = useCallback(
    (input: NewProjectInput): Project => {
      const id = uid();
      const now = new Date().toISOString();
      let rowNumber = 0;
      const activities: Activity[] = input.activities.map((a) => {
        const activityId = uid();
        const tasks: Task[] = a.tasks.map((t) => {
          rowNumber += 1;
          return {
            id: uid(),
            rowNumber,
            activityId,
            name: t.name,
            category: t.category,
            responsavelId: t.responsavelId,
            predecessorRowNumbers: t.predecessorRowNumbers,
            plannedStart: t.plannedStart,
            plannedEnd: t.plannedEnd,
          };
        });
        return { id: activityId, projectId: id, name: a.name, tasks };
      });
      const project: Project = {
        id,
        code: nextProjectCode(rawProjects.map((p) => p.code)),
        name: input.name,
        description: input.description,
        unit: input.unit,
        sector: input.sector ?? '',
        gerenteId: input.gerenteId,
        activities,
        createdAt: now,
        updatedAt: now,
      };
      setRawProjects((current) => [...current, project]);
      saveProjectTree(project).catch((err) => console.error('Falha ao criar projeto no Supabase', err));
      return project;
    },
    [rawProjects],
  );

  const removeProject = useCallback((projectId: string) => {
    setRawProjects((current) => current.filter((p) => p.id !== projectId));
    softDeleteProjectRemote(projectId).catch((err) => console.error('Falha ao excluir projeto no Supabase', err));
  }, []);

  const updateProjectInfo = useCallback(
    (projectId: string, patch: Partial<Pick<Project, 'name' | 'description' | 'unit' | 'sector' | 'gerenteId'>>) => {
      updateProject(projectId, (project) => ({ ...project, ...patch }));
    },
    [updateProject],
  );

  const addActivity = useCallback(
    (projectId: string, name: string) => {
      updateProject(projectId, (project) => ({
        ...project,
        activities: [...project.activities, { id: uid(), projectId, name, tasks: [] }],
      }));
    },
    [updateProject],
  );

  /** Remove a atividade e todas as suas tarefas, renumerando o restante do projeto e ajustando predecessoras. */
  const removeActivity = useCallback(
    (projectId: string, activityId: string) => {
      updateProject(projectId, (project) => {
        const activityToRemove = project.activities.find((a) => a.id === activityId);
        if (!activityToRemove) return project;

        const removedRowNumbers = new Set(activityToRemove.tasks.map((t) => t.rowNumber));
        const remainingActivities = project.activities.filter((a) => a.id !== activityId);
        const remainingTasksSorted = remainingActivities
          .flatMap((a) => a.tasks)
          .sort((a, b) => a.rowNumber - b.rowNumber);

        const rowNumberMap = new Map<number, number>();
        remainingTasksSorted.forEach((task, index) => rowNumberMap.set(task.rowNumber, index + 1));

        return {
          ...project,
          activities: remainingActivities.map((a) => ({
            ...a,
            tasks: a.tasks.map((task) => ({
              ...task,
              rowNumber: rowNumberMap.get(task.rowNumber)!,
              predecessorRowNumbers: task.predecessorRowNumbers
                .filter((row) => !removedRowNumbers.has(row))
                .map((row) => rowNumberMap.get(row)!),
            })),
          })),
        };
      });
    },
    [updateProject],
  );

  const addTask = useCallback(
    (projectId: string, activityId: string, input: NewTaskInput) => {
      updateProject(projectId, (project) => {
        const allRowNumbers = project.activities.flatMap((a) => a.tasks.map((t) => t.rowNumber));
        const nextRowNumber = allRowNumbers.length > 0 ? Math.max(...allRowNumbers) + 1 : 1;
        const task: Task = {
          id: uid(),
          rowNumber: nextRowNumber,
          activityId,
          name: input.name,
          category: input.category,
          responsavelId: input.responsavelId,
          predecessorRowNumbers: input.predecessorRowNumbers ?? [],
          plannedStart: input.plannedStart,
          plannedEnd: input.plannedEnd,
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
    (projectId: string, taskId: string, patch: Partial<Omit<Task, 'id' | 'rowNumber' | 'activityId'>>) => {
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
      const project = rawProjects.find((p) => p.id === projectId);
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
    [rawProjects, updateTask],
  );

  return {
    projects,
    loaded,
    today,
    createProject,
    removeProject,
    updateProjectInfo,
    addActivity,
    removeActivity,
    addTask,
    updateTask,
    removeTask,
    reorderTask,
    setTaskPredecessors,
  };
}
