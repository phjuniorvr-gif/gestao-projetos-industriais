import { useState } from 'react';
import { Button, Card, FormField, Input } from '../ui';
import type { Project } from '../../types';

interface AddActivityDialogProps {
  project: Project | null;
  onAdd: (name: string) => void;
  onCancel: () => void;
}

export function AddActivityDialog({ project, onAdd, onCancel }: AddActivityDialogProps) {
  const [name, setName] = useState('');

  if (!project) return null;

  function handleAdd() {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-sm font-semibold text-text">
          Nova atividade — {project.code}
        </p>
        <FormField label="Nome da atividade" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" autoFocus />
        </FormField>
        <p className="mt-2 text-xs text-text-muted">
          As datas da atividade são calculadas a partir das tarefas que você adicionar a ela depois.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            Adicionar
          </Button>
        </div>
      </Card>
    </div>
  );
}
