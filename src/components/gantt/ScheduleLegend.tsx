export function ScheduleLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border border-action bg-white" />
        Previsto
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-action" />
        Real
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-px w-3 bg-text-muted" />
        Dependência
      </span>
    </div>
  );
}
