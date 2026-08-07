import { useState } from 'react';
import { Button, Card, FormField, Input } from '../ui';
import type { CategoryEntry } from '../../types';
import type { CategoryInput } from '../../hooks';

interface CategoryFormProps {
  entry: CategoryEntry | null;
  onSave: (input: CategoryInput) => void;
  onCancel: () => void;
}

export function CategoryForm({ entry, onSave, onCancel }: CategoryFormProps) {
  const [label, setLabel] = useState(entry?.label ?? '');
  const [color, setColor] = useState(entry?.color ?? '#2563EB');

  function handleSave() {
    if (!label.trim()) return;
    onSave({ label: label.trim(), color });
  }

  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold text-text">{entry ? 'Editar categoria' : 'Nova categoria'}</p>
      <div className="flex items-end gap-4">
        <FormField label="Nome" required className="flex-1">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full" />
        </FormField>
        <FormField label="Cor">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-16 cursor-pointer rounded border border-border bg-white"
          />
        </FormField>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Salvar
        </Button>
      </div>
    </Card>
  );
}
