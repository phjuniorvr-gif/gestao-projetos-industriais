import { useState } from 'react';
import { ConfirmDialog } from '../ui';
import { TaskPanel } from './TaskPanel';
import type { useUpcomingTasksData } from '../../hooks';
import type { TaskView } from '../../types';

interface UpcomingTaskDetailProps {
  data: ReturnType<typeof useUpcomingTasksData>;
  selectedTaskId: string | null;
  onClose: () => void;
  isMobile: boolean;
}

/** `TaskPanel` + `ConfirmDialog` de exclusão, já ligados aos callbacks de `useUpcomingTasksData`
 * — extraído pra ser reaproveitado sem duplicar entre `UpcomingTasksPage.tsx` (desktop) e
 * `MobileUpcomingTasksPage.tsx`, que só diferem em como a lista é apresentada (tabela x cards),
 * não em como uma tarefa é aberta/editada/excluída. */
export function UpcomingTaskDetail({ data, selectedTaskId, onClose, isMobile }: UpcomingTaskDetailProps) {
  const {
    projects,
    allTasks,
    activityIdToProjectId,
    categories,
    holidays,
    people,
    createPerson,
    replanejamentos,
    isAdmin,
    updateTask,
    updateTaskActualDates,
    confirmTaskCompletion,
    setTaskPredecessors,
    replanTask,
    removeTask,
  } = data;
  const [deletingTask, setDeletingTask] = useState<TaskView | null>(null);

  const selectedTask = selectedTaskId ? (allTasks.find((t) => t.id === selectedTaskId) ?? null) : null;
  const selectedTaskDependentCount = selectedTask
    ? allTasks.filter((t) => t.dependencies.some((d) => d.predecessorId === selectedTask.id)).length
    : 0;

  return (
    <>
      <TaskPanel
        task={selectedTask}
        isMobile={isMobile}
        allTasks={allTasks}
        categories={categories}
        people={people}
        replanejamentos={replanejamentos}
        isAdmin={isAdmin}
        holidays={holidays}
        unit={projects.find((p) => p.id === activityIdToProjectId.get(selectedTask?.activityId ?? ''))?.unit ?? ''}
        onCreatePerson={createPerson}
        onClose={onClose}
        onSave={(taskId, patch) => {
          const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
          if (!owningProjectId) return;
          updateTask(owningProjectId, taskId, patch);
        }}
        onSaveActual={(taskId, patch) => {
          const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
          if (!owningProjectId) return;
          updateTaskActualDates(owningProjectId, taskId, patch);
        }}
        onConfirmCompletion={(taskId) => {
          const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
          if (owningProjectId) confirmTaskCompletion(owningProjectId, taskId);
        }}
        onSetPredecessors={(taskId, entries) => {
          const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
          if (!owningProjectId) return { valid: false, errors: ['Projeto não encontrado.'] };
          return setTaskPredecessors(owningProjectId, taskId, entries);
        }}
        onReplan={(taskId, patch, motivo) => {
          const owningProjectId = activityIdToProjectId.get(allTasks.find((t) => t.id === taskId)?.activityId ?? '');
          if (!owningProjectId) return { valid: false, errors: ['Projeto não encontrado.'] };
          return replanTask(owningProjectId, taskId, patch, motivo, isAdmin === true);
        }}
        dependentCount={selectedTaskDependentCount}
        onDelete={(taskId) => {
          const task = allTasks.find((t) => t.id === taskId);
          if (task) setDeletingTask(task);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingTask)}
        title="Excluir tarefa"
        message={deletingTask ? `Tem certeza que deseja excluir "${deletingTask.name}"?` : ''}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeletingTask(null)}
        onConfirm={() => {
          const owningProjectId = deletingTask ? activityIdToProjectId.get(deletingTask.activityId) : undefined;
          if (deletingTask && owningProjectId) removeTask(owningProjectId, deletingTask.id);
          setDeletingTask(null);
          onClose();
        }}
      />
    </>
  );
}
