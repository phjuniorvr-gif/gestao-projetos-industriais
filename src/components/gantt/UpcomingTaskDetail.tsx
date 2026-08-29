import { useState } from 'react';
import { ConfirmDialog } from '../ui';
import { TaskPanel } from './TaskPanel';
import { RejectTaskDialog } from './RejectTaskDialog';
import type { useUpcomingTasksData } from '../../hooks';
import type { TaskView } from '../../types';

interface UpcomingTaskDetailProps {
  data: ReturnType<typeof useUpcomingTasksData>;
  selectedTaskId: string | null;
  onClose: () => void;
  isMobile: boolean;
}

/** `TaskPanel` + `ConfirmDialog` de exclusão + `RejectTaskDialog` de reprovação, já ligados aos
 * callbacks de `useUpcomingTasksData` — extraído pra ser reaproveitado sem duplicar entre
 * `UpcomingTasksPage.tsx` (desktop), `MobileUpcomingTasksPage.tsx` e `PendingConfirmationsPage.tsx`,
 * que só diferem em como a lista é apresentada, não em como uma tarefa é aberta/editada/excluída/
 * reprovada. */
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
    rejectTaskCompletion,
    setTaskPredecessors,
    replanTask,
    removeTask,
  } = data;
  const [deletingTask, setDeletingTask] = useState<TaskView | null>(null);
  const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null);

  const selectedTask = selectedTaskId ? (allTasks.find((t) => t.id === selectedTaskId) ?? null) : null;
  const selectedTaskProject = projects.find((p) => p.id === activityIdToProjectId.get(selectedTask?.activityId ?? ''));
  const selectedTaskDependentCount = selectedTask
    ? allTasks.filter((t) => t.dependencies.some((d) => d.predecessorId === selectedTask.id)).length
    : 0;
  const rejectingTask = rejectingTaskId ? (allTasks.find((t) => t.id === rejectingTaskId) ?? null) : null;

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
        unit={selectedTaskProject?.unit ?? ''}
        projectName={selectedTaskProject ? `${selectedTaskProject.code} — ${selectedTaskProject.name}` : undefined}
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
        onRequestReject={(taskId) => setRejectingTaskId(taskId)}
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

      <RejectTaskDialog
        open={Boolean(rejectingTask)}
        taskName={rejectingTask?.name ?? ''}
        onCancel={() => setRejectingTaskId(null)}
        onConfirm={(motivo) => {
          const owningProjectId = rejectingTask ? activityIdToProjectId.get(rejectingTask.activityId) : undefined;
          if (!rejectingTask || !owningProjectId) return { valid: false, errors: ['Tarefa não encontrada.'] };
          const result = rejectTaskCompletion(owningProjectId, rejectingTask.id, motivo);
          if (result.valid) setRejectingTaskId(null);
          return result;
        }}
      />
    </>
  );
}
