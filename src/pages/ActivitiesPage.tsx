import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { Badge, Button, Card, ConfirmDialog, EmptyState } from '../components/ui';
import { CatalogEntryForm } from '../components/catalog';
import { useCatalog } from '../hooks';
import { CATEGORY_LABEL, type ActivityTemplate } from '../types';

export function ActivitiesPage() {
  const { catalog, createEntry, updateEntry, removeEntry, toggleActive } = useCatalog();
  const [editing, setEditing] = useState<ActivityTemplate | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ActivityTemplate | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atividades"
        subtitle="Catálogo padrão de atividades, categorias e tarefas"
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Nova combinação
          </Button>
        }
      />

      {editing && (
        <CatalogEntryForm
          entry={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(input) => {
            if (editing === 'new') createEntry(input);
            else updateEntry(editing.id, input);
            setEditing(null);
          }}
        />
      )}

      {catalog.length === 0 ? (
        <EmptyState title="Nenhuma combinação cadastrada" description="Crie a primeira combinação de atividade e categoria." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page/60 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                <th className="px-4 py-2.5">Atividade</th>
                <th className="px-4 py-2.5">Categoria</th>
                <th className="px-4 py-2.5">Tarefas</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((entry) => (
                <tr key={entry.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-text">{entry.name}</td>
                  <td className="px-4 py-2.5 text-text-muted">{CATEGORY_LABEL[entry.category]}</td>
                  <td className="px-4 py-2.5 text-text-muted">{entry.tasks.length}</td>
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => toggleActive(entry.id)}>
                      <Badge color={entry.active ? '#22C55E' : '#A3A3A3'}>{entry.active ? 'Ativo' : 'Inativo'}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(entry)}
                        className="rounded-md p-2 text-text-muted hover:bg-page hover:text-text"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(entry)}
                        className="rounded-md p-2 text-text-muted hover:bg-status-delayed/10 hover:text-status-delayed"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir combinação"
        message={deleting ? `Excluir "${deleting.name}" + "${CATEGORY_LABEL[deleting.category]}"?` : ''}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeEntry(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
