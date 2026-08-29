import { useCallback, useEffect, useState } from 'react';
import { createPerson as createPersonRemote, fetchPeople, updatePerson as updatePersonRemote } from '../services/peopleRepo';
import type { Person } from '../types';

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    fetchPeople()
      .then(setPeople)
      .catch((err) => console.error('Falha ao carregar pessoas do Supabase', err));
  }, []);

  // Confere no estado já carregado antes de bater no banco — o repo faz a mesma checagem
  // (mais o índice único como defesa final), então isto é só um atalho pro caso comum.
  const createPerson = useCallback(
    async (name: string): Promise<Person> => {
      const target = normalize(name);
      const existing = people.find((p) => normalize(p.name) === target);
      if (existing) return existing;

      const created = await createPersonRemote(name);
      setPeople((current) => (current.some((p) => p.id === created.id) ? current : [...current, created]));
      return created;
    },
    [people],
  );

  // `userId: null` desvincula de propósito (a pessoa deixa de ter login associado) — diferente de
  // `undefined`, que significa "não mexer nesse campo" (mesma convenção de patch parcial de sempre).
  const updatePerson = useCallback(async (id: string, patch: { name?: string; active?: boolean; userId?: string | null }) => {
    await updatePersonRemote(id, patch);
    setPeople((current) =>
      current.map((p) =>
        p.id === id
          ? {
              ...p,
              name: patch.name ?? p.name,
              active: patch.active ?? p.active,
              userId: patch.userId === null ? undefined : (patch.userId ?? p.userId),
            }
          : p,
      ),
    );
  }, []);

  return { people, createPerson, updatePerson };
}
