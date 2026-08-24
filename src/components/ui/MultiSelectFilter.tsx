import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Checkbox } from './Checkbox';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

/** Dropdown de seleção múltipla (checkbox por opção) — pra filtros onde "só um valor por vez"
 * (`FilterSelect`) é curto demais, ex.: "quero ver Projeto A e Projeto C juntos". */
export function MultiSelectFilter({ label, options, selected, onChange, className = '' }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const buttonText =
    selected.length === 0
      ? `${label}: Todos`
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? label)
        : `${label}: ${selected.length} selecionados`;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-sm hover:border-text-muted2 ${
          selected.length > 0 ? 'border-sidebar text-text' : 'border-border text-text-muted'
        }`}
      >
        <span className="truncate">{buttonText}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted2" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-card p-2 shadow-lg">
            <div className="mb-1 flex items-center justify-between px-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted2">{label}</p>
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-action hover:underline">
                  Limpar
                </button>
              )}
            </div>
            {options.length === 0 ? (
              <p className="px-1 py-1 text-xs text-text-muted">Nenhuma opção.</p>
            ) : (
              options.map((option) => (
                <div key={option.value} className="rounded px-1 py-1 hover:bg-page">
                  <Checkbox
                    checked={selected.includes(option.value)}
                    onChange={() => toggle(option.value)}
                    label={<span className="truncate">{option.label}</span>}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
