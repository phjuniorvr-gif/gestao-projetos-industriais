import { RotateCcw, Trash2 } from 'lucide-react';
import type { Person, Project } from '../../types';
import { formatDatePtBr } from '../../utils';
import { Card } from '../ui';

interface DeletedProjectCardProps {
  project: Project;
  people: Person[];
  onRestore: (project: Project) => void;
  onDeletePermanently: (project: Project) => void;
}

export function DeletedProjectCard({ project, people, onRestore, onDeletePermanently }: DeletedProjectCardProps) {
  const gerente = people.find((p) => p.id === project.gerenteId);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <p className="font-semibold text-text">
            {project.code} — {project.name}
          </p>
          <p className="text-xs text-text-muted">
            {project.unit || project.sector} · {gerente?.name || 'Sem gerente'}
          </p>
        </div>

        <div className="text-xs text-text-muted">Excluído em {formatDatePtBr(project.deletedAt?.slice(0, 10))}</div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onRestore(project)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-action hover:bg-action/10"
          >
            <RotateCcw className="h-4 w-4" /> Restaurar
          </button>
          <button
            type="button"
            onClick={() => onDeletePermanently(project)}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium text-status-delayed hover:bg-status-delayed/10"
          >
            <Trash2 className="h-4 w-4" /> Excluir definitivamente
          </button>
        </div>
      </div>
    </Card>
  );
}
