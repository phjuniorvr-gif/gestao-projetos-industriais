import { useState } from 'react';
import { PageHeader } from '../components/layout';
import { DeletedProjectCard } from '../components/projects';
import { ConfirmDialog, EmptyState, Skeleton } from '../components/ui';
import { useDeletedProjects, usePeople } from '../hooks';
import type { Project } from '../types';

export function DeletedProjectsPage() {
  const { projects, loaded, restoreProject, permanentlyDeleteProject } = useDeletedProjects();
  const { people } = usePeople();
  const [deleting, setDeleting] = useState<Project | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Excluídos" subtitle="Projetos removidos, com a data em que foram excluídos" />

      {!loaded ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState title="Nenhum projeto excluído" description="Projetos excluídos aparecem aqui até serem restaurados ou removidos definitivamente." />
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <DeletedProjectCard
              key={project.id}
              project={project}
              people={people}
              onRestore={(p) => restoreProject(p.id)}
              onDeletePermanently={setDeleting}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir definitivamente"
        message={
          deleting
            ? `Tem certeza que deseja excluir ${deleting.code} — ${deleting.name} definitivamente? Essa ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir definitivamente"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) permanentlyDeleteProject(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
