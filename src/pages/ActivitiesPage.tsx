import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { Badge, Button, Card, ConfirmDialog, EmptyState, FormField, Select } from '../components/ui';
import { CatalogEntryForm } from '../components/catalog';
import { useCatalog, useCategories } from '../hooks';
import type { ActivityTemplate } from '../types';

const ALL_CATEGORIES = '';

export function ActivitiesPage() {
  const navigate = useNavigate();
  const { catalog, createEntry, updateEntry, removeEntry, toggleActive } = useCatalog();
  const { categories } = useCategories();
  const [editing, setEditing] = useState<ActivityTemplate | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ActivityTemplate | null>(null);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const categoryLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id;

  const filteredCatalog = useMemo(
    () =>
      selectedCategory === ALL_CATEGORIES
        ? catalog
        : catalog.filter((entry) => entry.category === selectedCategory),
    [catalog, selectedCategory],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Atividades"
        subtitle="Catálogo padrão de atividades e tarefas por categoria"
        actions={
          <>
            <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(-1)}>
              Voltar
            </Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              Nova atividade
            </Button>
          </>
        }
      />

      <Card className="max-w-xs p-4">
        <FormField label="Categoria">
          <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full">
            <option value={ALL_CATEGORIES}>Todos</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </FormField>
      </Card>

      {editing && (
        <CatalogEntryForm
          entry={editing === 'new' ? null : editing}
          categories={categories}
          defaultCategory={selectedCategory || categories[0]?.id}
          onCancel={() => setEditing(null)}
          onSave={(input) => {
            if (editing === 'new') createEntry(input);
            else updateEntry(editing.id, input);
            setEditing(null);
          }}
        />
      )}

      {filteredCatalog.length === 0 ? (
        <EmptyState
          title="Nenhuma atividade cadastrada"
          description="Crie a primeira atividade desta categoria."
        />
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
              {filteredCatalog.map((entry) => {
                const expanded = expandedIds.has(entry.id);
                return (
                  <Fragment key={entry.id}>
                    <tr className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 text-text">{entry.name}</td>
                      <td className="px-4 py-2.5 text-text-muted">{categoryLabel(entry.category)}</td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(entry.id)}
                          className="inline-flex items-center gap-1 text-text-muted hover:text-action"
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {entry.tasks.length} {entry.tasks.length === 1 ? 'tarefa' : 'tarefas'}
                        </button>
                      </td>
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
                    {expanded && (
                      <tr className="border-b border-border bg-page/40 last:border-0">
                        <td colSpan={5} className="px-4 py-3">
                          {entry.tasks.length === 0 ? (
                            <p className="text-xs text-text-muted">Nenhuma tarefa cadastrada.</p>
                          ) : (
                            <ol className="grid grid-cols-2 gap-1.5 pl-4 text-xs text-text-muted">
                              {entry.tasks.map((task) => (
                                <li key={task.id} className="list-decimal">
                                  {task.name}
                                </li>
                              ))}
                            </ol>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir atividade"
        message={deleting ? `Excluir "${deleting.name}"?` : ''}
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
