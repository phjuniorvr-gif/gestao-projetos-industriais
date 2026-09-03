import { useCallback, useEffect, useState } from 'react';
import { fetchCategories, saveCategory } from '../services/categoriesRepo';
import type { CategoryEntry } from '../types';

function uid(): string {
  return crypto.randomUUID();
}

export interface CategoryInput {
  label: string;
  color: string;
}

export function useCategories() {
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => console.error('Falha ao carregar categorias do Supabase', err))
      .finally(() => setLoaded(true));
  }, []);

  const createCategory = useCallback((input: CategoryInput) => {
    setCategories((current) => {
      const entry: CategoryEntry = { id: uid(), label: input.label, color: input.color, position: current.length };
      saveCategory(entry).catch((err) => console.error('Falha ao salvar categoria no Supabase', err));
      return [...current, entry];
    });
  }, []);

  const updateCategory = useCallback((id: string, input: CategoryInput) => {
    setCategories((current) => {
      const next = current.map((c) => (c.id === id ? { ...c, label: input.label, color: input.color } : c));
      const updated = next.find((c) => c.id === id);
      if (updated) saveCategory(updated).catch((err) => console.error('Falha ao salvar categoria no Supabase', err));
      return next;
    });
  }, []);

  return { categories, loaded, createCategory, updateCategory };
}
