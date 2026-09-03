import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  fetchProjects,
  informarDataReal,
  replanTaskAtomic,
  reprovarFinalizacao,
  restoreProjectRemote,
  saveProjectTree,
  softDeleteProjectRemote,
  updateTaskObservacao as updateTaskObservacaoRemote,
} from '../services/projectsRepo';
import type { Activity, Category, Project, ProjectView, Task, TaskDependency } from '../types';
import {
  computeDateChanges,
  computeDatesFromDuration,
  nextProjectCode,
  recomputeProject,
  resolveActualDatesPatch,
  todayISO,
  validateReplanMotivo,
  validateTaskDependencies,
} from '../utils';
import type { DependencyGraphNode, DependencyValidation, ReplanValidation } from '../utils';
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

/** Tarefa de um lote adicionado via `addActivityWithTasks` (catálogo, atividade já existente).
 * `predecessorRowNumbers` é posicional dentro do próprio lote (1-based, índice em `tasks`), igual
 * ao `DurationTaskInput` do wizard — não é o `rowNumber` global do projeto. */
export interface NewActivityTaskInput {
  name: string;
  category: Category;
  responsavelId: string;
  durationDays: number;
  predecessorRowNumbers: number[];
}

/** Tira a atividade do projeto: renumera as tarefas sobreviventes (rowNumber compactado) e limpa
 * as entradas de `dependencies` das tarefas sobreviventes que apontavam pra alguma tarefa
 * removida como predecessora — extraída de `removeActivity` (Fase 2.7) pra ser reaproveitada
 * também por `removeActivityWithTasks` (Fase 7, Parte A). */
function removeActivityFromProject(project: Project, activityId: string): Project {
  const activityToRemove = project.activities.find((a) => a.id === activityId);
  if (!activityToRemove) return project;

  const removedTaskIds = new Set(activityToRemove.tasks.map((t) => t.id));
  const remainingActivities = project.activities.filter((a) => a.id !== activityId);
  const remainingTasksSorted = remainingActivities.flatMap((a) => a.tasks).sort((a, b) => a.rowNumber - b.rowNumber);

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
}

/**
 * `rawProjects` (estado) é a forma persistida — nunca tem status. `projects` (retornado) é
 * derivado via `useMemo` + `recomputeProject`, uma vez só, num lugar só — nem o repo nem os
 * updaters recalculam nada (ver CLAUDE.md, Fase 2.3: recompute só aqui, nunca no repo).
 *
 * Interna — não exportada diretamente. `useProjects()` (abaixo) lê essa mesma instância via
 * Context (`ProjectsProvider`, montado uma vez em `App.tsx`), não chama isto de novo a cada
 * página: sem isso, cada tela teria sua PRÓPRIA cópia de `rawProjects`, e uma mutação numa tela
 * (ex.: confirmar uma tarefa em Confirmações) nunca apareceria no menu lateral (outra instância)
 * até um F5 — achado com relato do usuário sobre o badge de "Confirmações" não atualizando.
 */
function useProjectsState() {
  const [rawProjects, setRawProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { holidays, loaded: holidaysLoaded } = useHolidays();
  const { replanejamentos, loaded: replanejamentosLoaded, refetch: refetchReplanejamentos } = useReplanejamentos();

  const refetch = useCallback(() => {
    return fetchProjects()
      .then(setRawProjects)
      .catch((err) => console.error('Falha ao carregar projetos do Supabase', err))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch é estável (useCallback com
    // deps vazias), só precisa rodar uma vez no mount
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

  /**
   * Só o estado local (`rawProjects`) — sem `saveProjectTree` (Fase 5, Commit 2). Usada por
   * `updateTaskActualDates`/`replanTask`, que têm seu próprio caminho de escrita remota estreito
   * (`updateTaskActual`/`replanTaskAtomic`, só a tabela `tasks`); se essas duas chamassem
   * `updateProject` normal, `saveProjectTree` reescreveria o projeto inteiro por cima — inclusive
   * atividades e o delete+reinsert de dependências, que ninguém tocou nessas duas ações.
   */
  const updateProjectLocal = useCallback((projectId: string, updater: (project: Project) => Project) => {
    setRawProjects((current) => current.map((p) => (p.id === projectId ? updater(p) : p)));
  }, []);

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
          // Sem data real ainda — mesmo default do banco (NOT NULL DEFAULT true), seedado aqui
          // pra TaskView.pendingConfirmation calcular certo antes do primeiro refetch.
          confirmedByAdmin: true,
          rejected: false,
          rejectionCount: 0,
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

  const updateActivityName = useCallback(
    (projectId: string, activityId: string, name: string) => {
      updateProject(projectId, (project) => ({
        ...project,
        activities: project.activities.map((a) => (a.id === activityId ? { ...a, name } : a)),
      }));
    },
    [updateProject],
  );

  const addActivity = useCallback(
    (projectId: string, name: string, processo?: string) => {
      updateProject(projectId, (project) => ({
        ...project,
        activities: [...project.activities, { id: uid(), projectId, name, tasks: [], processo }],
      }));
    },
    [updateProject],
  );

  /** Cria a atividade já com um lote de tarefas (fluxo "Selecionar do catálogo" do
   * `AddActivityDialog`) — diferente de `addActivity` + N `addTask`, que exigiriam o id da
   * atividade de volta entre uma chamada e outra; aqui a árvore inteira é montada e persistida
   * numa passada só, mesmo raciocínio de `createProject`. `startISO` é o início da primeira
   * tarefa sem predecessor no lote (hoje, no caller) — tarefas do catálogo não têm predecessora
   * entre si (mesma convenção de `ActivitySourceForm`), então todas caem no mesmo dia.
   *
   * Ids gerados FORA do updater (não dentro do callback passado a `updateProject`): em
   * StrictMode (dev), React invoca o callback de `setRawProjects` duas vezes de propósito pra
   * flagar updaters impuros — gerar `uid()` novo a cada invocação fazia as duas execuções
   * criarem atividades com ids diferentes, e a segunda gravação no Supabase apagava a atividade
   * da primeira (`saveProjectTree` deleta o que não está na lista atual) bem no meio da gravação
   * das tarefas da primeira, violando a FK `tasks_activity_id_fkey`. Com os ids fixos antes de
   * entrar no updater, as duas invocações produzem exatamente o mesmo resultado (idempotente). */
  const addActivityWithTasks = useCallback(
    (projectId: string, name: string, taskInputs: NewActivityTaskInput[], startISO: string, processo?: string) => {
      const activityId = uid();
      const taskIds = taskInputs.map(() => uid());
      updateProject(projectId, (project) => {
        const allRowNumbers = project.activities.flatMap((a) => a.tasks).map((t) => t.rowNumber);
        let nextRowNumber = allRowNumbers.length > 0 ? Math.max(...allRowNumbers) + 1 : 1;

        const durationInputs = taskInputs.map((t, index) => ({
          key: String(index),
          durationDays: t.durationDays,
          predecessorRowNumbers: t.predecessorRowNumbers,
        }));
        const dates = computeDatesFromDuration(durationInputs, startISO, holidays, project.unit);

        const tasks: Task[] = taskInputs.map((t, index) => {
          const period = dates.get(String(index))!;
          const task: Task = {
            id: taskIds[index],
            rowNumber: nextRowNumber,
            activityId,
            name: t.name,
            category: t.category,
            responsavelId: t.responsavelId,
            dependencies: [],
            plannedStart: period.plannedStart,
            plannedEnd: period.plannedEnd,
            // Linha de base (Fase 2.5): seed = previsto no instante de criação.
            baseStart: period.plannedStart,
            baseEnd: period.plannedEnd,
            confirmedByAdmin: true,
            rejected: false,
            rejectionCount: 0,
          };
          nextRowNumber += 1;
          return task;
        });

        return {
          ...project,
          activities: [...project.activities, { id: activityId, projectId, name, tasks, processo }],
        };
      });
    },
    [updateProject, holidays],
  );

  /** Remove a atividade e todas as suas tarefas, renumerando o restante do projeto e removendo
   * dependências que apontavam pra alguma tarefa removida. Desde a Fase 2.7, `dependencies` é
   * por id (não por número de linha) — só precisa filtrar quem sumiu, não remapear quem ficou
   * (id não muda quando o número de linha muda). */
  const removeActivity = useCallback(
    (projectId: string, activityId: string) => {
      updateProject(projectId, (project) => removeActivityFromProject(project, activityId));
    },
    [updateProject],
  );

  /**
   * Fase 7 (Parte A) — implementa a decisão registrada no CLAUDE.md desde antes da Fase 2
   * ("exclusão de atividade com tarefas fica bloqueada por padrão, admin tem ação explícita +
   * Desfazer de 6s"), nunca construída até agora. Diferente de `removeActivity` (usado só quando
   * a atividade não tem tarefa — sem necessidade de desfazer), esta função devolve o `Project`
   * INTEIRO de antes da remoção (não só a atividade) — é o que torna o desfazer completo possível
   * sem reconstruir manualmente `rowNumber`s renumerados e as entradas de `dependencies` que
   * `removeActivityFromProject` já limpa nas tarefas sobreviventes (ver correção de plano: um
   * snapshot só da atividade perderia essas arestas). `null` se o projeto não existir (defensivo).
   */
  const removeActivityWithTasks = useCallback(
    (projectId: string, activityId: string): Project | null => {
      let previousProject: Project | null = null;
      updateProject(projectId, (project) => {
        previousProject = project;
        return removeActivityFromProject(project, activityId);
      });
      return previousProject;
    },
    [updateProject],
  );

  /** Desfazer de `removeActivityWithTasks` — substitui o projeto inteiro pelo snapshot de antes
   * da remoção (reinsere a atividade, as tarefas com `rowNumber`s originais, e as entradas de
   * `dependencies` que tinham sido limpas nas tarefas sobreviventes), via o mesmo caminho de
   * escrita normal (`updateProject` → `saveProjectTree`). */
  const restoreActivityWithTasks = useCallback(
    (projectId: string, previousProject: Project) => {
      updateProject(projectId, () => previousProject);
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
          confirmedByAdmin: true,
          rejected: false,
          rejectionCount: 0,
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
   * "Informar real" (Fase 5, Commit 2; virou RPC atômica na Fase 7+) — único caminho de escrita
   * que um usuário sem privilégio de administrador pode alcançar depois do Commit 4: atualiza só
   * `actual_start`/`actual_end`/`confirmed_by_admin`/`rejected` (`informarDataReal`,
   * `projectsRepo.ts`), nunca a árvore inteira do projeto. Local otimista primeiro (UI não espera
   * a rede), corrigido pelo `confirmedByAdmin` que a RPC devolve assim que a resposta chega —
   * evita depender de um refetch pra saber se a finalização precisa de confirmação do
   * administrador. `rejected` some sozinho (espelha a mesma regra da RPC) quando o novo
   * `actualEnd` não é vazio — ressubmissão supera uma reprovação anterior. Refetch de
   * `replanejamentos` no final: essa RPC grava linha(s) de log (Fase 7+), sem isso o histórico no
   * painel da tarefa só apareceria depois de um refresh manual.
   */
  const updateTaskActualDates = useCallback(
    (projectId: string, taskId: string, patch: { actualStart?: string; actualEnd?: string }) => {
      const project = rawProjects.find((p) => p.id === projectId);
      const oldTask = project?.activities.flatMap((a) => a.tasks).find((t) => t.id === taskId);
      const resolved = resolveActualDatesPatch(oldTask ?? {}, patch);

      updateProjectLocal(projectId, (proj) => ({
        ...proj,
        activities: proj.activities.map((a) => ({
          ...a,
          tasks: a.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        })),
      }));

      informarDataReal(taskId, resolved.actualStart, resolved.actualEnd)
        .then((confirmedByAdmin) => {
          updateProjectLocal(projectId, (proj) => ({
            ...proj,
            activities: proj.activities.map((a) => ({
              ...a,
              tasks: a.tasks.map((t) =>
                t.id === taskId ? { ...t, confirmedByAdmin, rejected: resolved.actualEnd ? false : t.rejected } : t,
              ),
            })),
          }));
          return refetchReplanejamentos();
        })
        .catch((err) => console.error('Falha ao informar data real no Supabase', err));
    },
    [rawProjects, updateProjectLocal, refetchReplanejamentos],
  );

  /** "Observação" (aba Importação, pedido do usuário) — texto livre por tarefa, editável por
   * qualquer papel, igual "informar real". Local otimista + escrita estreita direto na coluna
   * (sem RPC, sem log — `updateTaskObservacao`, `projectsRepo.ts`). */
  const updateTaskObservacao = useCallback(
    (projectId: string, taskId: string, observacao: string) => {
      updateProjectLocal(projectId, (proj) => ({
        ...proj,
        activities: proj.activities.map((a) => ({
          ...a,
          tasks: a.tasks.map((t) => (t.id === taskId ? { ...t, observacao } : t)),
        })),
      }));
      updateTaskObservacaoRemote(taskId, observacao).catch((err) =>
        console.error('Falha ao salvar observação no Supabase', err),
      );
    },
    [updateProjectLocal],
  );

  /** Administrador reprova a finalização marcada por usuário comum (pedido do usuário: "quando
   * eu não aprovar quero uma tratativa... apaga a data final até a pessoa colocar novamente") —
   * `motivo` é a "tratativa", obrigatória (a RPC também barra vazio). Reaproveita o mesmo log de
   * `replanejamentos` de "informar real" (campo='real', campo_data='fim', de=data antiga,
   * para=null) — o histórico da tarefa mostra a reprovação junto com o resto, sem tabela nova. */
  const rejectTaskCompletion = useCallback(
    (projectId: string, taskId: string, motivo: string): ReplanValidation => {
      if (!motivo.trim()) return { valid: false, errors: ['Informe o motivo da reprovação.'] };
      const project = rawProjects.find((p) => p.id === projectId);
      const task = project?.activities.flatMap((a) => a.tasks).find((t) => t.id === taskId);
      if (!task) return { valid: false, errors: ['Tarefa não encontrada.'] };

      updateProjectLocal(projectId, (p) => ({
        ...p,
        activities: p.activities.map((a) => ({
          ...a,
          tasks: a.tasks.map((t) =>
            t.id === taskId
              ? { ...t, actualEnd: undefined, confirmedByAdmin: true, rejected: true, rejectionCount: t.rejectionCount + 1 }
              : t,
          ),
        })),
      }));

      reprovarFinalizacao(taskId, motivo.trim())
        .then(refetchReplanejamentos)
        .catch((err) => console.error('Falha ao reprovar finalização no Supabase', err));

      return { valid: true, errors: [] };
    },
    [rawProjects, updateProjectLocal, refetchReplanejamentos],
  );

  /** Administrador confirma a finalização de uma tarefa marcada por usuário comum (pedido do
   * usuário: "o adm confirme a finalização") — reaproveita `informar_data_real` passando as
   * mesmas datas já gravadas (nenhum campo muda de verdade, então não gera linha nova no log),
   * só pra virar `confirmed_by_admin = true`. Vazio quando a tarefa ainda não existe (defensivo,
   * mesmo padrão de `replanTask`/`setTaskPredecessors`). */
  const confirmTaskCompletion = useCallback(
    (projectId: string, taskId: string) => {
      const project = rawProjects.find((p) => p.id === projectId);
      const task = project?.activities.flatMap((a) => a.tasks).find((t) => t.id === taskId);
      if (!task) return;
      updateTaskActualDates(projectId, taskId, { actualStart: task.actualStart, actualEnd: task.actualEnd });
    },
    [rawProjects, updateTaskActualDates],
  );

  /**
   * Muda o previsto de uma tarefa, com motivo obrigatório sempre que algo realmente mudou (Fase
   * 2.5) — ao lado de `updateTask`, não substituindo: nome/categoria/responsável/real/
   * predecessoras continuam sem motivo, `updateTask` continua servindo pra eles. Base não entra
   * mais aqui desde a Fase 4 (travada pra todos, inclusive administrador — decisão revertida da
   * spec original). Quem decide se motivo é obrigatório é a própria função (computeDateChanges +
   * validateReplanMotivo), não quem chama.
   *
   * Escrita remota via `replanTaskAtomic` (RPC `replanejar_tarefa`, Fase 5 Commit 2) — atualiza
   * `tasks` e grava o log em `replanejamentos` na MESMA transação Postgres, ao contrário do par
   * `updateTask`+`insertReplanejamentos` de antes (duas chamadas independentes, não atômicas).
   */
  const replanTask = useCallback(
    (
      projectId: string,
      taskId: string,
      patch: Partial<Pick<Task, 'plannedStart' | 'plannedEnd' | 'baseStart' | 'baseEnd'>>,
      motivo: string,
      isAdmin: boolean,
    ): ReplanValidation => {
      const project = rawProjects.find((p) => p.id === projectId);
      if (!project) return { valid: false, errors: ['Projeto não encontrado.'] };
      const oldTask = project.activities.flatMap((a) => a.tasks).find((t) => t.id === taskId);
      if (!oldTask) return { valid: false, errors: ['Tarefa não encontrada.'] };

      const changes = computeDateChanges(oldTask, patch);
      const validation = validateReplanMotivo(changes, motivo, isAdmin);
      if (!validation.valid) return validation;

      const plannedStart = patch.plannedStart ?? oldTask.plannedStart;
      const plannedEnd = patch.plannedEnd ?? oldTask.plannedEnd;
      const baseStart = patch.baseStart ?? oldTask.baseStart;
      const baseEnd = patch.baseEnd ?? oldTask.baseEnd;

      updateProjectLocal(projectId, (p) => ({
        ...p,
        activities: p.activities.map((a) => ({
          ...a,
          tasks: a.tasks.map((t) => (t.id === taskId ? { ...t, plannedStart, plannedEnd, baseStart, baseEnd } : t)),
        })),
      }));
      // baseStart/baseEnd só são enviados quando de fato mudaram — patch.baseStart/baseEnd
      // continuam undefined nos replans comuns (só previsto), a RPC mantém a base intacta nesse
      // caso (coalesce contra o valor atual).
      replanTaskAtomic(taskId, plannedStart, plannedEnd, motivo.trim(), patch.baseStart, patch.baseEnd)
        .then(refetchReplanejamentos)
        .catch((err) => console.error('Falha ao replanejar tarefa no Supabase', err));
      return { valid: true, errors: [] };
    },
    [rawProjects, updateProjectLocal, refetchReplanejamentos],
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
    refetch,
    createProject,
    removeProject,
    restoreProject,
    updateProjectInfo,
    updateActivityName,
    addActivity,
    addActivityWithTasks,
    removeActivity,
    removeActivityWithTasks,
    restoreActivityWithTasks,
    addTask,
    updateTask,
    updateTaskActualDates,
    updateTaskObservacao,
    confirmTaskCompletion,
    rejectTaskCompletion,
    replanTask,
    removeTask,
    reorderTask,
    setTaskPredecessors,
  };
}

const ProjectsContext = createContext<ReturnType<typeof useProjectsState> | undefined>(undefined);

/** Monta `useProjectsState()` uma vez só, no topo da árvore (`App.tsx`, dentro de
 * `ProtectedRoute`) — todo consumidor de `useProjects()` passa a enxergar a MESMA instância viva,
 * em vez de cada tela buscar sua própria cópia (ver comentário de `useProjectsState`). `createElement`
 * em vez de JSX porque este arquivo é `.ts`, não `.tsx`. */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const state = useProjectsState();
  return createElement(ProjectsContext.Provider, { value: state }, children);
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects precisa ser chamado dentro de <ProjectsProvider>.');
  return ctx;
}
