import { useCallback, useEffect, useState } from 'react';
import { deleteTemplateRemote, fetchCatalog, saveTemplate } from '../services/catalogRepo';
import type { ActivityTemplate, Category } from '../types';

// IDs precisam ser UUIDs válidos: são gravados direto nas colunas `uuid` do Supabase.
function uid(): string {
  return crypto.randomUUID();
}

export interface CatalogEntryInput {
  name: string;
  category: Category;
  tasks: string[];
  active: boolean;
}

export function useCatalog() {
  const [catalog, setCatalog] = useState<ActivityTemplate[]>([]);

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch((err) => console.error('Falha ao carregar catálogo do Supabase', err));
  }, []);

  const createEntry = useCallback((input: CatalogEntryInput) => {
    const entry: ActivityTemplate = {
      id: uid(),
      name: input.name,
      category: input.category,
      active: input.active,
      tasks: input.tasks.map((name) => ({ id: uid(), name })),
    };
    setCatalog((current) => [...current, entry]);
    saveTemplate(entry).catch((err) => console.error('Falha ao salvar item do catálogo no Supabase', err));
  }, []);

  const updateEntry = useCallback((id: string, input: CatalogEntryInput) => {
    setCatalog((current) => {
      const next = current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              name: input.name,
              category: input.category,
              active: input.active,
              tasks: input.tasks.map((name) => ({ id: uid(), name })),
            }
          : entry,
      );
      const updated = next.find((entry) => entry.id === id);
      if (updated) saveTemplate(updated).catch((err) => console.error('Falha ao salvar item do catálogo no Supabase', err));
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setCatalog((current) => current.filter((entry) => entry.id !== id));
    deleteTemplateRemote(id).catch((err) => console.error('Falha ao excluir item do catálogo no Supabase', err));
  }, []);

  const toggleActive = useCallback((id: string) => {
    setCatalog((current) => {
      const next = current.map((entry) => (entry.id === id ? { ...entry, active: !entry.active } : entry));
      const updated = next.find((entry) => entry.id === id);
      if (updated) saveTemplate(updated).catch((err) => console.error('Falha ao salvar item do catálogo no Supabase', err));
      return next;
    });
  }, []);

  return { catalog, createEntry, updateEntry, removeEntry, toggleActive };
}
