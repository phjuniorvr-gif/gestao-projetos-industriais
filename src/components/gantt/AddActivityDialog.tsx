import { useEffect, useState } from 'react';
import { Button, Card, FormField, Input, Select } from '../ui';
import type { Project } from '../../types';

interface AddActivityDialogProps {
  open: boolean;
  projects: Project[];
  /** Presente quando aberto pelo "+" da linha do projeto — pula o seletor, igual ao
   * comportamento de sempre. Ausente quando aberto pelo "＋ Novo item" do topo da página (Fase 4,
   * Commit 6) — cobre o caso da linha-alvo não estar visível na tela; aí o seletor aparece. */
  initialProjectId?: string;
  onAdd: (projectId: string, name: string) => void;
  onCancel: () => void;
}

export function AddActivityDialog({ open, projects, initialProjectId, onAdd, onCancel }: AddActivityDialogProps) {
  const [projectId, setProjectId] = useState(initialProjectId ?? '');
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setProjectId(initialProjectId ?? '');
  }, [open, initialProjectId]);

  if (!open) return null;

  const project = projects.find((p) => p.id === projectId);

  function handleAdd() {
    if (!projectId || !name.trim()) return;
    onAdd(projectId, name.trim());
    setName('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onCancel}>
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <p className="mb-4 text-sm font-semibold text-text">Nova atividade{project ? ` — ${project.code}` : ''}</p>
        {!initialProjectId && (
          <FormField label="Projeto" required>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full" autoFocus>
              <option value="">Selecione um projeto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Nome da atividade" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full"
            autoFocus={Boolean(initialProjectId)}
          />
        </FormField>
        <p className="mt-2 text-xs text-text-muted">
          As datas da atividade são calculadas a partir das tarefas que você adicionar a ela depois.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleAdd} disabled={!projectId || !name.trim()}>
            Adicionar
          </Button>
        </div>
      </Card>
    </div>
  );
}
