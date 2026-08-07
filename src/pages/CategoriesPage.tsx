import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { PageHeader } from '../components/layout';
import { Button, Card, EmptyState } from '../components/ui';
import { CategoryForm } from '../components/categories';
import { useCategories } from '../hooks';
import type { CategoryEntry } from '../types';

export function CategoriesPage() {
  const { categories, createCategory, updateCategory } = useCategories();
  const [editing, setEditing] = useState<CategoryEntry | 'new' | null>(null);

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
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditing(category)}
                        className="rounded-md p-2 text-text-muted hover:bg-page hover:text-text"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
