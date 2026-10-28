import { useState } from 'react';
import { Input, Select } from '../ui';
import type { Aprovador } from '../../types';

interface AprovadorSelectProps {
  value?: string;
  onChange: (aprovadorId: string | undefined) => void;
  aprovadores: Aprovador[];
  onCreateAprovador: (name: string) => Promise<Aprovador>;
  disabled?: boolean;
}

const NEW_OPTION = '__novo_aprovador__';

/** Seletor de aprovador com "+ novo aprovador" inline (sessão de 2026-10-28, pedido do usuário —
 * "não é essa lista [pessoas], será uma lista nova... a pessoa pode criar o aprovador e vai
 * criando a lista") — mesma mecânica de `PersonSelect.tsx` (combobox + criação inline), só sem
 * `active`/`required`: `aprovadores` não tem esses conceitos. */
export function AprovadorSelect({ value, onChange, aprovadores, onCreateAprovador, disabled = false }: AprovadorSelectProps) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');

  if (creating) {
    return (
      <Input
        autoFocus
        value={draftName}
        placeholder="Nome do aprovador"
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
            const aprovador = await onCreateAprovador(name);
            onChange(aprovador.id);
          }
        }}
        className="w-full"
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
      className="w-full"
      disabled={disabled}
    >
      <option value="">Sem aprovador</option>
      {aprovadores.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
      <option value={NEW_OPTION}>+ Novo aprovador…</option>
    </Select>
  );
}
