import { useState } from 'react';
import { Button, Card, FormField, Input, Textarea } from '../ui';
import { PersonSelect } from '../shared/PersonSelect';
import type { Person, Project } from '../../types';

interface EditProjectDialogProps {
  project: Project | null;
  people: Person[];
  onCreatePerson: (name: string) => Promise<Person>;
  onSave: (patch: Pick<Project, 'name' | 'description' | 'unit' | 'gerenteId'>) => void;
  onCancel: () => void;
}

export function EditProjectDialog({ project, people, onCreatePerson, onSave, onCancel }: EditProjectDialogProps) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [unit, setUnit] = useState(project?.unit ?? '');
  const [gerenteId, setGerenteId] = useState(project?.gerenteId);

  if (!project) return null;

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() || undefined, unit: unit.trim(), gerenteId });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-sm font-semibold text-text">
          Editar projeto — {project.code}
        </p>
        <div className="space-y-3">
          <FormField label="Nome do projeto" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" />
          </FormField>
          <FormField label="Descrição / observação">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full" />
          </FormField>
          <FormField label="Unidade">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full" />
          </FormField>
          <FormField label="Gerente do projeto">
            <PersonSelect
              value={gerenteId}
              onChange={setGerenteId}
              people={people}
              onCreatePerson={onCreatePerson}
              placeholder="Sem gerente"
            />
          </FormField>
        </div>
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
