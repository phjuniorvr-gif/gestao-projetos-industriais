import { useState } from 'react';
import { Input, Select } from '../ui';
import type { Person } from '../../types';

interface PersonSelectProps {
  value?: string;
  onChange: (personId: string | undefined) => void;
  people: Person[];
  onCreatePerson: (name: string) => Promise<Person>;
  placeholder?: string;
  className?: string;
}

const NEW_OPTION = '__nova_pessoa__';

/** Seletor de pessoa (gerente/responsável) com "+ nova pessoa" inline — Fase 2.1. */
export function PersonSelect({
  value,
  onChange,
  people,
  onCreatePerson,
  placeholder = 'Selecionar…',
  className = 'w-full',
}: PersonSelectProps) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');

  const selectedPerson = people.find((p) => p.id === value);
  const options = people.filter((p) => p.active);
  if (selectedPerson && !selectedPerson.active) options.push(selectedPerson);

  if (creating) {
    return (
      <Input
        autoFocus
        value={draftName}
        placeholder="Nome da pessoa"
        onChange={(e) => setDraftName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setCreating(false);
            setDraftName('');
          }
        }}
        onBlur={async () => {
          const name = draftName.trim();
          setCreating(false);
          setDraftName('');
          if (name) {
            const person = await onCreatePerson(name);
            onChange(person.id);
          }
        }}
        className={className}
      />
    );
  }

  return (
    <Select
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === NEW_OPTION) {
          setCreating(true);
          return;
        }
        onChange(e.target.value || undefined);
      }}
      className={className}
    >
      <option value="">{placeholder}</option>
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {!p.active ? ' (inativo)' : ''}
        </option>
      ))}
      <option value={NEW_OPTION}>+ Nova pessoa…</option>
    </Select>
  );
}
