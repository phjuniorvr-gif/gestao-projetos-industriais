import { useCallback, useEffect, useState } from 'react';
import { SEED_CATALOG } from '../data/seed';
import { getItem, setItem, STORAGE_KEYS } from '../services/storage';
import type { ActivityTemplate, Category } from '../types';

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
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
    const stored = getItem<ActivityTemplate[] | null>(STORAGE_KEYS.catalog, null);
    if (stored) {
      setCatalog(stored);
    } else {
      setCatalog(SEED_CATALOG);
      setItem(STORAGE_KEYS.catalog, SEED_CATALOG);
    }
  }, []);

  const persist = useCallback((next: ActivityTemplate[]) => {
    setCatalog(next);
    setItem(STORAGE_KEYS.catalog, next);
  }, []);

  const createEntry = useCallback(
    (input: CatalogEntryInput) => {
      const entry: ActivityTemplate = {
        id: uid('template'),
        name: input.name,
        category: input.category,
        active: input.active,
        tasks: input.tasks.map((name) => ({ id: uid('template-task'), name })),
      };
      persist([...catalog, entry]);
    },
    [catalog, persist],
  );

  const updateEntry = useCallback(
    (id: string, input: CatalogEntryInput) => {
      persist(
        catalog.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                name: input.name,
                category: input.category,
                active: input.active,
                tasks: input.tasks.map((name) => ({ id: uid('template-task'), name })),
              }
            : entry,
        ),
      );
    },
    [catalog, persist],
  );

  const removeEntry = useCallback(
    (id: string) => {
      persist(catalog.filter((entry) => entry.id !== id));
    },
    [catalog, persist],
  );

  const toggleActive = useCallback(
    (id: string) => {
      persist(catalog.map((entry) => (entry.id === id ? { ...entry, active: !entry.active } : entry)));
    },
    [catalog, persist],
  );

  return { catalog, createEntry, updateEntry, removeEntry, toggleActive };
}
