interface LegendItem {
  label: string;
  className: string;
}

const ITEMS: LegendItem[] = [
  { label: 'Previsto', className: 'border border-dashed border-action bg-white' },
  { label: 'Real', className: 'bg-action' },
  { label: 'Atraso', className: 'bg-status-delayed' },
  { label: 'Concluído', className: 'bg-status-done' },
  { label: 'Em andamento', className: 'bg-status-progress' },
  { label: 'Não iniciado', className: 'bg-status-idle' },
];

export function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-muted">
      {ITEMS.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${item.className}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
