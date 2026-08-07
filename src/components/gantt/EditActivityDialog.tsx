import { useState } from 'react';
import { Button, Card, FormField, Input } from '../ui';
import type { Activity } from '../../types';

interface EditActivityDialogProps {
  activity: Activity | null;
  onSave: (patch: { name: string }) => void;
  onCancel: () => void;
}

export function EditActivityDialog({ activity, onSave, onCancel }: EditActivityDialogProps) {
  const [name, setName] = useState(activity?.name ?? '');

  if (!activity) return null;

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-sm font-semibold text-text">Editar atividade</p>
        <FormField label="Nome da atividade" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
        </FormField>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Salvar
          </Button>
        </div>
      </Card>
    </div>
  );
}
