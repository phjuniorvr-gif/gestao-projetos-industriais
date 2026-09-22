import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { Button, Card, ConfirmDialog, EmptyState } from '../components/ui';
import { CategoryForm } from '../components/categories';
import { useCategories, usePerfil, useProjects } from '../hooks';
import type { CategoryEntry } from '../types';

export function CategoriesPage() {
  const { categories, createCategory, updateCategory, removeCategory } = useCategories();
  const { projects } = useProjects();
  const isAdmin = usePerfil();
  const [editing, setEditing] = useState<CategoryEntry | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CategoryEntry | null>(null);

  // Quantas tarefas do portfólio inteiro usam cada categoria — insumo do aviso na exclusão (não
  // trava mais, ver decisão da sessão: quase toda categoria real tinha alguma tarefa, travar
  // deixava a lixeira sempre desabilitada).
  const taskCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects)
      for (const a of p.activities)
        for (const t of a.tasks) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    return counts;
  }, [projects]);

  // Quantas ATIVIDADES (não tarefa) têm ao menos 1 tarefa da categoria — pedido do usuário, coluna
  // "Atividades" da tabela abaixo. Categoria mora na tarefa (`Task.category`), não na atividade
  // (Fase 2.1) — uma atividade "tem" a categoria quando QUALQUER uma das suas tarefas usa.
  const activityCountByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects)
      for (const a of p.activities) {
        const categoriesInActivity = new Set(a.tasks.map((t) => t.category));
        for (const categoryId of categoriesInActivity) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
      }
    return counts;
  }, [projects]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        subtitle="Categorias usadas nas tarefas dos projetos"
        actions={
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Nova categoria
          </Button>
        }
      />

      {editing && (
        <CategoryForm
          entry={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(input) => {
            if (editing === 'new') createCategory(input);
            else updateCategory(editing.id, input);
            setEditing(null);
          }}
        />
      )}

      {categories.length === 0 ? (
        <EmptyState title="Nenhuma categoria cadastrada" description="Crie a primeira categoria para usar nas tarefas." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-page/60 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                <th className="px-4 py-2.5">Cor</th>
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5 text-right">Atividades</th>
                <th className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <span
                      className="inline-block h-4 w-4 rounded-full border border-border"
                      style={{ backgroundColor: category.color }}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-text">{category.label}</td>
                  <td className="px-4 py-2.5 text-right text-text-muted">
                    {activityCountByCategory.get(category.id) ?? 0}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(category)}
                        className="rounded-md p-2 text-text-muted hover:bg-page hover:text-text"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {isAdmin === true && (
                        <button
                          type="button"
                          onClick={() => setDeleting(category)}
                          className="rounded-md p-2 text-text-muted hover:bg-page hover:text-status-delayed"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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
        title="Excluir categoria"
        message={(() => {
          const count = deleting ? (taskCountByCategory.get(deleting.id) ?? 0) : 0;
          const aviso =
            count > 0
              ? ` Atenção: ${count} tarefa${count === 1 ? '' : 's'} usa${count === 1 ? '' : 'm'} essa categoria e ficará${count === 1 ? '' : 'ão'} sem categoria.`
              : '';
          return `Tem certeza que deseja excluir a categoria "${deleting?.label ?? ''}"?${aviso} Essa ação não pode ser desfeita.`;
        })()}
        confirmLabel="Excluir"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) removeCategory(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
