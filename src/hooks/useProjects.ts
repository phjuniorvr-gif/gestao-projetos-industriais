import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchProjects,
  insertReplanejamentos,
  restoreProjectRemote,
  saveProjectTree,
  softDeleteProjectRemote,
} from '../services/projectsRepo';
import type { Activity, Category, Project, ProjectView, Task, TaskDependency } from '../types';
import {
  buildReplanEntries,
  computeDateChanges,
  nextProjectCode,
  recomputeProject,
  todayISO,
  validateReplanMotivo,
  validateTaskDependencies,
} from '../utils';
import type { DependencyGraphNode, DependencyValidation, ReplanValidation } from '../utils';
import { useAuth } from './useAuth';
import { useHolidays } from './useHolidays';
import { useReplanejamentos } from './useReplanejamentos';

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
  const { replanejamentos, loaded: replanejamentosLoaded, refetch: refetchReplanejamentos } = useReplanejamentos();
  const { session } = useAuth();

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
  // holidays/replanejamentos undefined (não []) enquanto não carregaram — ver
  // computeLateCompletionDays em status.ts: undefined é "não sei ainda", não "vazio de verdade".
  const projects: ProjectView[] = useMemo(
    () =>
      rawProjects.map((p) =>
        recomputeProject(
          p,
          today,
          holidaysLoaded ? holidays : undefined,
          replanejamentosLoaded ? replanejamentos : undefined,
        ),
      ),
    [rawProjects, today, holidays, holidaysLoaded, replanejamentos, replanejamentosLoaded],
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

      // 1ª passada: numera e minta os ids de tarefa antes de montar a árvore — dependencies
      // (Fase 2.7) referencia id de outra tarefa, e uma tarefa da atividade 2 pode depender de
      // uma tarefa da atividade 1 (numeração é do projeto inteiro, não por atividade), então
      // todos os ids precisam existir antes de resolver qualquer dependency.
      let rowNumber = 0;
      const taskIdByRowNumber = new Map<number, string>();
      const planned = input.activities.map((a) => ({
        activityId: uid(),
        name: a.name,
        tasks: a.tasks.map((t) => {
          rowNumber += 1;
          const taskId = uid();
          taskIdByRowNumber.set(rowNumber, taskId);
          return { taskId, rowNumber, input: t };
        }),
      }));

      const activities: Activity[] = planned.map((a) => ({
        id: a.activityId,
        projectId: id,
        name: a.name,
        tasks: a.tasks.map(({ taskId, rowNumber: r, input: t }): Task => ({
          id: taskId,
          rowNumber: r,
          activityId: a.activityId,
          name: t.name,
          category: t.category,
          responsavelId: t.responsavelId,
          // Wizard só cria FS+0 (decisão 7, Fase 2.7) — ajustar tipo/folga é o editor do painel
          // da tarefa, depois de criada.
          dependencies: t.predecessorRowNumbers
            .map((row) => taskIdByRowNumber.get(row))
            .filter((predecessorId): predecessorId is string => predecessorId !== undefined)
            .map((predecessorId): TaskDependency => ({ predecessorId, tipo: 'FS', folgaDias: 0 })),
          plannedStart: t.plannedStart,
          plannedEnd: t.plannedEnd,
          // Linha de base (Fase 2.5): seed = previsto no instante de criação, nunca mais
          // tocado automaticamente depois — só via replanTask().
          baseStart: t.plannedStart,
          baseEnd: t.plannedEnd,
        })),
      }));
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

  /** Simétrico a `removeProject` — reinsere localmente sem esperar refetch, pro Desfazer (Fase 3)
   * não ter atraso perceptível. Recebe o projeto já em mãos (capturado no momento da exclusão). */
  const restoreProject = useCallback((project: Project) => {
    setRawProjects((current) => (current.some((p) => p.id === project.id) ? current : [...current, project]));
    restoreProjectRemote(project.id).catch((err) => console.error('Falha ao restaurar projeto no Supabase', err));
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

  /** Remove a atividade e todas as suas tarefas, renumerando o restante do projeto e removendo
   * dependências que apontavam pra alguma tarefa removida. Desde a Fase 2.7, `dependencies` é
   * por id (não por número de linha) — só precisa filtrar quem sumiu, não remapear quem ficou
   * (id não muda quando o número de linha muda). */
  const removeActivity = useCallback(
    (projectId: string, activityId: string) => {
      updateProject(projectId, (project) => {
        const activityToRemove = project.activities.find((a) => a.id === activityId);
        if (!activityToRemove) return project;

        const removedTaskIds = new Set(activityToRemove.tasks.map((t) => t.id));
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
              dependencies: task.dependencies.filter((d) => !removedTaskIds.has(d.predecessorId)),
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
        const allTasks = project.activities.flatMap((a) => a.tasks);
        const allRowNumbers = allTasks.map((t) => t.rowNumber);
        const nextRowNumber = allRowNumbers.length > 0 ? Math.max(...allRowNumbers) + 1 : 1;
        const taskIdByRowNumber = new Map(allTasks.map((t) => [t.rowNumber, t.id]));
        const task: Task = {
          id: uid(),
          rowNumber: nextRowNumber,
          activityId,
          name: input.name,
          category: input.category,
          responsavelId: input.responsavelId,
          dependencies: (input.predecessorRowNumbers ?? [])
            .map((row) => taskIdByRowNumber.get(row))
            .filter((predecessorId): predecessorId is string => predecessorId !== undefined)
            .map((predecessorId): TaskDependency => ({ predecessorId, tipo: 'FS', folgaDias: 0 })),
          plannedStart: input.plannedStart,
          plannedEnd: input.plannedEnd,
          // Linha de base (Fase 2.5): seed = previsto no instante de criação — este é o
          // caminho "Adicionar tarefa" numa atividade existente, que não passa por
          // computeDatesFromDuration, então o seed precisa estar aqui também.
          baseStart: input.plannedStart,
          baseEnd: input.plannedEnd,
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

  /**
   * Muda previsto e/ou linha de base de uma tarefa, com motivo obrigatório sempre que algo
   * realmente mudou (Fase 2.5) — ao lado de `updateTask`, não substituindo: nome/categoria/
   * responsável/real/predecessoras continuam sem motivo, `updateTask` continua servindo pra
   * eles. Quem decide se motivo é obrigatório é a própria função (computeDateChanges +
   * validateReplanMotivo), não quem chama.
   */
  const replanTask = useCallback(
    (
      projectId: string,
      taskId: string,
      patch: Partial<Pick<Task, 'plannedStart' | 'plannedEnd' | 'baseStart' | 'baseEnd'>>,
      motivo: string,
    ): ReplanValidation => {
      const project = rawProjects.find((p) => p.id === projectId);
      if (!project) return { valid: false, errors: ['Projeto não encontrado.'] };
      const oldTask = project.activities.flatMap((a) => a.tasks).find((t) => t.id === taskId);
      if (!oldTask) return { valid: false, errors: ['Tarefa não encontrada.'] };

      const changes = computeDateChanges(oldTask, patch);
      const validation = validateReplanMotivo(changes, motivo);
      if (!validation.valid) return validation;

      const quemUserId = session?.user?.id;
      if (!quemUserId) return { valid: false, errors: ['Sessão expirada — faça login de novo antes de replanejar.'] };

      const entries = buildReplanEntries(oldTask, patch, taskId, quemUserId, motivo.trim(), new Date().toISOString());

      updateTask(projectId, taskId, patch);
      if (entries.length > 0) {
        insertReplanejamentos(entries)
          .then(refetchReplanejamentos)
          .catch((err) => console.error('Falha ao gravar histórico de replanejamento no Supabase', err));
      }
      return { valid: true, errors: [] };
    },
    [rawProjects, updateTask, session, refetchReplanejamentos],
  );

  /** Remove a tarefa e limpa dependências de quem apontava pra ela (Fase 2.7) — antes disso
   * (predecessora por número de linha) esse dangling ficava até uma renumeração por acaso
   * resolver; por id, precisa filtrar explicitamente. */
  const removeTask = useCallback(
    (projectId: string, taskId: string) => {
      updateProject(projectId, (project) => ({
        ...project,
        activities: project.activities.map((a) => ({
          ...a,
          tasks: a.tasks
            .filter((t) => t.id !== taskId)
            .map((t) => ({ ...t, dependencies: t.dependencies.filter((d) => d.predecessorId !== taskId) })),
        })),
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

  /**
   * Valida e aplica as predecessoras de uma tarefa — cada entrada com número de linha (como o
   * usuário escolhe/vê), tipo e folga (Fase 2.7, Commit 3: editor de linhas em TaskPanel.tsx);
   * não persiste se inválido. `Task.dependencies` é por id — a validação
   * (autodependência/duplicata/ciclo) continua rodando sobre número de linha
   * (`DependencyGraphNode`, `dependencies.ts`), traduzido de/para id só aqui, na borda entre UI
   * e o dado persistido.
   */
  const setTaskPredecessors = useCallback(
    (
      projectId: string,
      taskId: string,
      entries: { predecessorRowNumber: number; tipo: TaskDependency['tipo']; folgaDias: number }[],
    ): DependencyValidation => {
      const project = rawProjects.find((p) => p.id === projectId);
      if (!project) return { valid: false, errors: ['Projeto não encontrado.'] };

      const allTasks = project.activities.flatMap((a) => a.tasks);
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return { valid: false, errors: ['Tarefa não encontrada.'] };

      const predecessorRowNumbers = entries.map((e) => e.predecessorRowNumber);
      const rowNumberById = new Map(allTasks.map((t) => [t.id, t.rowNumber]));
      const graphNodes: DependencyGraphNode[] = allTasks.map((t) => ({
        rowNumber: t.rowNumber,
        predecessorRowNumbers:
          t.id === taskId
            ? predecessorRowNumbers
            : t.dependencies
                .map((d) => rowNumberById.get(d.predecessorId))
                .filter((n): n is number => n !== undefined),
      }));

      const validation = validateTaskDependencies(task.rowNumber, graphNodes);
      if (validation.valid) {
        const idByRowNumber = new Map(allTasks.map((t) => [t.rowNumber, t.id]));
        const dependencies: TaskDependency[] = entries
          .map((e): TaskDependency | undefined => {
            const predecessorId = idByRowNumber.get(e.predecessorRowNumber);
            return predecessorId ? { predecessorId, tipo: e.tipo, folgaDias: e.folgaDias } : undefined;
          })
          .filter((d): d is TaskDependency => d !== undefined);
        updateTask(projectId, taskId, { dependencies });
      }
      return validation;
    },
    [rawProjects, updateTask],
  );

  return {
    projects,
    loaded,
    today,
    replanejamentos,
    createProject,
    removeProject,
    restoreProject,
    updateProjectInfo,
    addActivity,
    removeActivity,
    addTask,
    updateTask,
    replanTask,
    removeTask,
    reorderTask,
    setTaskPredecessors,
  };
}
